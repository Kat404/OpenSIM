/**
 * OpenSIM — Native single-file authentication.
 *
 * Implements the CF-3 decision (v2.2 spec §5.1, §9, §16, Tarea 2.5):
 *   - PBKDF2-HMAC-SHA-256 password hashing via `crypto.subtle`
 *   - 100,000 iterations, 16-byte salt, 32-byte derived key
 *   - 32-byte session tokens (base64url, no padding)
 *   - **The DB stores `sha256(token)`, not the raw token** (audit A3).
 *     The HttpOnly cookie still carries the raw token so the user
 *     retains a value that matches what we issued; only the database
 *     has the one-way digest, so a D1 dump does not yield usable
 *     session tokens.
 *   - 30-day session lifetime, D1-backed session table
 *   - HttpOnly + Secure + SameSite=Lax cookies (set by the caller)
 *   - Constant-time password comparison
 *
 * Zero npm dependencies for auth; the entire surface is Web Crypto
 * plus the Drizzle-typed D1 binding.
 *
 * See: odd/tasks/opensim.md §5.1 (schema), §9 (CF-3), §16.2 (A3 fix).
 */

import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { getDb, type Database } from './db';
import {
	authAttempts,
	authSessions,
	studentCredentials,
	studentProfiles,
	type StudentProfile
} from './db/schema';

// ---------- Constants ----------

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BITS = 256; // 32 bytes
const SESSION_TOKEN_BYTES = 32;
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE_NAME = 'opensim_session';

// ---------- Rate limiting (audit R8-9 / P0-2) ----------
//
// Sliding 15-minute window. 5+ failed attempts on the same key
// (`control:<control>` or `ip:<sha256>`) within the window means the
// next call returns `limited: true`. The threshold is conservative —
// a student who fat-fingers their password twice will not trigger
// it, but a credential-stuffing attempt on the enumerable 8-digit
// controlNumber hits the wall after 5 control: keys.
//
// ponytail: this counter is GLOBAL to the system (single-table, no
// per-IP sharding). At adequate traffic this is the right shape;
// split per-edge-region when the limit becomes a contention point.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSec: number };

/**
 * Returns whether the given attempt key is currently rate-limited and,
 * if so, how many seconds the caller must wait before retrying. The
 * lookup walks the `auth_attempts` table for buckets in the trailing
 * 15 minutes and sums their `attempt_count`; threshold is 5.
 *
 * `key` is opaque to this function — callers pass either
 * `control:<digits>` or `ip:<hash>`. The two flavors are looked up
 * independently and the caller decides how to combine them (the login
 * form action denies if EITHER is limited, audit R8-9).
 */
export async function isRateLimited(db: Database, key: string): Promise<RateLimitResult> {
	const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
	const rows = await db
		.select({ sum: sql<number>`COALESCE(SUM(${authAttempts.attemptCount}), 0)` })
		.from(authAttempts)
		.where(and(eq(authAttempts.attemptKey, key), gte(authAttempts.windowStart, windowStart)));
	const total = rows[0]?.sum ?? 0;
	if (total < RATE_LIMIT_MAX_ATTEMPTS) return { limited: false };

	// Find the oldest bucket that's still in the window — the caller
	// can retry once that bucket ages out. Walk the buckets in window
	// in ascending order, take the first one whose `windowStart +
	// 15min` is in the future.
	const buckets = await db
		.select({ windowStart: authAttempts.windowStart })
		.from(authAttempts)
		.where(and(eq(authAttempts.attemptKey, key), gte(authAttempts.windowStart, windowStart)))
		.orderBy(authAttempts.windowStart);
	const oldest = buckets[0]?.windowStart;
	const retryAfterSec = oldest
		? Math.max(
				1,
				Math.ceil((oldest.getTime() + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000)
			)
		: RATE_LIMIT_WINDOW_MS / 1000;
	return { limited: true, retryAfterSec };
}

/**
 * Records a failed login attempt for the given key. Inserts a new
 * bucket row if no bucket exists for the current minute; otherwise
 * increments the existing bucket's counter. Best-effort: errors are
 * swallowed because failing to record a failed attempt should never
 * prevent the user from seeing the auth error.
 *
 * ponytail: the bucket key is the timestamp truncated to a 1-minute
 * boundary, so a sustained attack on one key produces ~15 rows / 15
 * minutes instead of one row per attempt. Smaller table, same math.
 */
export async function recordFailedAttempt(db: Database, key: string): Promise<void> {
	try {
		const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
		// INSERT ... ON CONFLICT (attempt_key, window_start) DO UPDATE.
		// Drizzle doesn't expose ON CONFLICT for sqlite directly here
		// (we don't have a unique constraint on the pair), so we do a
		// SELECT + INSERT or UPDATE in one round-trip via Drizzle's
		// `insert(...).onConflictDoUpdate(...)`. We need an actual
		// unique constraint for the upsert to fire, so we rely on a
		// transactional pattern: read-then-write is fine here because
		// rate limiting tolerates ~1-row skew at the minute boundary.
		await db.transaction(async (tx) => {
			const existing = await tx
				.select({ id: authAttempts.id })
				.from(authAttempts)
				.where(
					and(
						eq(authAttempts.attemptKey, key),
						eq(authAttempts.windowStart, windowStart)
					)
				)
				.limit(1);
			if (existing[0]) {
				await tx
					.update(authAttempts)
					.set({ attemptCount: sql`${authAttempts.attemptCount} + 1` })
					.where(eq(authAttempts.id, existing[0].id));
			} else {
				await tx.insert(authAttempts).values({
					attemptKey: key,
					windowStart,
					attemptCount: 1
				});
			}
		});
	} catch {
		// intentionally ignored — see header
	}
}

/**
 * Clears all rate-limit counters for the given key. Called after a
 * successful login so the legitimate user isn't punished for a
 * prior bad run (a stuck student who finally remembered the password
 * shouldn't see a 429 on the next attempt).
 */
export async function clearRateLimit(db: Database, key: string): Promise<void> {
	try {
		await db.delete(authAttempts).where(eq(authAttempts.attemptKey, key));
	} catch {
		/* intentionally ignored */
	}
}

/**
 * Bulk prune of expired attempt counters. Called by the cron handler
 * (auth.ts `scheduled`); can also be called manually. Keeps the table
 * from growing unboundedly.
 */
export async function pruneExpiredAttempts(db: Database): Promise<number> {
	const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
	const result = await db
		.delete(authAttempts)
		.where(lt(authAttempts.windowStart, cutoff));
	return extractAffectedRows(result);
}

/**
 * Returns the number of rows the last Drizzle delete affected. D1
 * exposes the count on `result.meta.rows_written`; node:sqlite (and
 * the local test backend) puts it on `result.changes`. This helper
 * normalises both shapes so the same code reads correctly in tests
 * and production.
 */
function extractAffectedRows(result: unknown): number {
	if (!result || typeof result !== 'object') return 0;
	const r = result as Record<string, unknown>;
	if (typeof r.rowsWritten === 'number') return r.rowsWritten;
	const meta = r.meta as Record<string, unknown> | undefined;
	if (meta && typeof meta.rows_written === 'number') return meta.rows_written;
	if (typeof r.changes === 'number') return r.changes;
	return 0;
}

// ---------- Crypto helpers ----------

/** Returns `n` cryptographically random bytes as a Uint8Array. */
function randomBytes(n: number): Uint8Array {
	const out = new Uint8Array(n);
	crypto.getRandomValues(out);
	return out;
}

/** Encodes a byte array as base64url without padding. */
function bytesToBase64Url(bytes: Uint8Array): string {
	// Inline base64url encoder to avoid pulling in Buffer (which
	// has overloaded `toString` definitions across @types/node and
	// Workers that confuse svelte-check). base64url is the URL-safe
	// variant of base64 (RFC 4648 §5): '+' -> '-', '/' -> '_', no '='.
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i] ?? 0);
	}
	const b64 = btoa(binary);
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes a base64url string to a Uint8Array. Returns an empty buffer for malformed input. */
function base64UrlToBytes(s: string): Uint8Array {
	try {
		const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
		const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
		const binary = atob(padded);
		const out = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			out[i] = binary.charCodeAt(i);
		}
		return out;
	} catch {
		// Malformed base64url: return an empty buffer so callers can
		// do constant-time comparison against a known-bad hash and
		// fail closed without throwing at the boundary.
		return new Uint8Array(0);
	}
}

/** Constant-time equality check for two Uint8Array buffers. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) {
		// Still do a per-byte scan to keep timing similar across calls.
		let diff = a.length ^ b.length;
		const max = Math.max(a.length, b.length);
		for (let i = 0; i < max; i++) {
			diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
		}
		return false;
	}
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return diff === 0;
}

// ---------- Password hashing ----------

export interface PasswordHashResult {
	hash: string;
	salt: string;
	iterations: number;
}

/**
 * Derives a 32-byte PBKDF2-HMAC-SHA-256 key from `password` and a
 * freshly generated 16-byte salt. Returns base64url-encoded hash and
 * salt plus the iteration count used (so the verifier can match).
 */
export async function hashPassword(password: string): Promise<PasswordHashResult> {
	const salt = randomBytes(SALT_BYTES);
	const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS, DERIVED_KEY_BITS);
	return {
		hash: bytesToBase64Url(derived),
		salt: bytesToBase64Url(salt),
		iterations: PBKDF2_ITERATIONS
	};
}

/**
 * Verifies a candidate password against a stored PBKDF2 hash in
 * constant time. Returns `false` for any input mismatch (wrong
 * password, wrong length, wrong iteration count).
 */
export async function verifyPassword(
	password: string,
	hash: string,
	salt: string,
	iterations: number
): Promise<boolean> {
	if (iterations <= 0 || !Number.isFinite(iterations)) return false;
	const derivedSalt = base64UrlToBytes(salt);
	const storedHash = base64UrlToBytes(hash);
	const derived = await pbkdf2(password, derivedSalt, iterations, DERIVED_KEY_BITS);
	return timingSafeEqual(derived, storedHash);
}

/** Internal PBKDF2 wrapper around `crypto.subtle.deriveBits`. */
async function pbkdf2(
	password: string,
	salt: Uint8Array,
	iterations: number,
	bits: number
): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	// Copy the salt into a fresh ArrayBuffer-backed Uint8Array so
	// `deriveBits`'s BufferSource parameter is satisfied regardless of
	// the upstream Uint8Array's backing buffer type (ArrayBuffer vs
	// SharedArrayBuffer). The copy is 16 bytes — negligible.
	const saltCopy = new Uint8Array(salt.length);
	for (let i = 0; i < salt.length; i++) saltCopy[i] = salt[i] ?? 0;
	const bitsBuffer = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			salt: saltCopy,
			iterations
		},
		key,
		bits
	);
	return new Uint8Array(bitsBuffer);
}

// ---------- Session management ----------

export interface SessionRecord {
	/**
	 * The raw session token (base64url, 32 random bytes). The caller
	 * MUST set this as the HttpOnly cookie value so the user retains
	 * the value. The database stores only `sha256(token)` — see
	 * `hashToken` and the schema comment for `authSessions`.
	 */
	id: string;
	expiresAt: Date;
}

export interface SessionValidation {
	controlNumber: string;
	expiresAt: Date;
}

/**
 * Returns the SHA-256 (base64url, no padding) of the raw session
 * token. The same function is used at insert, lookup, and delete
 * time, so callers only ever see the hash on the database side.
 */
export async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return bytesToBase64Url(new Uint8Array(digest));
}

/**
 * Creates a new session row for the given student and returns the
 * raw token plus the expiry date. The caller is responsible for
 * setting the HttpOnly cookie with the raw token; this function
 * stores `sha256(rawToken)` as the row PK so the database never
 * holds a usable session secret.
 */
export async function createSession(
	db: Database,
	controlNumber: string,
	userAgent: string,
	ipHash: string
): Promise<SessionRecord> {
	const rawToken = bytesToBase64Url(randomBytes(SESSION_TOKEN_BYTES));
	const id = await hashToken(rawToken);
	const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
	await db.insert(authSessions).values({
		id,
		studentControlNumber: controlNumber,
		expiresAt,
		userAgent,
		ipHash
	});
	return { id: rawToken, expiresAt };
}

/**
 * Looks up a session by hashing the provided token and matching the
 * resulting digest against the `auth_sessions.id` PK. Returns `null`
 * if the session does not exist, has expired, or the student profile
 * has been deleted. Expired rows are pruned by the cron handler
 * (see `scheduled` below) so this function does not pay a per-request
 * DELETE cost (audit R8-8 / P0-4).
 */
export async function validateSessionToken(
	db: Database,
	token: string
): Promise<SessionValidation | null> {
	const id = await hashToken(token);
	const now = new Date();

	const rows = await db
		.select()
		.from(authSessions)
		.where(eq(authSessions.id, id))
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	if (row.expiresAt.getTime() <= now.getTime()) {
		// Expired exactly now — refuse. The bulk prune will sweep it
		// on the next cron tick.
		return null;
	}
	return {
		controlNumber: row.studentControlNumber,
		expiresAt: row.expiresAt
	};
}

/**
 * Cloudflare Workers scheduled handler. Invoked by the
 * `0 [slash]6 * * *` cron (every 6 hours, see wrangler.jsonc
 * `triggers.crons`). The `@sveltejs/adapter-cloudflare` 8 worker
 * entry only ships a `fetch` handler by default; this function is
 * wired onto the worker's default export by
 * `scripts/inject-scheduled-handler.mjs`, which
 * runs after `vite build` (see package.json `build` script).
 *
 * What it does:
 *  - Bulk DELETE expired sessions (audit R8-8 / P0-4).
 *  - Bulk DELETE expired rate-limit buckets (audit R8-9 follow-up).
 *
 * Local dev: `wrangler dev` does NOT auto-fire crons. To exercise
 * this handler locally, hit the wrangler dev `/cdn-cgi/handler/scheduled`
 * endpoint with the cron expression, or call `pruneSessions` /
 * `pruneExpiredAttempts` directly from a test.
 */
export async function scheduled(
	event: { cron: string; scheduledTime: number | Date },
	env: { DB: D1Database }
): Promise<void> {
	const db = getDb(env.DB);
	const [prunedSessions, prunedAttempts] = await Promise.all([
		pruneExpiredSessions(db),
		pruneExpiredAttempts(db)
	]);
	// eslint-disable-next-line no-console
	console.log(
		`[scheduled] cron=${event.cron} prunedSessions=${prunedSessions} prunedAttempts=${prunedAttempts}`
	);
}

/**
 * Bulk prune of expired sessions. Called by `scheduled` above.
 * Returned count is best-effort (D1 SQLite doesn't always surface
 * `changes_affected`); callers should log and move on.
 */
export async function pruneExpiredSessions(db: Database): Promise<number> {
	const now = new Date();
	const result = await db.delete(authSessions).where(lt(authSessions.expiresAt, now));
	return extractAffectedRows(result);
}

/** Deletes a session row by hashing the provided token (logout). */
export async function invalidateSession(db: Database, token: string): Promise<void> {
	const id = await hashToken(token);
	await db.delete(authSessions).where(eq(authSessions.id, id));
}

// ---------- User lookup ----------

/**
 * Fetches the student profile associated with a session token, or
 * `null` if the session is missing/expired or the profile has been
 * removed. This is the function `hooks.server.ts` calls per request
 * to populate `event.locals.user`.
 */
export async function getUserFromSessionToken(
	db: Database,
	token: string
): Promise<StudentProfile | null> {
	const session = await validateSessionToken(db, token);
	if (!session) return null;
	const rows = await db
		.select()
		.from(studentProfiles)
		.where(eq(studentProfiles.controlNumber, session.controlNumber))
		.limit(1);
	return rows[0] ?? null;
}

// ---------- Credentials lookup ----------

/** Fetches a credential row by control number, or `undefined`. */
export async function getCredential(
	db: Database,
	controlNumber: string
): Promise<{ passwordHash: string; passwordSalt: string; passwordIterations: number } | undefined> {
	const rows = await db
		.select({
			passwordHash: studentCredentials.passwordHash,
			passwordSalt: studentCredentials.passwordSalt,
			passwordIterations: studentCredentials.passwordIterations
		})
		.from(studentCredentials)
		.where(eq(studentCredentials.controlNumber, controlNumber))
		.limit(1);
	return rows[0];
}

// ---------- IP hashing ----------

/**
 * Hashes a raw IP address (or any string) with SHA-256 and returns
 * the hex digest. We do not store the raw IP for privacy reasons.
 */
export async function hashIp(ip: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
	const bytes = new Uint8Array(digest);
	let hex = '';
	for (let i = 0; i < bytes.length; i++) {
		hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
	}
	return hex;
}

// ---------- Cookie helpers ----------

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = SESSION_LIFETIME_MS / 1000;

/** Cookie attributes for the session token. */
export const sessionCookieOptions = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const,
	path: '/',
	maxAge: SESSION_MAX_AGE_SECONDS
};

/** Build the `delete` payload to clear the session cookie. */
export const clearSessionCookieOptions = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const,
	path: '/',
	maxAge: 0
};

// ---------- Re-export for tests / ergonomics ----------

export { getDb };

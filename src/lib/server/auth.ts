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

import { eq, lt } from 'drizzle-orm';
import { getDb, type Database } from './db';
import { authSessions, studentCredentials, studentProfiles, type StudentProfile } from './db/schema';

// ---------- Constants ----------

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BITS = 256; // 32 bytes
const SESSION_TOKEN_BYTES = 32;
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE_NAME = 'opensim_session';

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
 * has been deleted. Lazy-prunes expired rows so the table does not
 * grow unbounded.
 */
export async function validateSessionToken(
	db: Database,
	token: string
): Promise<SessionValidation | null> {
	const id = await hashToken(token);
	const now = new Date();
	// Lazy cleanup of expired sessions (best-effort, swallow errors).
	try {
		await db.delete(authSessions).where(lt(authSessions.expiresAt, now));
	} catch {
		// intentionally ignored
	}

	const rows = await db
		.select()
		.from(authSessions)
		.where(eq(authSessions.id, id))
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	if (row.expiresAt.getTime() <= now.getTime()) {
		// Expired exactly now — clean up and refuse.
		try {
			await db.delete(authSessions).where(eq(authSessions.id, id));
		} catch {
			// intentionally ignored
		}
		return null;
	}
	return {
		controlNumber: row.studentControlNumber,
		expiresAt: row.expiresAt
	};
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

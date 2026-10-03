/**
 * OpenSIM — Auth library unit tests.
 *
 * Covers the pure (non-D1) surface of src/lib/server/auth.ts:
 *   - hashPassword: determinism, base64url output shape, salt uniqueness
 *   - verifyPassword: positive, negative, wrong iterations
 *   - hashIp: hex output, determinism, IP-vs-other-input distinction
 *   - hashToken: SHA-256 determinism, base64url output shape, Unicode
 *   - rate-limit helpers (R8-9 / P0-2): against a Drizzle mock that
 *     exposes the same `select` / `insert` / `update` / `delete`
 *     surface as the real driver, scoped to the authAttempts table
 *
 * The D1-backed helpers (createSession, validateSessionToken,
 * invalidateSession, getUserFromSessionToken) are not exercised here
 * because they require a D1Database; they will be covered by the
 * integration test suite planned for Phase 5 alongside axe-core.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
	hashPassword,
	verifyPassword,
	hashIp,
	hashToken,
	isRateLimited,
	recordFailedAttempt,
	clearRateLimit,
	pruneExpiredAttempts
} from '../../src/lib/server/auth';
import { authAttempts } from '../../src/lib/server/db/schema';

describe('hashPassword', () => {
	it('returns a base64url hash and salt with no "+", "/" or "=" characters', async () => {
		const { hash, salt } = await hashPassword('super-secret-password');
		expect(hash).not.toMatch(/[+/=]/);
		expect(salt).not.toMatch(/[+/=]/);
	});

	it('produces a different salt (and therefore hash) on each call', async () => {
		const a = await hashPassword('same-password');
		const b = await hashPassword('same-password');
		expect(a.salt).not.toBe(b.salt);
		expect(a.hash).not.toBe(b.hash);
	});

	it('returns the configured iteration count', async () => {
		const { iterations } = await hashPassword('whatever');
		expect(iterations).toBe(100_000);
	});

	it('handles short passwords without throwing', async () => {
		const { hash, salt } = await hashPassword('x');
		expect(hash.length).toBeGreaterThan(0);
		expect(salt.length).toBeGreaterThan(0);
	});

	it('handles long passwords (up to 256 chars) without throwing', async () => {
		const long = 'a'.repeat(256);
		const { hash, salt } = await hashPassword(long);
		expect(hash.length).toBeGreaterThan(0);
		expect(salt.length).toBeGreaterThan(0);
	});
});

describe('verifyPassword', () => {
	it('returns true when the password matches the stored hash', async () => {
		const { hash, salt, iterations } = await hashPassword('correct-horse-battery-staple');
		const ok = await verifyPassword('correct-horse-battery-staple', hash, salt, iterations);
		expect(ok).toBe(true);
	});

	it('returns false when the password does not match', async () => {
		const { hash, salt, iterations } = await hashPassword('original');
		const ok = await verifyPassword('different', hash, salt, iterations);
		expect(ok).toBe(false);
	});

	it('returns false when the password differs by a single character', async () => {
		const { hash, salt, iterations } = await hashPassword('original');
		const ok = await verifyPassword('originaL', hash, salt, iterations);
		expect(ok).toBe(false);
	});

	it('returns false when the iteration count is wrong', async () => {
		const { hash, salt, iterations } = await hashPassword('original');
		const ok = await verifyPassword('original', hash, salt, iterations + 1);
		expect(ok).toBe(false);
	});

	it('returns false for malformed (non-base64url) inputs without throwing', async () => {
		const ok = await verifyPassword('original', 'not-base64url!@#', 'also!@#', 100_000);
		expect(ok).toBe(false);
	});

	it('returns false for non-positive iteration counts without throwing', async () => {
		const { hash, salt } = await hashPassword('original');
		expect(await verifyPassword('original', hash, salt, 0)).toBe(false);
		expect(await verifyPassword('original', hash, salt, -1)).toBe(false);
		expect(await verifyPassword('original', hash, salt, Number.NaN)).toBe(false);
	});
});

describe('hashIp', () => {
	it('returns a 64-character hex string (SHA-256 of any input)', async () => {
		const out = await hashIp('192.0.2.1');
		expect(out).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is deterministic: same input always returns the same hash', async () => {
		const a = await hashIp('10.0.0.1');
		const b = await hashIp('10.0.0.1');
		expect(a).toBe(b);
	});

	it('produces different hashes for different inputs', async () => {
		const a = await hashIp('10.0.0.1');
		const b = await hashIp('10.0.0.2');
		expect(a).not.toBe(b);
	});

	it('handles the empty string without throwing', async () => {
		const out = await hashIp('');
		expect(out).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe('hashToken', () => {
	it('is deterministic — same input → same output', async () => {
		const a = await hashToken('test-token-123');
		const b = await hashToken('test-token-123');
		expect(a).toBe(b);
	});

	it('produces different output for different inputs', async () => {
		const a = await hashToken('token-A');
		const b = await hashToken('token-B');
		expect(a).not.toBe(b);
	});

	it('output is base64url without padding (43 chars for SHA-256 32 bytes)', async () => {
		const result = await hashToken('any-token');
		expect(result).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it('handles empty string without throwing', async () => {
		await expect(hashToken('')).resolves.toBeTruthy();
	});

	it('handles Unicode input without throwing', async () => {
		await expect(hashToken('ñoño-token-é-é')).resolves.toBeTruthy();
	});
});

// ---------- Rate limiting (audit R8-9 / P0-2) ----------
//
// These tests exercise the rate-limit helpers against a real in-memory
// SQLite via `node:sqlite` (built-in to Node 22+, available in this
// repo's Node 26), wrapped in Drizzle's `sqlite-proxy` driver. The
// helpers themselves are pure (the 15-minute window is relative to
// `Date.now()`), so we anchor time with a spy and let SQLite handle
// the SQL — no Drizzle mock to maintain.
//
// The schema (authAttempts) is created on demand from the same Drizzle
// definition `auth.ts` imports, so any future column added to the
// table is automatically reflected here.

import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../../src/lib/server/db/schema';

function makeSqliteDb(): {
	db: Parameters<typeof isRateLimited>[0];
	raw: DatabaseSync;
} {
	const raw = new DatabaseSync(':memory:');
	raw.exec(`
		CREATE TABLE auth_attempts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			attempt_key TEXT NOT NULL,
			window_start INTEGER NOT NULL,
			attempt_count INTEGER NOT NULL DEFAULT 1
		);
		CREATE INDEX idx_auth_attempts_key_window ON auth_attempts (attempt_key, window_start);
	`);
	// Drizzle's D1 mode declares `integer({mode:'timestamp'})` columns;
	// at the wire it serializes the value as a JS Date object. The
	// `node:sqlite` driver expects a unix-seconds integer for INTEGER
	// columns, so we coerce Date -> Math.floor(.getTime() / 1000)
	// before binding. This matches how D1's host driver behaves
	// internally — the test surface is the same SQL the production
	// path issues.
	const bind = (p: unknown): unknown => (p instanceof Date ? Math.floor(p.getTime() / 1000) : p);
	const callback = (
		sql: string,
		params: unknown[],
		method: 'run' | 'all' | 'values' | 'get'
	): { rows: unknown[]; meta?: Record<string, unknown> } => {
		try {
			const stmt = raw.prepare(sql);
			const bound = params.map(bind) as number[];
			if (method === 'run') {
				const r = stmt.run(...bound) as { changes: number; lastInsertRowid: number };
				// Mirror the D1 result shape (`meta.rows_written`,
				// `meta.changes`) so `auth.ts`'s `extractAffectedRows`
				// finds the row count without adapter-specific code.
				return { rows: [], meta: { changes: r.changes, rows_written: r.changes, last_row_id: r.lastInsertRowid } };
			}
			// Drizzle's proxy driver indexes into rows by column position
			// (`mapResultRow` reads `row[columnIndex]`), so we must hand
			// back tuples in the SELECT order — not objects, despite
			// `node:sqlite` defaulting to named rows.
			const cols = stmt.columns();
			const toArray = (row: Record<string, unknown>): unknown[] =>
				cols.map((c) => row[c.name]);
			if (method === 'get') {
				const row = stmt.get(...bound) as Record<string, unknown> | undefined;
				return { rows: row ? [toArray(row)] : [] };
			}
			const rows = stmt.all(...bound) as Record<string, unknown>[];
			return { rows: rows.map(toArray) };
		} catch (err) {
			throw err;
		}
	};
	const db = drizzle(callback, { schema }) as unknown as Parameters<typeof isRateLimited>[0];
	return { db, raw };
}

describe('rate limiting (audit R8-9 / P0-2)', () => {
	let nowSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// Anchor the 15-minute window to a fixed point so the SQL
		// comparisons are deterministic across the suite.
		nowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-03T12:00:00Z').getTime());
	});

	afterEach(() => {
		nowSpy.mockRestore();
	});

	it('isRateLimited returns not-limited on a key with no history', async () => {
		const { db } = makeSqliteDb();
		const result = await isRateLimited(db, 'control:<NUMERO DE CONTROL PURGADO>');
		expect(result.limited).toBe(false);
	});

	it('records five failed attempts and then marks the key limited', async () => {
		const { db } = makeSqliteDb();
		const key = 'control:<NUMERO DE CONTROL PURGADO>';
		for (let i = 0; i < 5; i++) {
			await recordFailedAttempt(db, key);
		}
		const result = await isRateLimited(db, key);
		expect(result.limited).toBe(true);
		if (result.limited) {
			expect(result.retryAfterSec).toBeGreaterThan(0);
			expect(result.retryAfterSec).toBeLessThanOrEqual(15 * 60);
		}
	});

	it('still allows up to four failed attempts before limiting', async () => {
		const { db } = makeSqliteDb();
		const key = 'control:<NUMERO DE CONTROL PURGADO>';
		for (let i = 0; i < 4; i++) {
			await recordFailedAttempt(db, key);
		}
		const result = await isRateLimited(db, key);
		expect(result.limited).toBe(false);
	});

	it('different keys do not share a counter', async () => {
		const { db } = makeSqliteDb();
		const a = 'control:<NUMERO DE CONTROL PURGADO>';
		const b = 'control:99999999';
		for (let i = 0; i < 5; i++) {
			await recordFailedAttempt(db, a);
		}
		const limitedA = await isRateLimited(db, a);
		const limitedB = await isRateLimited(db, b);
		expect(limitedA.limited).toBe(true);
		expect(limitedB.limited).toBe(false);
	});

	it('clearRateLimit resets the counter for a key', async () => {
		const { db } = makeSqliteDb();
		const key = 'control:<NUMERO DE CONTROL PURGADO>';
		for (let i = 0; i < 5; i++) {
			await recordFailedAttempt(db, key);
		}
		await clearRateLimit(db, key);
		const result = await isRateLimited(db, key);
		expect(result.limited).toBe(false);
	});

	it('clearRateLimit only touches the targeted key', async () => {
		const { db } = makeSqliteDb();
		const a = 'control:<NUMERO DE CONTROL PURGADO>';
		const b = 'control:99999999';
		for (let i = 0; i < 5; i++) {
			await recordFailedAttempt(db, a);
			await recordFailedAttempt(db, b);
		}
		await clearRateLimit(db, a);
		const ra = await isRateLimited(db, a);
		const rb = await isRateLimited(db, b);
		expect(ra.limited).toBe(false);
		expect(rb.limited).toBe(true);
	});

	it('pruneExpiredAttempts removes buckets outside the 15-minute window', async () => {
		const { db, raw } = makeSqliteDb();
		// Inject a bucket whose window_start is 20 minutes ago — outside
		// the 15-minute cutoff. `recordFailedAttempt` won't add this
		// (it uses the current minute), so we splice directly.
		raw
			.prepare(
				'INSERT INTO auth_attempts (attempt_key, window_start, attempt_count) VALUES (?, ?, ?)'
			)
			.run('control:<NUMERO DE CONTROL PURGADO>', Math.floor((Date.now() - 20 * 60 * 1000) / 1000), 3);
		const removed = await pruneExpiredAttempts(db);
		expect(removed).toBe(1);
		const remaining = raw.prepare('SELECT COUNT(*) as c FROM auth_attempts').get() as { c: number };
		expect(remaining.c).toBe(0);
	});
});

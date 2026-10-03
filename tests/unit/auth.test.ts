/**
 * OpenSIM — Auth library unit tests.
 *
 * Covers the pure (non-D1) surface of src/lib/server/auth.ts:
 *   - hashPassword: determinism, base64url output shape, salt uniqueness
 *   - verifyPassword: positive, negative, wrong iterations
 *   - hashIp: hex output, determinism, IP-vs-other-input distinction
 *   - hashToken: SHA-256 determinism, base64url output shape, Unicode
 *
 * The D1-backed helpers (createSession, validateSessionToken,
 * invalidateSession, getUserFromSessionToken) are not exercised here
 * because they require a D1Database; they will be covered by the
 * integration test suite planned for Phase 5 alongside axe-core.
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, hashIp, hashToken } from '../../src/lib/server/auth';

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

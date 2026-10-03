/**
 * OpenSIM — Internal redirect validation tests.
 *
 * Covers the open-redirect class of bugs in safeInternalRedirect:
 *   - protocol-relative URLs (`//evil.com`)
 *   - backslash-prefixed paths (`/\evil.com`, `\\evil.com`)
 *   - absolute URLs (`https://evil.com`)
 *   - valid same-origin paths (with and without query string)
 *
 * See: odd/tasks/opensim.md §16 (audit NEW-2).
 */

import { describe, it, expect } from 'vitest';
import { safeInternalRedirect } from '#lib/utils/redirect';

describe('safeInternalRedirect', () => {
	it('returns fallback for null', () => {
		expect(safeInternalRedirect(null)).toBe('/dashboard');
	});

	it('returns fallback for undefined', () => {
		expect(safeInternalRedirect(undefined)).toBe('/dashboard');
	});

	it('returns fallback for empty string', () => {
		expect(safeInternalRedirect('')).toBe('/dashboard');
	});

	it('returns fallback for protocol-relative URL', () => {
		expect(safeInternalRedirect('//evil.com')).toBe('/dashboard');
		expect(safeInternalRedirect('//evil.com/path')).toBe('/dashboard');
	});

	it('returns fallback for backslash-prefixed protocol-relative', () => {
		expect(safeInternalRedirect('/\\evil.com')).toBe('/dashboard');
		expect(safeInternalRedirect('\\evil.com')).toBe('/dashboard');
	});

	it('returns fallback for absolute URL', () => {
		expect(safeInternalRedirect('https://evil.com')).toBe('/dashboard');
		expect(safeInternalRedirect('http://evil.com/path')).toBe('/dashboard');
	});

	it('passes through a valid path', () => {
		expect(safeInternalRedirect('/dashboard')).toBe('/dashboard');
	});

	it('preserves query string', () => {
		expect(safeInternalRedirect('/academico/kardex?page=2')).toBe('/academico/kardex?page=2');
	});

	it('honors a custom fallback', () => {
		expect(safeInternalRedirect(null, '/login')).toBe('/login');
		expect(safeInternalRedirect('//evil.com', '/login')).toBe('/login');
	});

	it('drops hash fragments (no client-side state leaks via redirect)', () => {
		expect(safeInternalRedirect('/dashboard#token=abc')).toBe('/dashboard');
	});
});

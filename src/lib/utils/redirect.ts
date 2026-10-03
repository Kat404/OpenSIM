/**
 * OpenSIM — Internal redirect validation.
 *
 * `safeInternalRedirect` is the only function callers should use to
 * turn a user-supplied `redirectTo` (form input, query string, or any
 * untrusted string) into a value SvelteKit can hand to `redirect()`.
 *
 * Threat model — open-redirect class:
 *   - protocol-relative URLs (`//evil.com/path`) — the browser resolves
 *     them against the current scheme, so `//evil.com` becomes a fully
 *     qualified navigation to a different origin.
 *   - backslash-prefixed paths (`/\evil.com` or `\\evil.com`) — some
 *     user agents (notably legacy IE and certain proxies) normalize a
 *     leading backslash into a forward slash, turning the path into a
 *     protocol-relative URL.
 *   - absolute URLs (`https://evil.com`) — must always be rejected.
 *
 * Defense:
 *   - Reject anything that does not start with a single forward slash.
 *   - Reject the two known open-redirect prefixes.
 *   - Parse the rest with a sentinel origin and assert the resolved
 *     origin is the sentinel. This is a same-origin check that does
 *     not require runtime config.
 *   - Drop the hash fragment to avoid leaking tokens in `#...` parts
 *     of attacker-controlled URLs that the server still trusts.
 *
 * See: odd/tasks/opensim.md §16 (audit NEW-2).
 */

const SENTINEL_ORIGIN = 'https://internal.invalid';

/**
 * Returns a path-only string suitable for SvelteKit's `redirect()`,
 * or `fallback` if the input is missing or fails validation. The
 * returned value is always of the form `/path` or `/path?query`,
 * never a full URL.
 */
export function safeInternalRedirect(
	target: string | null | undefined,
	fallback = '/dashboard'
): string {
	if (!target) return fallback;

	// Reject open-redirect vectors: protocol-relative URLs and backslash.
	if (target.startsWith('//') || target.startsWith('\\') || target.startsWith('/\\')) {
		return fallback;
	}

	// Must start with single forward slash.
	if (!target.startsWith('/')) return fallback;

	// Parse to verify it's a same-origin path. Using a sentinel base
	// means we don't depend on the current request origin and we
	// cannot accidentally pass through an absolute URL.
	try {
		const url = new URL(target, SENTINEL_ORIGIN);
		if (url.origin !== SENTINEL_ORIGIN) return fallback;
		// Hash fragments are not useful for SvelteKit redirects and may
		// carry attacker-controlled data; drop them.
		return url.pathname + url.search;
	} catch {
		return fallback;
	}
}

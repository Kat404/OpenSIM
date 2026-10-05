/**
 * OpenSIM — SvelteKit hooks (handle).
 *
 * Per-request middleware that:
 *   1. Reads the `opensim_session` cookie (if any) and validates it
 *      against the D1 sessions table.
 *   2. Populates `event.locals.user` with the student profile (or
 *      `null` if no valid session).
 *   3. Clears stale cookies + best-effort prunes the row in D1.
 *   4. Sets standard security headers (CSP, X-Frame-Options, nosniff,
 *      Referrer-Policy, Permissions-Policy, COOP, CORP) on every
 *      response. Clickjacking + PII exposure protection on an
 *      authenticated app is non-negotiable; see audit P0-2.
 *
 * Auth-gating is no longer in this file: the `(protected)` route
 * group owns it via `src/routes/(protected)/+layout.server.ts`.
 * Adding a new protected page is a matter of putting it under
 * `(protected)/` — no edits to hooks required.
 *
 * See: odd/tasks/opensim.md §9 (CF-3), §16.1 (C5 route group).
 *
 * Note: in SvelteKit 3 + @sveltejs/adapter-cloudflare 8, the worker's
 * env (D1, etc.) is accessed via the `cloudflare:workers` virtual
 * module, not `event.platform`.
 */

/**
 * Security headers applied to every response. CSP notes:
 *   - `script-src` includes the SHA-256 of the app.html theme bootstrap
 *     (the only static inline script in the document) PLUS 'unsafe-inline'
 *     because SvelteKit's body hydration script is also inline and its
 *     content varies per build (no stable hash). Follow-up: migrate to
 *     SvelteKit's `kit.csp.mode: 'nonce'` for per-request nonces and
 *     drop 'unsafe-inline'.
 *   - `style-src 'unsafe-inline'` — Svelte 5 dev mode injects inline
 *     <style data-sveltekit> blocks; production externalises to
 *     /_app/immutable/assets/*.css, so 'self' would suffice there.
 *     'unsafe-inline' keeps dev working without per-request nonces.
 *   - `frame-ancestors 'none'` is the modern equivalent of
 *     `X-Frame-Options: DENY`; both are set for legacy-client coverage.
 */
const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
	"X-Frame-Options": "DENY",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "interest-cohort=(), document-domain=()",
	"Content-Security-Policy": [
		"default-src 'self'",
		// Inline scripts: bootstrap (head) is hashed; body hydration is
		// SvelteKit's per-build inline start() shim. Replace 'unsafe-inline'
		// with a nonce when migrating to kit.csp.mode:'nonce'.
		"script-src 'self' 'sha256-uRamoX8SrAH+C1i4O7qcN2EyAkHyTeutWXw/moQFDIY=' 'unsafe-inline'",
		// Inline styles allowed for Svelte 5 dev mode (data-sveltekit
		// <style> blocks). Production externalises CSS.
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: https:",
		"font-src 'self' data:",
		"connect-src 'self'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	].join("; "),
	"Cross-Origin-Opener-Policy": "same-site",
	"Cross-Origin-Resource-Policy": "same-site",
});

// `cloudflare:workers` is a URI-style specifier that the adapter's
// Vite plugin resolves at runtime. tsc can't resolve it as a regular
// module, so we cast through the locally-declared `OpenSimWorkerEnv`
// interface (see src/cloudflare-workers.d.ts).
import { env as workerEnv } from "cloudflare:workers";
import type { Handle } from "@sveltejs/kit/hooks";
import { getUserFromSessionToken, invalidateSession, SESSION_COOKIE_NAME } from "#lib/server/auth";
import { getDb } from "#lib/server/db";
import type { OpenSimWorkerEnv } from "./cloudflare-workers";

const env = workerEnv as OpenSimWorkerEnv;

export const handle: Handle = async ({ event, resolve }) => {
	// Default to unauthenticated; the (protected) layout's load
	// function is responsible for redirecting when a guarded route
	// is hit without a valid session.
	event.locals.user = null;

	const token = event.cookies.get(SESSION_COOKIE_NAME);
	if (token && env.DB) {
		const db = getDb(env.DB);
		const user = await getUserFromSessionToken(db, token);
		if (user) {
			event.locals.user = user;
		} else {
			// Stale or invalid session — clear the cookie so the client
			// does not keep presenting a dead token.
			event.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
			// Best-effort: prune the row in D1.
			await invalidateSession(db, token).catch(() => {
				/* swallow — invalidation is a tidy-up, not a critical path */
			});
		}
	}

	const response = await resolve(event);
	// Set security headers last so they overwrite any headers a
	// +server.ts or downstream middleware might have added without
	// these protections (e.g. a permissive Cache-Control must not
	// strip a strict CSP).
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(name, value);
	}
	return response;
};

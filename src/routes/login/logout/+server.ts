/**
 * OpenSIM — Logout endpoint.
 *
 * POST /login/logout
 *   1. Reads the `opensim_session` cookie.
 *   2. Calls `invalidateSession` to remove the matching row from D1.
 *   3. Deletes the cookie on the client.
 *   4. Redirects to /login?reason=logged-out so the login page can
 *      optionally surface a confirmation.
 *
 * The logout form is rendered by `LayoutHeader` (see
 * `src/lib/components/layout/LayoutHeader.svelte`); the endpoint is
 * defined as a `+server.ts` route rather than a form action because
 * the form is a cross-cutting primitive shared by every protected
 * page. SvelteKit blocks cross-origin POSTs by default, so the form
 * is safe without an extra CSRF token.
 *
 * See: odd/tasks/opensim.md §16 (audit A1).
 */

import { redirect, type RequestHandler } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, invalidateSession } from '#lib/server/auth';
import { getDb } from '#lib/server/db';
// `cloudflare:workers` is a URI-style specifier that the adapter's
// Vite plugin resolves at runtime. tsc can't resolve it as a regular
// module, so we cast through the locally-declared `OpenSimWorkerEnv`
// interface (see src/cloudflare-workers.d.ts).
import { env as workerEnv } from 'cloudflare:workers';
import type { OpenSimWorkerEnv } from '../../../cloudflare-workers';

const env = workerEnv as OpenSimWorkerEnv;

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE_NAME);
	if (token && env.DB) {
		const db = getDb(env.DB);
		await invalidateSession(db, token).catch(() => {
			/* swallow — invalidation is a tidy-up, not a critical path */
		});
	}
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
	throw redirect(303, '/login?reason=logged-out');
};

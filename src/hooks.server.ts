/**
 * OpenSIM — SvelteKit hooks (handle).
 *
 * Per-request middleware that:
 *   1. Reads the `opensim_session` cookie (if any) and validates it
 *      against the D1 sessions table.
 *   2. Populates `event.locals.user` with the student profile (or
 *      `null` if no valid session).
 *   3. Enforces the /academico/* route protection — unauthenticated
 *      requests are redirected to /login with a `redirectTo` query
 *      parameter.
 *   4. Sends already-authenticated users away from /login to
 *      /dashboard.
 *
 * See: odd/tasks/opensim.md §9 (CF-3), Tarea 2.5.
 *
 * Note: in SvelteKit 3 + @sveltejs/adapter-cloudflare 8, the worker's
 * env (D1, etc.) is accessed via the `cloudflare:workers` virtual
 * module, not `event.platform`.
 */

import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
// `cloudflare:workers` is a URI-style specifier that the adapter's
// Vite plugin resolves at runtime. tsc can't resolve it as a regular
// module, so we cast through the locally-declared `OpenSimWorkerEnv`
// interface (see src/cloudflare-workers.d.ts).
import { env as workerEnv } from 'cloudflare:workers';
import type { OpenSimWorkerEnv } from './cloudflare-workers';
import {
	SESSION_COOKIE_NAME,
	getUserFromSessionToken,
	invalidateSession
} from '#lib/server/auth';
import { getDb } from '#lib/server/db';

const env = workerEnv as OpenSimWorkerEnv;

const PROTECTED_PREFIX = '/academico';
const LOGIN_PATH = '/login';
const DASHBOARD_PATH = '/dashboard';

export const handle: Handle = async ({ event, resolve }) => {
	// Default to unauthenticated; route loaders must check this.
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
			event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
			// Best-effort: prune the row in D1.
			await invalidateSession(db, token).catch(() => {
				/* swallow — invalidation is a tidy-up, not a critical path */
			});
		}
	}

	const pathname = event.url.pathname;

	// Gate /academico/* — redirect to /login with the intended URL.
	if (pathname.startsWith(`${PROTECTED_PREFIX}/`) && !event.locals.user) {
		const redirectTo = encodeURIComponent(pathname + event.url.search);
		throw redirect(303, `${LOGIN_PATH}?redirectTo=${redirectTo}`);
	}

	// If already authenticated, do not let the user land on /login.
	if (pathname === LOGIN_PATH && event.locals.user) {
		throw redirect(303, DASHBOARD_PATH);
	}

	return resolve(event);
};

/**
 * OpenSIM — SvelteKit hooks (handle).
 *
 * Per-request middleware that:
 *   1. Reads the `opensim_session` cookie (if any) and validates it
 *      against the D1 sessions table.
 *   2. Populates `event.locals.user` with the student profile (or
 *      `null` if no valid session).
 *   3. Clears stale cookies + best-effort prunes the row in D1.
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
			event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
			// Best-effort: prune the row in D1.
			await invalidateSession(db, token).catch(() => {
				/* swallow — invalidation is a tidy-up, not a critical path */
			});
		}
	}

	return resolve(event);
};

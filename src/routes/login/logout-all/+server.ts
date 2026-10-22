/**
 * OpenSIM — Revoke-all-sessions endpoint.
 *
 * POST /login/logout-all
 *   1. Requires a signed-in student (`locals.user`, populated by
 *      `src/hooks.server.ts` before any route handler runs).
 *   2. Deletes EVERY row of `auth_sessions` belonging to that student,
 *      not just the one in the current browser.
 *   3. Deletes the cookie on the client.
 *   4. Redirects to /login?reason=sessions-revoked.
 *
 * The plain logout (`/login/logout`) removes one session. This one is
 * the "log out everywhere" control: the student believes their account
 * was used somewhere else and wants the other devices out.
 *
 * SvelteKit blocks cross-origin POSTs by default, so the form is safe
 * without an extra CSRF token — same guarantee as the logout form
 * rendered by `LayoutHeader`.
 */

import { env as workerEnv } from "cloudflare:workers";
import { type RequestHandler, redirect } from "@sveltejs/kit";
import {
	clearSessionCookieOptions,
	invalidateAllSessions,
	SESSION_COOKIE_NAME,
} from "#lib/server/auth";
import { getDb } from "#lib/server/db";
import type { OpenSimWorkerEnv } from "../../../cloudflare-workers";

const env = workerEnv as OpenSimWorkerEnv;

export const POST: RequestHandler = async ({ cookies, locals }) => {
	// No student, no revocation. `hooks.server.ts` sets `locals.user`
	// from the session cookie, so an anonymous request never reaches
	// the DELETE below.
	if (!locals.user) {
		throw redirect(303, "/login");
	}

	if (env.DB) {
		const db = getDb(env.DB);
		await invalidateAllSessions(db, locals.user.controlNumber).catch(() => {
			/* swallow — the cookie is cleared either way, and the
			   sessions expire on their own within the session lifetime */
		});
	}

	cookies.delete(SESSION_COOKIE_NAME, clearSessionCookieOptions);
	throw redirect(303, "/login?reason=sessions-revoked");
};

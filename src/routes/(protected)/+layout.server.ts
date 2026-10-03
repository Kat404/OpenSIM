/**
 * OpenSIM — Auth gate for the (protected) route group.
 *
 * Every route under `src/routes/(protected)/` inherits this load
 * function. If `event.locals.user` is `null` (set in hooks.server.ts
 * after a failed cookie validation), we throw a redirect to /login
 * with the intended URL preserved as `redirectTo`. On success we
 * surface the user record to child loaders and pages through the
 * layout data.
 *
 * Replacing the old prefix-based guard (`/academico/*`) with a route
 * group means adding a new protected page is just a matter of
 * dropping it under `(protected)/` — no edits to hooks or layout
 * glue required.
 *
 * See: odd/tasks/opensim.md §16.1 (audit C5).
 */

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		const redirectTo = url.pathname + url.search;
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
	}
	return { user: locals.user };
};

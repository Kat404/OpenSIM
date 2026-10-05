/**
 * OpenSIM — Auth gate + palette index for the (protected) route group.
 *
 * Every route under `src/routes/(protected)/` inherits this load
 * function. If `event.locals.user` is `null` (set in hooks.server.ts
 * after a failed cookie validation), we throw a redirect to /login
 * with the intended URL preserved as `redirectTo`. On success we
 * surface the user record to child loaders and pages through the
 * layout data.
 *
 * In addition to the auth gate we also return the curriculum subjects
 * catalog (canonicalId + code + name) so the Cmd+K palette has an
 * in-memory index to filter on the client without per-keystroke D1
 * traffic. The catalog is small (~42 rows) and stable, so this is the
 * right place to fetch it.
 *
 * Replacing the old prefix-based guard (`/academico/*`) with a route
 * group means adding a new protected page is just a matter of
 * dropping it under `(protected)/` — no edits to hooks or layout
 * glue required.
 *
 * See: odd/tasks/opensim.md §16.1 (audit C5).
 */

import { env as workerEnv } from "cloudflare:workers";
import { redirect } from "@sveltejs/kit";
import { asc } from "drizzle-orm";
import { getDb } from "#lib/server/db";
import { subjects } from "#lib/server/db/schema";
import type { OpenSimWorkerEnv } from "../../cloudflare-workers";
import type { LayoutServerLoad } from "./$types";

const env = workerEnv as OpenSimWorkerEnv;

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		const redirectTo = url.pathname + url.search;
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
	}
	// PII trim (audit NEW-1): only safe fields are serialized into the
	// page payload. Sensitive columns (curp, birth_state, etc.) stay on
	// the server and are loaded per-page when needed.
	const safeUser = {
		controlNumber: locals.user.controlNumber,
		fullName: locals.user.fullName,
		status: locals.user.status,
	};

	// Palette index: build from the subjects catalog. Keep the
	// payload small (canonicalId + code + name) so the Cmd+K modal
	// stays under the 100KB JS budget. Sort by code so the dropdown
	// has a stable order before any user typing.
	let paletteSubjects: { canonicalId: string; code: string; name: string }[] = [];
	if (env.DB) {
		try {
			const db = getDb(env.DB);
			const rows = await db
				.select({
					canonicalId: subjects.canonicalId,
					code: subjects.code,
					name: subjects.name,
				})
				.from(subjects)
				.orderBy(asc(subjects.code));
			paletteSubjects = rows;
		} catch {
			// Catalog unavailable (DB read failed, e.g. during a deploy
			// outage) — the rest of the page still works without the
			// palette index. Empty array is the correct fallback.
			paletteSubjects = [];
		}
	}

	return {
		user: safeUser,
		paletteSubjects,
	};
};

/**
 * OpenSIM — Student profile loader (S6).
 *
 * Loads the signed-in student's OWN `student_profiles` row with an
 * explicit column allow-list, the same shape the dashboard loader
 * uses (audit NEW-1): the row is never hydrated wholesale into a
 * payload, and only the columns this page renders are read.
 *
 * Privacy: `(protected)/+layout.server.ts` deliberately trims the
 * sensitive columns (curp, birth_state) out of the SHARED layout
 * payload. This page needs them, so it loads its own row here — the
 * PII travels in the page's own data, never in the shared chrome.
 *
 * The career NAME lives in `careers`, not in the profile row, hence
 * the join. It is a LEFT join on purpose: a profile whose career row
 * is missing still renders, with the career code and no name.
 *
 * See: odd/tasks/ui-ux-dashboard-perfil.md (S6).
 */

import { env as workerEnv } from "cloudflare:workers";
import { redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { getDb } from "#lib/server/db";
import { careers, studentProfiles } from "#lib/server/db/schema";
import type { OpenSimWorkerEnv } from "../../../cloudflare-workers";
import type { PageServerLoad } from "./$types";

const env = workerEnv as OpenSimWorkerEnv;

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user;
	if (!u) throw redirect(302, "/login");
	const controlNumber = u.controlNumber;

	if (!env.DB) {
		// Without a database there is no row to read, and the PII is
		// deliberately carried by no other payload. The page renders
		// its empty state instead of a half-populated one.
		return { profile: null };
	}

	const db = getDb(env.DB);

	const rows = await db
		.select({
			controlNumber: studentProfiles.controlNumber,
			fullName: studentProfiles.fullName,
			curp: studentProfiles.curp,
			birthState: studentProfiles.birthState,
			careerCode: studentProfiles.careerCode,
			careerName: careers.name,
			currentSemester: studentProfiles.currentSemester,
			certifiedAverage: studentProfiles.certifiedAverage,
			arithmeticAverage: studentProfiles.arithmeticAverage,
			approvedCredits: studentProfiles.approvedCredits,
			remainingCredits: studentProfiles.remainingCredits,
			inProgressCredits: studentProfiles.inProgressCredits,
			advancePercentage: studentProfiles.advancePercentage,
			status: studentProfiles.status,
			healthService: studentProfiles.healthService,
			enrollmentPeriod: studentProfiles.enrollmentPeriod,
		})
		.from(studentProfiles)
		.leftJoin(careers, eq(studentProfiles.careerCode, careers.code))
		.where(eq(studentProfiles.controlNumber, controlNumber))
		.limit(1);

	return { profile: rows[0] ?? null };
};

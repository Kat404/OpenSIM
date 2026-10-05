/**
 * OpenSIM — Kardex page loader (Phase 3 Tarea 3.5).
 *
 * Returns the student's `student_progress` rows joined with the
 * subjects catalog so the table gets a single uniform shape
 * `{ code, name, grade, credits, period, evaluationType, status }`.
 * Sorted by period (most recent first) so the smoke test shows a
 * deterministic ordering.
 *
 * PII trim (audit NEW-1): only subject catalog + progress fields
 * needed by the page are serialized; the full StudentProfile row
 * stays server-side.
 */

import { env as workerEnv } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { getDb } from "#lib/server/db";
import {
	type EvaluationType,
	type StudentProgressStatus,
	studentProgress,
	subjects,
} from "#lib/server/db/schema";
import type { OpenSimWorkerEnv } from "../../../../cloudflare-workers";
import type { PageServerLoad } from "./$types";

const env = workerEnv as OpenSimWorkerEnv;

export interface KardexRow {
	code: string;
	name: string;
	grade: number | null;
	credits: number;
	period: string;
	evaluationType: EvaluationType | null;
	status: StudentProgressStatus;
}

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user;
	if (!u) return { entries: [] as KardexRow[] };

	if (!env.DB) {
		return { entries: [] as KardexRow[] };
	}

	const db = getDb(env.DB);

	const controlNumber = u.controlNumber;
	const rows = await db
		.select({
			code: subjects.code,
			name: subjects.name,
			credits: subjects.credits,
			grade: studentProgress.grade,
			period: studentProgress.period,
			evaluationType: studentProgress.evaluationType,
			status: studentProgress.status,
		})
		.from(studentProgress)
		.innerJoin(subjects, eq(subjects.canonicalId, studentProgress.subjectCanonicalId))
		.where(eq(studentProgress.studentControlNumber, controlNumber))
		.orderBy(asc(studentProgress.period), asc(subjects.code));

	return {
		entries: rows.map(
			(r) =>
				({
					code: r.code,
					name: r.name,
					grade: r.grade,
					credits: r.credits,
					period: r.period,
					evaluationType: (r.evaluationType ?? null) as EvaluationType | null,
					status: r.status as StudentProgressStatus,
				}) satisfies KardexRow,
		),
	};
};

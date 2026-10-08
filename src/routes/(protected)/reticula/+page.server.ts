/**
 * OpenSIM — Retícula académica loader (Phase 3 Tarea 3.4).
 *
 * Loads the verified 68-subject catalog, the 14 verified prerequisite
 * edges and the student's `student_progress` (so each subject node can be
 * colored APPROVED / ENROLLED / AVAILABLE / LOCKED on the SVG). All three
 * queries share the same D1 binding and we batch into a single
 * `db.batch()` so the page renders after one network round-trip.
 *
 * Since T9.9 every subject also carries its stored seriation tri-state and
 * curricular component, so the DAG can show the third state ("not
 * established from a source") instead of guessing it from the edge list.
 *
 * PII trim (audit NEW-1) is preserved: we never serialize the full
 * `StudentProfile` row, only the fields the retícula needs.
 */

import { env as workerEnv } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { getDb } from "#lib/server/db";
import {
	type StudentProgressStatus,
	type SubjectComponent,
	type SubjectSeriationState,
	studentProgress,
	subjectPrerequisites,
	subjects,
} from "#lib/server/db/schema";
import type { OpenSimWorkerEnv } from "../../../cloudflare-workers";
import type { PageServerLoad } from "./$types";

const env = workerEnv as OpenSimWorkerEnv;

export interface RetSubject {
	canonicalId: string;
	code: string;
	name: string;
	// Nullable since T9.7: the 16 specialty subjects have no semester on
	// record (gap H8). ReticulaDag filters them out before grid placement.
	semester: number | null;
	credits: number;
	/** Stored tri-state. `UNKNOWN` means "not established from a source",
	 * NOT "not serialized" — never collapse the three into a boolean. */
	seriationState: SubjectSeriationState;
	component: SubjectComponent;
}

export interface RetEdge {
	from: string;
	to: string;
}

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user;
	const hasUser = !!u;

	if (!env.DB) {
		return { subjects: [], edges: [], statusByCanonicalId: {} } satisfies {
			subjects: RetSubject[];
			edges: RetEdge[];
			statusByCanonicalId: Record<string, StudentProgressStatus>;
		};
	}

	const db = getDb(env.DB);
	if (!hasUser) {
		return { subjects: [], edges: [], statusByCanonicalId: {} } satisfies {
			subjects: RetSubject[];
			edges: RetEdge[];
			statusByCanonicalId: Record<string, StudentProgressStatus>;
		};
	}

	const [subjectRows, edgeRows, progressRows] = await db.batch([
		db
			.select({
				canonicalId: subjects.canonicalId,
				code: subjects.code,
				name: subjects.name,
				semester: subjects.semester,
				credits: subjects.credits,
				seriationState: subjects.seriationState,
				component: subjects.component,
			})
			.from(subjects)
			.orderBy(asc(subjects.semester), asc(subjects.code)),
		db
			.select({
				from: subjectPrerequisites.prerequisiteCanonicalId,
				to: subjectPrerequisites.subjectCanonicalId,
			})
			.from(subjectPrerequisites),
		db
			.select({
				subjectCanonicalId: studentProgress.subjectCanonicalId,
				status: studentProgress.status,
			})
			.from(studentProgress)
			.where(eq(studentProgress.studentControlNumber, u.controlNumber)),
	]);

	// Build a quick lookup for "is every prerequisite of this subject
	// APPROVED?" — used to derive LOCKED vs AVAILABLE when the student
	// has no explicit row. Subjects the student has an APPROVED /
	// ENROLLED row for keep their row-level status; everything else
	// is AVAILABLE unless a prereq is missing, in which case LOCKED.
	const approvedSet = new Set<string>();
	for (const p of progressRows) {
		if (p.status === "APPROVED") approvedSet.add(p.subjectCanonicalId);
	}
	const statusByCanonicalId: Record<string, StudentProgressStatus> = {};
	for (const p of progressRows) {
		statusByCanonicalId[p.subjectCanonicalId] = p.status as StudentProgressStatus;
	}
	const incomingBySubject = new Map<string, string[]>();
	for (const e of edgeRows) {
		const arr = incomingBySubject.get(e.to) ?? [];
		arr.push(e.from);
		incomingBySubject.set(e.to, arr);
	}
	for (const s of subjectRows) {
		if (statusByCanonicalId[s.canonicalId]) continue; // already explicit
		const incoming = incomingBySubject.get(s.canonicalId) ?? [];
		const locked = incoming.some((p) => !approvedSet.has(p));
		statusByCanonicalId[s.canonicalId] = locked ? "LOCKED" : "AVAILABLE";
	}

	return {
		subjects: subjectRows.map((s) => ({
			...s,
			// SQLite stores TEXT; the domain unions are enforced here.
			seriationState: s.seriationState as SubjectSeriationState,
			component: s.component as SubjectComponent,
		})),
		edges: edgeRows,
		statusByCanonicalId,
	};
};

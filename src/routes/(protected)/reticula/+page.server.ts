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
 * Since T9.10 each subject also carries its `specialty_code`, whether that
 * specialty is the student's OWN (`inStudentSpecialty`, resolved here and
 * nowhere else), and whether the offering catalogue gives it a laboratory
 * (`hasLab`). The retícula renders the specialty modules in a tray outside
 * the grid because the plan does not publish the semester they are taken in
 * (H8); the other eleven specialties are never selected.
 *
 * PII trim (audit NEW-1) is preserved: we never serialize the full
 * `StudentProfile` row, only the fields the retícula needs — including the
 * specialty code, which is a curricular code and not a personal datum.
 */

import { env as workerEnv } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { getDb } from "#lib/server/db";
import {
	courseGroups,
	type StudentProgressStatus,
	type SubjectComponent,
	type SubjectSeriationState,
	studentProfiles,
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
	/** The module's specialty, from `subjects.specialty_code`. NULL for every
	 * non-specialty module. */
	specialtyCode: string | null;
	/** True only for the modules of the signed-in student's OWN specialty.
	 * The resolution happens here so the page cannot widen the tray: the
	 * other specialties belong to other programmes and must never render. */
	inStudentSpecialty: boolean;
	/** Derived from `course_groups.has_lab` — the SIM's flask marker on the
	 * offering catalogue. True when at least one group of the subject has a
	 * laboratory; see docs/data/sim-laboratorios.md for the six that do. */
	hasLab: boolean;
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

	const [subjectRows, edgeRows, progressRows, labRows, profileRows] = await db.batch([
		db
			.select({
				canonicalId: subjects.canonicalId,
				code: subjects.code,
				name: subjects.name,
				semester: subjects.semester,
				credits: subjects.credits,
				seriationState: subjects.seriationState,
				component: subjects.component,
				specialtyCode: subjects.specialtyCode,
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
		// One row per lab-bearing group; deduplicated into a Set below because
		// the offering catalogue holds dozens of them per subject and the
		// retícula only asks "does this subject have a laboratory at all".
		db
			.select({ subjectCanonicalId: courseGroups.subjectCanonicalId })
			.from(courseGroups)
			.where(eq(courseGroups.hasLab, true)),
		db
			.select({ specialtyCode: studentProfiles.specialtyCode })
			.from(studentProfiles)
			.where(eq(studentProfiles.controlNumber, u.controlNumber)),
	]);

	// A missing profile row yields `undefined`, and `undefined` never equals a
	// subject's `specialty_code` — so a student without a profile gets an empty
	// tray rather than an error.
	const studentSpecialtyCode = profileRows[0]?.specialtyCode ?? null;
	const labSubjectIds = new Set(labRows.map((r) => r.subjectCanonicalId));

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
			inStudentSpecialty: studentSpecialtyCode !== null && s.specialtyCode === studentSpecialtyCode,
			hasLab: labSubjectIds.has(s.canonicalId),
		})),
		edges: edgeRows,
		statusByCanonicalId,
	};
};

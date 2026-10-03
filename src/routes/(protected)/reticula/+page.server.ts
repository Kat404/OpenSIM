/**
 * OpenSIM — Retícula académica loader (Phase 3 Tarea 3.4).
 *
 * Loads the 42-subject catalog + the 57 prerequisite edges + the
 * student's `student_progress` (so each subject node can be colored
 * APPROVED / ENROLLED / AVAILABLE / LOCKED on the SVG). All three
 * queries share the same D1 binding and we batch into a single
 * `db.batch()` so the page renders after one network round-trip.
 *
 * PII trim (audit NEW-1) is preserved: we never serialize the full
 * `StudentProfile` row, only the fields the retícula needs.
 */

import { asc, eq } from 'drizzle-orm';
import { env as workerEnv } from 'cloudflare:workers';
import type { OpenSimWorkerEnv } from '../../../cloudflare-workers';
import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db';
import {
	studentProgress,
	subjectPrerequisites,
	subjects,
	type StudentProgressStatus
} from '#lib/server/db/schema';

const env = workerEnv as OpenSimWorkerEnv;

export interface RetSubject {
	canonicalId: string;
	code: string;
	name: string;
	semester: number;
	credits: number;
}

export interface RetEdge {
	from: string;
	to: string;
}

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user!;

	if (!env.DB) {
		return { subjects: [], edges: [], statusByCanonicalId: {} } satisfies {
			subjects: RetSubject[];
			edges: RetEdge[];
			statusByCanonicalId: Record<string, StudentProgressStatus>;
		};
	}

	const db = getDb(env.DB);

	const [subjectRows, edgeRows, progressRows] = await db.batch([
		db
			.select({
				canonicalId: subjects.canonicalId,
				code: subjects.code,
				name: subjects.name,
				semester: subjects.semester,
				credits: subjects.credits
			})
			.from(subjects)
			.orderBy(asc(subjects.semester), asc(subjects.code)),
		db
			.select({
				from: subjectPrerequisites.prerequisiteCanonicalId,
				to: subjectPrerequisites.subjectCanonicalId
			})
			.from(subjectPrerequisites),
		db
			.select({
				subjectCanonicalId: studentProgress.subjectCanonicalId,
				status: studentProgress.status
			})
			.from(studentProgress)
			.where(eq(studentProgress.studentControlNumber, u.controlNumber))
	]);

	// Build a quick lookup for "is every prerequisite of this subject
	// APPROVED?" — used to derive LOCKED vs AVAILABLE when the student
	// has no explicit row. Subjects the student has an APPROVED /
	// ENROLLED row for keep their row-level status; everything else
	// is AVAILABLE unless a prereq is missing, in which case LOCKED.
	const approvedSet = new Set<string>();
	for (const p of progressRows) {
		if (p.status === 'APPROVED') approvedSet.add(p.subjectCanonicalId);
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
		statusByCanonicalId[s.canonicalId] = locked ? 'LOCKED' : 'AVAILABLE';
	}

	return {
		subjects: subjectRows,
		edges: edgeRows,
		statusByCanonicalId
	};
};
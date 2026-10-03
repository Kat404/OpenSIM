/**
 * OpenSIM — Current-enrollment resolver (shared by dashboard and horario).
 *
 * Single source of truth for "what is this student currently enrolled
 * in this semester?" Both `/dashboard` (today's classes widget) and
 * `/horario` (weekly grid) call `getCurrentEnrollment` and then shape
 * the result to their own UI; no consumer hard-codes the
 * `status = 'ENROLLED'` filter, and no consumer falls back to
 * synthetic data when the answer is empty.
 *
 * The contract is intentionally minimal: groups + schedule blocks.
 * Pages that need `code` / `name` for the enrolled subjects query
 * `subjects` themselves (the catalog is small and stable, and adding
 * it here would force the dashboard to ignore the columns it doesn't
 * need). Keeping the helper narrow also makes it cheap to test.
 *
 * If a student has no `ENROLLED` rows, the helper returns empty
 * arrays — never a fallback. Pages are responsible for the
 * EmptyState.
 *
 * See: odd/tasks/opensim.md (Phase 3 dashboard + horario); audit H2 +
 * M1 (Round 4).
 */

import { and, eq, inArray } from 'drizzle-orm';
import { courseGroups, courseScheduleBlocks, studentProgress } from './db/schema';
import type { CourseGroup, CourseScheduleBlock } from './db/schema';
import type { Database } from './db';

export interface CurrentEnrollment {
	groups: CourseGroup[];
	schedule: CourseScheduleBlock[];
}

export async function getCurrentEnrollment(
	db: Database,
	controlNumber: string
): Promise<CurrentEnrollment> {
	const enrolled = await db
		.select({ subjectCanonicalId: studentProgress.subjectCanonicalId })
		.from(studentProgress)
		.where(
			and(
				eq(studentProgress.studentControlNumber, controlNumber),
				eq(studentProgress.status, 'ENROLLED')
			)
		);

	if (enrolled.length === 0) {
		return { groups: [], schedule: [] };
	}

	const enrolledIds = enrolled.map((r) => r.subjectCanonicalId);
	const groups = await db
		.select()
		.from(courseGroups)
		.where(inArray(courseGroups.subjectCanonicalId, enrolledIds));

	if (groups.length === 0) {
		return { groups: [], schedule: [] };
	}

	const groupIds = groups.map((g) => g.id);
	const schedule = await db
		.select()
		.from(courseScheduleBlocks)
		.where(inArray(courseScheduleBlocks.groupId, groupIds));

	return { groups, schedule };
}

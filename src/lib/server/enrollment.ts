/**
 * OpenSIM — Current-enrollment resolver (shared by dashboard and horario).
 *
 * Single source of truth for "what is this student currently enrolled
 * in this period?" Both `/dashboard` (today's classes widget) and
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
 * Period semantics (Tarea 4.1, N6):
 *   - The optional `period` argument filters `student_progress` to a
 *     single period string (e.g. "AGOSTO-DICIEMBRE/2026").
 *   - When omitted, `getCurrentPeriod` picks the most recent period
 *     present in the student's progress rows. The most recent period
 *     is the lexicographic maximum — period strings sort the same way
 *     chronologically because the year suffix and the month order
 *     (AGOSTO > ENERO) line up with the ASCII order.
 *   - If the student has no progress rows, `getCurrentPeriod` returns
 *     `null` and `getCurrentEnrollment` returns empty arrays — pages
 *     are responsible for the EmptyState.
 *
 * See: odd/tasks/opensim.md (Phase 3 dashboard + horario; Phase 4.1 N6);
 * audit H2 + M1 (Round 4).
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "./db";
import type { CourseGroup, CourseScheduleBlock } from "./db/schema";
import { courseGroups, courseScheduleBlocks, studentProgress } from "./db/schema";

export interface CurrentEnrollment {
	groups: CourseGroup[];
	schedule: CourseScheduleBlock[];
	/** The period the result is filtered to. `null` when the student has no progress rows. */
	period: string | null;
}

/**
 * Returns the period string the student is *actively enrolled* in
 * "right now", defined as the most recent `student_progress.period`
 * value with `status = 'ENROLLED'` for the given control number.
 *
 * The filter is intentional: a future LOCKED row (the student has a
 * placeholder for next year's Servicio Social, say) has a period
 * string that sorts *after* the current ENROLLED period, so a
 * "max(period)" query would jump to next year. Pinning the lookup
 * to `status = 'ENROLLED'` is what makes "current" mean current.
 *
 * The result drives both the dashboard and the horario page so a
 * student with mixed-semester history always sees the latest
 * semester's classes (audit M1 fix).
 *
 * Returns `null` when the student has no ENROLLED rows — pages
 * branch on the null and render the EmptyState.
 */
export async function getCurrentPeriod(
	db: Database,
	controlNumber: string,
): Promise<string | null> {
	const rows = await db
		.select({ period: studentProgress.period })
		.from(studentProgress)
		.where(
			and(
				eq(studentProgress.studentControlNumber, controlNumber),
				eq(studentProgress.status, "ENROLLED"),
			),
		)
		.orderBy(desc(studentProgress.period))
		.limit(1);
	return rows[0]?.period ?? null;
}

/**
 * Returns the groups + schedule blocks for the student's enrollment
 * in `period`. When `period` is omitted, the most recent period the
 * student is enrolled in is used (via `getCurrentPeriod`).
 *
 * Pages that need to fix a period across requests (e.g. a PDF
 * generator that wants "this student's current semester") can pass
 * an explicit period string and skip the "most recent" lookup.
 */
export async function getCurrentEnrollment(
	db: Database,
	controlNumber: string,
	period?: string,
): Promise<CurrentEnrollment> {
	const effectivePeriod = period ?? (await getCurrentPeriod(db, controlNumber));
	if (!effectivePeriod) {
		return { groups: [], schedule: [], period: null };
	}

	const enrolled = await db
		.select({ subjectCanonicalId: studentProgress.subjectCanonicalId })
		.from(studentProgress)
		.where(
			and(
				eq(studentProgress.studentControlNumber, controlNumber),
				eq(studentProgress.status, "ENROLLED"),
				eq(studentProgress.period, effectivePeriod),
			),
		);

	if (enrolled.length === 0) {
		return { groups: [], schedule: [], period: effectivePeriod };
	}

	const enrolledIds = enrolled.map((r) => r.subjectCanonicalId);
	// The subject filter alone also matches the SIM offering catalogue,
	// which shares this table: a student in one subject of a semester would
	// be handed every offering group of it. `student_control_number` is the
	// discriminator — NULL there, this student's control number here.
	const groups = await db
		.select()
		.from(courseGroups)
		.where(
			and(
				eq(courseGroups.studentControlNumber, controlNumber),
				inArray(courseGroups.subjectCanonicalId, enrolledIds),
			),
		);

	if (groups.length === 0) {
		return { groups: [], schedule: [], period: effectivePeriod };
	}

	const groupIds = groups.map((g) => g.id);
	const schedule = await db
		.select()
		.from(courseScheduleBlocks)
		.where(inArray(courseScheduleBlocks.groupId, groupIds));

	return { groups, schedule, period: effectivePeriod };
}

/**
 * Most recent period in the student's academic history, regardless of
 * status. Unlike `getCurrentPeriod` this does not require an ENROLLED
 * row, so it also resolves for a student whose only rows are APPROVED
 * or FAILED from earlier terms — the case where "which term am I in?"
 * is unanswerable from active enrollment alone.
 *
 * Returns null only for a student with no progress rows at all.
 */
export async function getLatestProgressPeriod(
	db: Database,
	controlNumber: string,
): Promise<string | null> {
	const rows = await db
		.select({ period: studentProgress.period })
		.from(studentProgress)
		.where(eq(studentProgress.studentControlNumber, controlNumber))
		.orderBy(desc(studentProgress.period))
		.limit(1);
	return rows[0]?.period ?? null;
}

/**
 * The current academic period using the institution's term names:
 * `AGOSTO-DICIEMBRE/<year>` for August through December and
 * `ENERO-JUNIO/<year>` for January through June.
 *
 * Derived from the calendar so a brand-new student has a term to enrol
 * into without any prior rows. July resolves to the January–June term
 * that follows, since the August session has not opened yet.
 */
export function currentAcademicPeriod(now: Date = new Date()): string {
	const month = now.getMonth(); // 0 = January
	const year = now.getFullYear();
	if (month >= 7) return `AGOSTO-DICIEMBRE/${year}`;
	return `ENERO-JUNIO/${month >= 6 ? year + 1 : year}`;
}

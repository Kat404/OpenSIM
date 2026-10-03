/**
 * OpenSIM — Horario semanal loader (Phase 3 Tarea 3.3).
 *
 * Resolves the current student's enrolled subjects (status =
 * 'ENROLLED' in `student_progress`) into a list of scheduled class
 * blocks joined with the subjects catalog. If the student has no real
 * enrollment yet (the seed for `<NUMERO DE CONTROL PURGADO>` does not), we synthesize a
 * small visual sample of 3-4 classes from existing first-semester
 * subject codes so the page renders something useful for the smoke
 * test. Phase 4 will wire the real enrollment loader for `/horario`.
 *
 * The visual contract of the page (height = end - start in 60px/hour
 * pixels, color from HSL hash) is satisfied by either path; the
 * data shape is the same.
 */

import { asc, eq, inArray } from 'drizzle-orm';
import { env as workerEnv } from 'cloudflare:workers';
import type { OpenSimWorkerEnv } from '../../../cloudflare-workers';
import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db';
import {
	studentProgress,
	courseGroups,
	courseScheduleBlocks,
	subjects
} from '#lib/server/db/schema';

const env = workerEnv as OpenSimWorkerEnv;

export type DayLetter = 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D';

interface ScheduledClassItem {
	subject: { code: string; name: string; canonicalId: string };
	block: { day: DayLetter; startTime: string; endTime: string; classroom: string };
}

// Visual sample used when the test student has no real enrollment.
// Hard-coded to 4 classes on existing canonical ids so the grid renders
// proportional-height blocks on day-1 smoke test. Lives behind an
// explicit "synthetic" flag so Phase 4 can replace the loader cleanly.
const SYNTHETIC_SAMPLE: { subjectCanonicalId: string; day: DayLetter; startTime: string; endTime: string; classroom: string }[] = [
	{ subjectCanonicalId: 'calculo-diferencial', day: 'L', startTime: '07:00', endTime: '09:00', classroom: 'A-101' },
	{ subjectCanonicalId: 'fundamentos-programacion', day: 'M', startTime: '09:00', endTime: '11:00', classroom: 'L-202' },
	{ subjectCanonicalId: 'matematicas-discretas', day: 'X', startTime: '11:00', endTime: '12:30', classroom: 'A-103' },
	{ subjectCanonicalId: 'introduccion-ingenieria-sistemas', day: 'J', startTime: '13:00', endTime: '14:30', classroom: 'A-104' }
];

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user!;

	if (!env.DB) {
		return { schedule: [], synthetic: true } satisfies { schedule: ScheduledClassItem[]; synthetic: boolean };
	}

	const db = getDb(env.DB);

	// Find the student's enrolled subjects, if any.
	const enrolled = await db
		.select({ subjectCanonicalId: studentProgress.subjectCanonicalId })
		.from(studentProgress)
		.where(eq(studentProgress.studentControlNumber, u.controlNumber));

	const realEnrolled = enrolled.length > 0;

	// Decide which canonical ids drive the schedule.
	const targetIds = realEnrolled
		? enrolled.map((r) => r.subjectCanonicalId)
		: SYNTHETIC_SAMPLE.map((s) => s.subjectCanonicalId);

	if (targetIds.length === 0) {
		return { schedule: [], synthetic: !realEnrolled } satisfies { schedule: ScheduledClassItem[]; synthetic: boolean };
	}

	// Subjects catalog (canonicalId + code + name) for the targets.
	const subjectRows = await db
		.select({ canonicalId: subjects.canonicalId, code: subjects.code, name: subjects.name })
		.from(subjects)
		.where(inArray(subjects.canonicalId, targetIds))
		.orderBy(asc(subjects.code));

	const codeByCanonical = new Map<string, { code: string; name: string }>();
	for (const s of subjectRows) codeByCanonical.set(s.canonicalId, { code: s.code, name: s.name });

	let schedule: ScheduledClassItem[] = [];

	if (realEnrolled) {
		// Join course_groups and schedule_blocks for the enrolled set.
		const groups = await db
			.select({ id: courseGroups.id, subjectCanonicalId: courseGroups.subjectCanonicalId })
			.from(courseGroups)
			.where(inArray(courseGroups.subjectCanonicalId, targetIds));
		const groupIds = groups.map((g) => g.id);
		const groupToCanonical = new Map<string, string>();
		for (const g of groups) groupToCanonical.set(g.id, g.subjectCanonicalId);

		if (groupIds.length > 0) {
			const blocks = await db
				.select({
					groupId: courseScheduleBlocks.groupId,
					day: courseScheduleBlocks.day,
					startTime: courseScheduleBlocks.startTime,
					endTime: courseScheduleBlocks.endTime,
					classroom: courseScheduleBlocks.classroom
				})
				.from(courseScheduleBlocks)
				.where(inArray(courseScheduleBlocks.groupId, groupIds));

			schedule = blocks
				.map((b) => {
					const canonical = groupToCanonical.get(b.groupId);
					if (!canonical) return null;
					const info = codeByCanonical.get(canonical);
					if (!info) return null;
					const day = b.day.toUpperCase();
					if (!['L', 'M', 'X', 'J', 'V', 'S', 'D'].includes(day)) return null;
					return {
						subject: { canonicalId: canonical, code: info.code, name: info.name },
						block: {
							day: day as DayLetter,
							startTime: b.startTime,
							endTime: b.endTime,
							classroom: b.classroom
						}
					} satisfies ScheduledClassItem;
				})
				.filter((x): x is ScheduledClassItem => x !== null);
		}
	} else {
		// Synthesize visual schedule for the smoke test.
		schedule = SYNTHETIC_SAMPLE.flatMap((s) => {
			const info = codeByCanonical.get(s.subjectCanonicalId);
			if (!info) return [];
			return [
				{
					subject: {
						canonicalId: s.subjectCanonicalId,
						code: info.code,
						name: info.name
					},
					block: {
						day: s.day,
						startTime: s.startTime,
						endTime: s.endTime,
						classroom: s.classroom
					}
				} satisfies ScheduledClassItem
			];
		});
	}

	// Stable order so SSR and CSR agree on the DOM tree.
	schedule.sort((a, b) => {
		const dayOrder = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
		const ad = dayOrder.indexOf(a.block.day);
		const bd = dayOrder.indexOf(b.block.day);
		if (ad !== bd) return ad - bd;
		return a.block.startTime.localeCompare(b.block.startTime);
	});

	return { schedule, synthetic: !realEnrolled };
};
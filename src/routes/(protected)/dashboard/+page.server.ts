/**
 * OpenSIM — Dashboard data loader (Phase 3 Tarea 3.2).
 *
 * Loads the four headline KPIs plus the today's-classes widget data
 * in a single `db.batch()` round trip so we incur one network hop to
 * D1, not five. Per audit NEW-1, every query uses an explicit column
 * allow-list — we never hydrate the full `StudentProfile` row client-
 * side (CURP / birthState stay server-only).
 *
 * The `todayClasses` join is best-effort: if the seed does not have a
 * real enrollment for `<NUMERO DE CONTROL PURGADO>` yet, we return an empty list and the
 * widget renders the EmptyState. The card on the page invites the
 * student to keep exploring the retícula meanwhile.
 */

import { asc, eq, inArray, and } from 'drizzle-orm';
import { env as workerEnv } from 'cloudflare:workers';
import type { OpenSimWorkerEnv } from '../../../cloudflare-workers';
import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db';
import {
	studentProfiles,
	studentProgress,
	courseGroups,
	courseScheduleBlocks,
	subjects
} from '#lib/server/db/schema';

const env = workerEnv as OpenSimWorkerEnv;

// Day-of-week -> Spanish single-letter abbreviation. The seed schedule
// blocks use these exact strings (see src/lib/server/db/seed.sql and
// the eventual enrollment loader for Phase 4).
const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;
type DayLetter = (typeof DAY_LETTERS)[number];

function todayDayLetter(now: Date): DayLetter {
	return DAY_LETTERS[now.getDay()] as DayLetter;
}

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user!;
	const controlNumber = u.controlNumber;
	const today = todayDayLetter(new Date());

	if (!env.DB) {
		// Without a DB we can't compute KPIs; return a safe fallback
		// that still satisfies the page's typed contract.
		return {
			firstName: u.fullName.split(/\s+/)[0] ?? u.fullName,
			kpis: {
				certifiedAverage: u.certifiedAverage,
				arithmeticAverage: u.arithmeticAverage,
				approvedCredits: u.approvedCredits,
				totalCredits: u.approvedCredits + u.remainingCredits,
				advancePercentage: u.advancePercentage
			},
			todayClasses: [] as {
				code: string;
				name: string;
				subjectCanonicalId: string;
				startTime: string;
				endTime: string;
				classroom: string;
			}[],
			hasEnrollment: false,
			dayLabel: 'hoy'
		};
	}

	const db = getDb(env.DB);

	// One round trip. Drizzle's `db.batch` issues the statements as a
	// single HTTP request to D1 (saving 4 round trips vs sequential
	// awaits). All five statements are read-only.
	const [profileRows, progressRows, enrollments] = await db.batch([
		db
			.select({
				controlNumber: studentProfiles.controlNumber,
				certifiedAverage: studentProfiles.certifiedAverage,
				arithmeticAverage: studentProfiles.arithmeticAverage,
				passedAverage: studentProfiles.passedAverage,
				approvedCredits: studentProfiles.approvedCredits,
				remainingCredits: studentProfiles.remainingCredits,
				completedCredits: studentProfiles.completedCredits,
				advancePercentage: studentProfiles.advancePercentage
			})
			.from(studentProfiles)
			.where(eq(studentProfiles.controlNumber, controlNumber))
			.limit(1),
		db
			.select({
				subjectCanonicalId: studentProgress.subjectCanonicalId,
				status: studentProgress.status
			})
			.from(studentProgress)
			.where(eq(studentProgress.studentControlNumber, controlNumber)),
		// Resolve the student's current enrollment through
		// student_progress + course_groups in two batched statements: first
		// the set of canonical ids with an in-progress subject, then the
		// matching course_groups. Both join on subjectCanonicalId so
		// the second is a single index hit per row.
		db
			.select({ subjectCanonicalId: studentProgress.subjectCanonicalId })
			.from(studentProgress)
			.where(
				and(
					eq(studentProgress.studentControlNumber, controlNumber),
					eq(studentProgress.status, 'ENROLLED')
				)
			)
	]);

	const profile = profileRows[0] ?? {
		controlNumber,
		certifiedAverage: u.certifiedAverage,
		arithmeticAverage: u.arithmeticAverage,
		passedAverage: 0,
		approvedCredits: u.approvedCredits,
		remainingCredits: u.remainingCredits,
		completedCredits: u.completedCredits,
		advancePercentage: u.advancePercentage
	};

	const enrolledIds = enrollments.map((r) => r.subjectCanonicalId);
	let todayClasses: {
		code: string;
		name: string;
		subjectCanonicalId: string;
		startTime: string;
		endTime: string;
		classroom: string;
	}[] = [];

	if (enrolledIds.length > 0) {
		// Second mini-batch: course_groups + schedule_blocks + subject
		// details, filtered to the enrolled set. Done as a follow-up so
		// the first batch stays small and predictable.
		const [groups, blocks, subjectRows] = await db.batch([
			db
				.select({
					id: courseGroups.id,
					subjectCanonicalId: courseGroups.subjectCanonicalId
				})
				.from(courseGroups)
				.where(inArray(courseGroups.subjectCanonicalId, enrolledIds)),
			db
				.select({
					id: courseScheduleBlocks.id,
					groupId: courseScheduleBlocks.groupId,
					day: courseScheduleBlocks.day,
					startTime: courseScheduleBlocks.startTime,
					endTime: courseScheduleBlocks.endTime,
					classroom: courseScheduleBlocks.classroom
				})
				.from(courseScheduleBlocks)
				.where(eq(courseScheduleBlocks.day, today)),
			db
				.select({
					canonicalId: subjects.canonicalId,
					code: subjects.code,
					name: subjects.name
				})
				.from(subjects)
				.where(inArray(subjects.canonicalId, enrolledIds))
		]);

		const groupIdToCanonical = new Map<string, string>();
		for (const g of groups) groupIdToCanonical.set(g.id, g.subjectCanonicalId);
		const canonicalInfo = new Map<string, { code: string; name: string }>();
		for (const s of subjectRows) canonicalInfo.set(s.canonicalId, { code: s.code, name: s.name });

		todayClasses = blocks
			.map((b) => {
				const canonical = groupIdToCanonical.get(b.groupId);
				if (!canonical) return null;
				const info = canonicalInfo.get(canonical);
				if (!info) return null;
				return {
					code: info.code,
					name: info.name,
					subjectCanonicalId: canonical,
					startTime: b.startTime,
					endTime: b.endTime,
					classroom: b.classroom
				};
			})
			.filter((x): x is NonNullable<typeof x> => x !== null)
			.sort((a, b) => a.startTime.localeCompare(b.startTime));
	}

	return {
		firstName: u.fullName.split(/\s+/)[0] ?? u.fullName,
		kpis: {
			certifiedAverage: profile.certifiedAverage,
			arithmeticAverage: profile.arithmeticAverage,
			approvedCredits: profile.approvedCredits,
			totalCredits: profile.approvedCredits + profile.remainingCredits,
			advancePercentage: profile.advancePercentage
		},
		todayClasses,
		hasEnrollment: progressRows.length > 0,
		dayLabel: 'hoy',
		// Unused on the page itself, kept so child routes that compose
		// the dashboard (e.g. an export view) can still inspect raw rows.
		_enrolledIds: enrolledIds
	};
};
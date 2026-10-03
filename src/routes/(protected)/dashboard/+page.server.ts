/**
 * OpenSIM — Dashboard data loader (Phase 3 Tarea 3.2).
 *
 * Loads the four headline KPIs plus the today's-classes widget data
 * in two batched round trips to D1. Per audit NEW-1, every query
 * uses an explicit column allow-list — we never hydrate the full
 * `StudentProfile` row client-side (CURP / birthState stay
 * server-only).
 *
 * The enrollment lookup goes through `getCurrentEnrollment` (shared
 * with `/horario`) so the "is this student enrolled?" check is
 * defined in exactly one place: `status === 'ENROLLED'` in
 * `student_progress`. The previous version counted all progress
 * rows (audit M1), which made a fully-approved student with no
 * current enrollment look enrolled.
 *
 * See: odd/tasks/opensim.md (Phase 3 dashboard + horario); audit
 * H2 + M1 (Round 4).
 */

import { eq, inArray } from 'drizzle-orm';
import { env as workerEnv } from 'cloudflare:workers';
import type { OpenSimWorkerEnv } from '../../../cloudflare-workers';
import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db';
import { studentProfiles, subjects } from '#lib/server/db/schema';
import { getCurrentEnrollment } from '#lib/server/enrollment';
import { getTodayDayLetter } from '#lib/utils/time';

const env = workerEnv as OpenSimWorkerEnv;

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user!;
	const controlNumber = u.controlNumber;
	// Morelia is UTC-6 with no DST; the helper pins the day-letter
	// computation to America/Mexico_City so a Friday-evening query
	// does not silently land on Saturday (audit H4, Round 4).
	const todayLetter = getTodayDayLetter();

	if (!env.DB) {
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

	const [profileRows, enrollment] = await Promise.all([
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
		getCurrentEnrollment(db, controlNumber)
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

	// Today's classes: filter the enrollment's schedule blocks to the
	// letter of the current weekday in Morelia (see `time.ts`).
	const todayClasses: {
		code: string;
		name: string;
		subjectCanonicalId: string;
		startTime: string;
		endTime: string;
		classroom: string;
	}[] = [];

	if (enrollment.schedule.length > 0) {
		const groupToCanonical = new Map<string, string>();
		for (const g of enrollment.groups) groupToCanonical.set(g.id, g.subjectCanonicalId);
		const enrolledIds = Array.from(new Set(groupToCanonical.values()));
		const subjectRows = await db
			.select({ canonicalId: subjects.canonicalId, code: subjects.code, name: subjects.name })
			.from(subjects)
			.where(inArray(subjects.canonicalId, enrolledIds));
		const codeByCanonical = new Map<string, { code: string; name: string }>();
		for (const s of subjectRows) codeByCanonical.set(s.canonicalId, { code: s.code, name: s.name });

		for (const b of enrollment.schedule) {
			if (b.day.toUpperCase() !== todayLetter) continue;
			const canonical = groupToCanonical.get(b.groupId);
			if (!canonical) continue;
			const info = codeByCanonical.get(canonical);
			if (!info) continue;
			todayClasses.push({
				code: info.code,
				name: info.name,
				subjectCanonicalId: canonical,
				startTime: b.startTime,
				endTime: b.endTime,
				classroom: b.classroom
			});
		}
		todayClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));
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
		// `hasEnrollment` reflects active enrollment only (status =
		// 'ENROLLED'); see `getCurrentEnrollment` for the single
		// source of truth.
		hasEnrollment: enrollment.groups.length > 0,
		dayLabel: 'hoy'
	};
};

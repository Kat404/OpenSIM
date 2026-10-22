/**
 * OpenSIM — Dashboard data loader (Phase 3 Tarea 3.2; Phase 4 N6).
 *
 * Loads the four headline KPIs plus the week widget's data
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
 * Phase 4 N6: the helper now returns the resolved period so the
 * page can render "Periodo actual: {period}" without re-querying.
 *
 * S5 (2026-10-22): the widget shows the student's WHOLE week, not
 * only today's blocks — the dashboard's short column left ~360px of
 * empty page under a widget that had nothing else to show. The week
 * comes from the same enrolment and the same subject query `/horario`
 * uses; today's slice is still published for the loader's contract.
 *
 * See: odd/tasks/opensim.md (Phase 3 dashboard + horario; Phase 4.1 N6);
 * audit H2 + M1 (Round 4).
 */

import { env as workerEnv } from "cloudflare:workers";
import { redirect } from "@sveltejs/kit";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "#lib/server/db";
import { studentProfiles, subjects } from "#lib/server/db/schema";
import { getCurrentEnrollment, getCurrentPeriod } from "#lib/server/enrollment";
import { type DayLetter, getTodayDayLetter } from "#lib/utils/time";
import type { OpenSimWorkerEnv } from "../../../cloudflare-workers";
import type { PageServerLoad } from "./$types";

const env = workerEnv as OpenSimWorkerEnv;

/** The day letters the TecNM grid uses, in the order the week runs. */
const DAY_LETTERS: ReadonlySet<DayLetter> = new Set(["L", "M", "X", "J", "V", "S", "D"]);
const DAY_ORDER: Record<DayLetter, number> = { L: 0, M: 1, X: 2, J: 3, V: 4, S: 5, D: 6 };

/** One class block of the student's current enrolment. */
export interface WeekClass {
	code: string;
	name: string;
	subjectCanonicalId: string;
	day: DayLetter;
	startTime: string;
	endTime: string;
	classroom: string;
}

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user;
	if (!u) throw redirect(302, "/login");
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
				advancePercentage: u.advancePercentage,
			},
			weekClasses: [] as WeekClass[],
			todayClasses: [] as WeekClass[],
			today: todayLetter,
			hasEnrollment: false,
			period: null,
		};
	}

	const db = getDb(env.DB);

	// Phase 4 N6: resolve the current period once, then pass it
	// explicitly to the enrollment helper. The two queries can run
	// in parallel; the period is also surfaced to the page so the
	// header can render "Periodo actual: {period}".
	const currentPeriod = await getCurrentPeriod(db, controlNumber);

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
				advancePercentage: studentProfiles.advancePercentage,
			})
			.from(studentProfiles)
			.where(eq(studentProfiles.controlNumber, controlNumber))
			.limit(1),
		getCurrentEnrollment(db, controlNumber, currentPeriod ?? undefined),
	]);

	const profile = profileRows[0] ?? {
		controlNumber,
		certifiedAverage: u.certifiedAverage,
		arithmeticAverage: u.arithmeticAverage,
		passedAverage: 0,
		approvedCredits: u.approvedCredits,
		remainingCredits: u.remainingCredits,
		completedCredits: u.completedCredits,
		advancePercentage: u.advancePercentage,
	};

	// The student's WHOLE week: every block of the current enrolment,
	// joined with the catalogue for the subject's code and name — the
	// same query shape /horario uses, because it is the same question.
	// The day letter comes from the block itself; a letter outside the
	// TecNM grid is dropped with a warning, so a class nobody can see
	// does not vanish without a trace.
	const weekClasses: WeekClass[] = [];

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
			const canonical = groupToCanonical.get(b.groupId);
			if (!canonical) continue;
			const info = codeByCanonical.get(canonical);
			if (!info) continue;
			const day = b.day.toUpperCase();
			if (!DAY_LETTERS.has(day as DayLetter)) {
				console.warn(`[dashboard] dropping a block with an unknown day letter: "${b.day}"`);
				continue;
			}
			weekClasses.push({
				code: info.code,
				name: info.name,
				subjectCanonicalId: canonical,
				day: day as DayLetter,
				startTime: b.startTime,
				endTime: b.endTime,
				classroom: b.classroom,
			});
		}
		// Stable order so SSR and CSR agree on the DOM tree.
		weekClasses.sort((a, b) => {
			const ad = DAY_ORDER[a.day];
			const bd = DAY_ORDER[b.day];
			if (ad !== bd) return ad - bd;
			return a.startTime.localeCompare(b.startTime);
		});
	}

	// Today's slice of the same week. The widget renders the whole week,
	// but the loader still publishes today's slice: it is part of this
	// loader's published contract (tests/unit/protected-loaders.test.ts).
	const todayClasses = weekClasses.filter((c) => c.day === todayLetter);

	return {
		firstName: u.fullName.split(/\s+/)[0] ?? u.fullName,
		kpis: {
			certifiedAverage: profile.certifiedAverage,
			arithmeticAverage: profile.arithmeticAverage,
			approvedCredits: profile.approvedCredits,
			totalCredits: profile.approvedCredits + profile.remainingCredits,
			advancePercentage: profile.advancePercentage,
		},
		weekClasses,
		todayClasses,
		// The day the student is in right now, in Morelia (see `time.ts`).
		today: todayLetter,
		// `hasEnrollment` reflects active enrollment only (status =
		// 'ENROLLED'); see `getCurrentEnrollment` for the single
		// source of truth.
		hasEnrollment: enrollment.groups.length > 0,
		period: enrollment.period,
	};
};

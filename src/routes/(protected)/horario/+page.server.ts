/**
 * OpenSIM — Horario semanal loader (Phase 3 Tarea 3.3; Phase 4 N6; T9.11).
 *
 * Resolves the current student's enrolled subjects through
 * `getCurrentEnrollment` (shared with the dashboard) and joins them
 * with the subjects catalog so the TimeGridSchedule component can
 * render the weekly grid. Empty enrollments are returned as empty
 * arrays — the page renders an EmptyState with no synthetic data.
 *
 * Per audit H2 (Round 4): the previous loader served a hard-coded
 * 4-class sample whenever the seed had no enrollment, which made the
 * page *always* show invented data. The unified enrollment helper
 * makes that branch impossible.
 *
 * Phase 4 N6: the loader passes an explicit period to the helper
 * (resolved by `getCurrentPeriod` first) and surfaces the period
 * to the page so the header can render "Periodo actual: {period}".
 *
 * T9.11: an enrolled group with NO schedule block is real data with a
 * known cause (H11) — the SIM publishes a group's classroom and hours
 * only after the student enrols in it, so an enrolment whose blocks
 * have not landed yet is normal, not a rendering failure. Those groups
 * come back in `pending` so the page can SAY so, instead of showing an
 * empty grid that reads as "you have no classes".
 *
 * The visual contract of the page (height = end - start in 60px/hour
 * pixels, color from theme-aware HSL hash) is satisfied by the
 * ScheduleDay-letter array; the data shape is what the grid expects.
 */

import { env as workerEnv } from "cloudflare:workers";
import { asc, inArray } from "drizzle-orm";
import { getDb } from "#lib/server/db";
import { subjects } from "#lib/server/db/schema";
import { getCurrentEnrollment, getCurrentPeriod } from "#lib/server/enrollment";
import type { OpenSimWorkerEnv } from "../../../cloudflare-workers";
import type { PageServerLoad } from "./$types";

const env = workerEnv as OpenSimWorkerEnv;

export type DayLetter = "L" | "M" | "X" | "J" | "V" | "S" | "D";

const DAY_LETTERS: ReadonlySet<DayLetter> = new Set(["L", "M", "X", "J", "V", "S", "D"]);

interface ScheduledClassItem {
	subject: { code: string; name: string; canonicalId: string };
	block: { day: DayLetter; startTime: string; endTime: string; classroom: string };
}

/** An enrolled group whose classroom and hours the SIM has not published. */
interface PendingGroupItem {
	subject: { code: string; name: string; canonicalId: string };
	group: { id: string; groupCode: string; teacherName: string };
}

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user;
	if (!u) {
		return {
			schedule: [] as ScheduledClassItem[],
			pending: [] as PendingGroupItem[],
			period: null,
		};
	}

	if (!env.DB) {
		return {
			schedule: [] as ScheduledClassItem[],
			pending: [] as PendingGroupItem[],
			period: null,
		};
	}

	const db = getDb(env.DB);
	const controlNumber = u.controlNumber;
	const currentPeriod = await getCurrentPeriod(db, controlNumber);
	const enrollment = await getCurrentEnrollment(db, controlNumber, currentPeriod ?? undefined);

	if (enrollment.groups.length === 0) {
		return {
			schedule: [] as ScheduledClassItem[],
			pending: [] as PendingGroupItem[],
			period: enrollment.period,
		};
	}

	// Subjects catalog for the enrolled set. `groupToCanonical` maps
	// each group back to its subject so the join is a constant-time
	// map lookup in the loop below.
	const groupToCanonical = new Map<string, string>();
	for (const g of enrollment.groups) groupToCanonical.set(g.id, g.subjectCanonicalId);

	const enrolledIds = Array.from(new Set(groupToCanonical.values()));
	const subjectRows = await db
		.select({ canonicalId: subjects.canonicalId, code: subjects.code, name: subjects.name })
		.from(subjects)
		.where(inArray(subjects.canonicalId, enrolledIds))
		.orderBy(asc(subjects.code));

	const codeByCanonical = new Map<string, { code: string; name: string }>();
	for (const s of subjectRows) codeByCanonical.set(s.canonicalId, { code: s.code, name: s.name });

	const schedule: ScheduledClassItem[] = [];
	for (const b of enrollment.schedule) {
		const canonical = groupToCanonical.get(b.groupId);
		if (!canonical) continue;
		const info = codeByCanonical.get(canonical);
		if (!info) continue;
		const day = b.day.toUpperCase();
		if (!DAY_LETTERS.has(day as DayLetter)) continue;
		schedule.push({
			subject: { canonicalId: canonical, code: info.code, name: info.name },
			block: {
				day: day as DayLetter,
				startTime: b.startTime,
				endTime: b.endTime,
				classroom: b.classroom,
			},
		});
	}

	// T9.11 — a group is pending when the enrolment carries no block for
	// it. `getCurrentEnrollment` already scoped `groups` to this student's
	// OWN enrolments (`student_control_number` set), so a catalogue row
	// with NULL there can never reach this loop and paint phantom classes.
	const scheduledGroupIds = new Set(enrollment.schedule.map((b) => b.groupId));
	const pending: PendingGroupItem[] = [];
	for (const g of enrollment.groups) {
		if (scheduledGroupIds.has(g.id)) continue;
		const canonical = groupToCanonical.get(g.id);
		if (!canonical) continue;
		const info = codeByCanonical.get(canonical);
		if (!info) continue;
		pending.push({
			subject: { canonicalId: canonical, code: info.code, name: info.name },
			group: { id: g.id, groupCode: g.groupCode, teacherName: g.teacherName },
		});
	}
	pending.sort((a, b) => a.subject.code.localeCompare(b.subject.code));

	// Stable order so SSR and CSR agree on the DOM tree.
	const dayOrder: Record<DayLetter, number> = { L: 0, M: 1, X: 2, J: 3, V: 4, S: 5, D: 6 };
	schedule.sort((a, b) => {
		const ad = dayOrder[a.block.day];
		const bd = dayOrder[b.block.day];
		if (ad !== bd) return ad - bd;
		return a.block.startTime.localeCompare(b.block.startTime);
	});

	return { schedule, pending, period: enrollment.period };
};

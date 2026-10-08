/**
 * OpenSIM — Simulador de Reinscripción (Phase 4 Tarea 4.1).
 *
 * The simulator lets a student browse the available course groups
 * for the current period, filter by subject area / credits / text,
 * see the live schedule preview (with conflicts highlighted), and
 * commit a single signature that enrolls them in the selected set.
 *
 * Data flow:
 *   1. Resolve the current period via `getCurrentPeriod`.
 *   2. Read the full `course_groups` catalog (joined with `subjects`
 *      so the UI can render area / credits / name without a second
 *      round-trip) — this is the "oferta" the filter operates on.
 *   3. Read the student's already-enrolled subjects (same period)
 *      so the page can mark them as taken and exclude them from
 *      the selection list.
 *   4. Read every schedule block for the offer + the already-
 *      enrolled groups so the page can render the schedule preview
 *      and run the conflict detector client-side without further
 *      fetches.
 *
 * All three queries are routed through D1 in parallel; the page is
 * server-rendered so the initial paint already shows the real
 * catalog (no client-side spinner on first load).
 *
 * The "Inscribir y firmar" form action below accepts a list of
 * `groupId`s, validates the selection (no duplicates, no already-
 * enrolled groups, no conflicts), inserts the corresponding
 * `student_progress` rows in a single `db.batch()`, and redirects to
 * `/dashboard?enrolled=1` on success.
 *
 * See: odd/tasks/opensim.md Tarea 4.1.
 */

import { env as workerEnv } from "cloudflare:workers";
import { type Actions, fail, redirect } from "@sveltejs/kit";
import { and, eq, inArray } from "drizzle-orm";
import type { OfferBlock, OfferGroup } from "#lib/components/simulador/types";
import { getDb } from "#lib/server/db";
import {
	courseGroups,
	courseScheduleBlocks,
	studentProgress,
	subjects,
} from "#lib/server/db/schema";
import { currentAcademicPeriod, getLatestProgressPeriod } from "#lib/server/enrollment";
import { findConflicts } from "#lib/utils/schedule-conflict";
import type { OpenSimWorkerEnv } from "../../../cloudflare-workers";
import type { PageServerLoad } from "./$types";

const env = workerEnv as OpenSimWorkerEnv;

export const load: PageServerLoad = async ({ locals, url }) => {
	// The (protected) layout's middleware is what normally populates
	// `locals.user`; the layout already redirects unauthenticated
	// visitors to /login. The non-null assertion is safe in
	// production but the explicit guard turns a layout regression into
	// a clean TypeError -> fail() -> error boundary, instead of a 500
	// TypeError on `u.controlNumber` (audit R8-7 / P0-3).
	const u = locals.user;
	if (!u) {
		return {
			period: null,
			groups: [] as OfferGroup[],
			blocks: [] as OfferBlock[],
			enrolledCanonicalIds: [] as string[],
			enrolledBlocks: [] as OfferBlock[],
		};
	}
	if (!env.DB) {
		return {
			period: null,
			groups: [] as OfferGroup[],
			blocks: [] as OfferBlock[],
			enrolledCanonicalIds: [] as string[],
			enrolledBlocks: [] as OfferBlock[],
		};
	}
	const db = getDb(env.DB);
	// Target period for a NEW enrollment. `getCurrentPeriod` reads the
	// student's existing ENROLLED rows, so it returns null for exactly
	// the students who most need to enrol (T10.4) — which deadlocked the
	// route: an empty catalog plus a 400 from the action, with no way to
	// create a first enrollment.
	//
	// Derive the term from the student's own academic history instead.
	// A student with prior progress gets their most recent recorded
	// period; a brand-new one gets the current calendar term. An
	// explicit `?period=` always wins so a link can target a term.
	const requestedPeriod = url.searchParams.get("period");
	const period =
		requestedPeriod ??
		(await getLatestProgressPeriod(db, u.controlNumber)) ??
		currentAcademicPeriod();

	// 1. Already-enrolled canonicalIds for this period (so the UI can
	//    render those groups as "already taken").
	const enrolledRows = await db
		.select({ subjectCanonicalId: studentProgress.subjectCanonicalId })
		.from(studentProgress)
		.where(
			and(
				eq(studentProgress.studentControlNumber, u.controlNumber),
				eq(studentProgress.status, "ENROLLED"),
				eq(studentProgress.period, period),
			),
		);
	const enrolledCanonicalIds = enrolledRows.map((r) => r.subjectCanonicalId);

	// 2. Full course-groups catalog joined with the subjects table
	//    so the page has code/name/area/credits without further
	//    round-trips. Drizzle's leftJoin keeps groups that point at
	//    a missing subject as a single row (the spec pins FKs at
	//    insert time, so this is defensive).
	const offerRows = await db
		.select({
			groupId: courseGroups.id,
			subjectCanonicalId: courseGroups.subjectCanonicalId,
			subjectCode: subjects.code,
			subjectName: subjects.name,
			area: subjects.area,
			credits: subjects.credits,
			hasLab: courseGroups.hasLab,
			teacherName: courseGroups.teacherName,
		})
		.from(courseGroups)
		.innerJoin(subjects, eq(subjects.canonicalId, courseGroups.subjectCanonicalId));

	const groups: OfferGroup[] = offerRows.map((r) => ({
		...r,
		alreadyEnrolled: enrolledCanonicalIds.includes(r.subjectCanonicalId),
	}));

	// 3. Schedule blocks: ALL offer blocks + the student's enrolled
	//    ones (the conflict detector needs both). The simulator
	//    does the actual filtering client-side; this avoids a
	//    round-trip per keystroke.
	const allGroupIds = Array.from(new Set(groups.map((g) => g.groupId)));
	const blockRows =
		allGroupIds.length === 0
			? []
			: await db
					.select({
						id: courseScheduleBlocks.id,
						groupId: courseScheduleBlocks.groupId,
						day: courseScheduleBlocks.day,
						startTime: courseScheduleBlocks.startTime,
						endTime: courseScheduleBlocks.endTime,
						classroom: courseScheduleBlocks.classroom,
					})
					.from(courseScheduleBlocks)
					.where(inArray(courseScheduleBlocks.groupId, allGroupIds));

	const enrolledGroupIds = new Set(groups.filter((g) => g.alreadyEnrolled).map((g) => g.groupId));
	const blocks: OfferBlock[] = blockRows;
	const enrolledBlocks: OfferBlock[] = blockRows.filter((b) => enrolledGroupIds.has(b.groupId));

	return { period, groups, blocks, enrolledCanonicalIds, enrolledBlocks };
};

export const actions: Actions = {
	/**
	 * Enrolls the student in the given `groupId`s for the current
	 * period. Re-validates the selection on the server (no
	 * duplicates, no already-enrolled groups, no schedule conflicts)
	 * and inserts the resulting `student_progress` rows in a single
	 * `db.batch()`. On success, redirects to `/dashboard?enrolled=1`
	 * so the dashboard can flash a success message.
	 *
	 * Conflicts are detected at insert time: if the student picks a
	 * set of groups whose schedule blocks overlap, the action
	 * returns a `fail()` payload the page can render.
	 */
	enroll: async ({ request, locals, url }) => {
		// Explicit guard — SvelteKit 3's action lifecycle runs
		// before any layout `load`, so the layout middleware does
		// NOT cover form actions. An anonymous POST to
		// `/reinscripcion?/enroll` would otherwise reach this body
		// and TypeError on `u.controlNumber` (audit R8-7 / P0-3).
		const u = locals.user;
		if (!u) {
			return fail(401, { error: "No autenticado. Inicia sesión." });
		}
		if (!env.DB) {
			return fail(503, { error: "Servicio no disponible" });
		}
		const form = await request.formData();
		const raw = form.getAll("groupId").map((v) => String(v));
		// Dedupe the submitted groups AND the subjects they resolve to
		// (T10.2). Two distinct groups can share one subject — a theory
		// block and its lab — and the multi-value INSERT below is keyed
		// on (student, subject, period). Dedupe by group id alone let
		// that submission through to an unhandled PRIMARY KEY
		// violation, which surfaced as a 500 rather than a fail().
		const unique = Array.from(new Set(raw)).filter((s) => s.length > 0);

		if (unique.length === 0) {
			return fail(400, { error: "Selecciona al menos un grupo para inscribir." });
		}

		const db = getDb(env.DB);
		// Same resolution as `load` (T10.4): explicit query param, then the
		// student's most recent recorded period, then the current calendar
		// term. `getCurrentPeriod` alone returns null for a student with
		// no ENROLLED rows — precisely the student who needs to enrol.
		const requested = url.searchParams.get("period");
		const period =
			requested ?? (await getLatestProgressPeriod(db, u.controlNumber)) ?? currentAcademicPeriod();

		// Look up the candidate groups + their subjects.
		const candidates = await db
			.select({
				groupId: courseGroups.id,
				subjectCanonicalId: courseGroups.subjectCanonicalId,
			})
			.from(courseGroups)
			.where(inArray(courseGroups.id, unique));
		if (candidates.length !== unique.length) {
			return fail(400, { error: "Uno o más grupos seleccionados no existen." });
		}

		// Collapse groups that resolve to the same subject (T10.2). The
		// PRIMARY KEY is (student_control_number, subject_canonical_id,
		// period) — one row per subject per period — so the insert below
		// must not receive the same subject twice. Keep the first group so
		// the schedule block the student picked is the one honoured.
		const bySubject = new Map<string, (typeof candidates)[number]>();
		for (const c of candidates) {
			if (!bySubject.has(c.subjectCanonicalId)) {
				bySubject.set(c.subjectCanonicalId, c);
			}
		}
		const toEnrol = [...bySubject.values()];

		// Reject groups whose subject the student is already enrolled
		// in this period — the UI already filters them out, but a
		// stale form post could still submit them.
		// Reject subjects already enrolled THIS period (a stale form post can
		// bypass the UI's filter). (T10.1)
		const alreadyEnrolled = await db
			.select({ subjectCanonicalId: studentProgress.subjectCanonicalId })
			.from(studentProgress)
			.where(
				and(
					eq(studentProgress.studentControlNumber, u.controlNumber),
					eq(studentProgress.status, "ENROLLED"),
					eq(studentProgress.period, period),
				),
			);
		const taken = new Set(alreadyEnrolled.map((r) => r.subjectCanonicalId));
		for (const c of toEnrol) {
			if (taken.has(c.subjectCanonicalId)) {
				return fail(409, {
					error: "Una materia seleccionada ya está inscrita este periodo.",
				});
			}
		}

		// Conflict check across the candidate blocks + the already-
		// enrolled blocks. We use the same pure helper the client
		// uses so the rule is defined in exactly one place.
		const candidateBlocks = await db
			.select({
				id: courseScheduleBlocks.id,
				groupId: courseScheduleBlocks.groupId,
				day: courseScheduleBlocks.day,
				startTime: courseScheduleBlocks.startTime,
				endTime: courseScheduleBlocks.endTime,
			})
			.from(courseScheduleBlocks)
			.where(inArray(courseScheduleBlocks.groupId, unique));
		const enrolledGroupIds = (
			await db
				.select({ id: courseGroups.id })
				.from(courseGroups)
				.innerJoin(
					studentProgress,
					and(
						eq(studentProgress.subjectCanonicalId, courseGroups.subjectCanonicalId),
						// Without this the subject-only join returns every
						// offering group of an enrolled subject, so the conflict
						// baseline below compared the candidate against the whole
						// catalogue instead of the student's own schedule.
						eq(courseGroups.studentControlNumber, u.controlNumber),
						eq(studentProgress.studentControlNumber, u.controlNumber),
						eq(studentProgress.status, "ENROLLED"),
						eq(studentProgress.period, period),
					),
				)
		).map((r) => r.id);
		const enrolledBlocks = enrolledGroupIds.length
			? await db
					.select({
						id: courseScheduleBlocks.id,
						groupId: courseScheduleBlocks.groupId,
						day: courseScheduleBlocks.day,
						startTime: courseScheduleBlocks.startTime,
						endTime: courseScheduleBlocks.endTime,
					})
					.from(courseScheduleBlocks)
					.where(inArray(courseScheduleBlocks.groupId, enrolledGroupIds))
			: [];
		const conflicts = findConflicts(candidateBlocks, enrolledBlocks);
		if (conflicts.size > 0) {
			return fail(409, {
				error: "Conflicto de horario con materias ya inscritas.",
			});
		}

		// Candidate-vs-candidate (T10.3). The check above only compares the
		// new blocks against what the student already has, so a single
		// submission containing two mutually-overlapping new groups
		// passed — despite the JSDoc claiming the action fails on
		// overlap. `SchedulePreview.svelte` already performs this
		// comparison client-side; the same pure helper runs here so the
		// rule is enforced once, server-side, where it cannot be skipped.
		const selfOverlap = findConflicts(candidateBlocks, candidateBlocks);
		if (selfOverlap.size > 0) {
			return fail(409, {
				error: "Dos de las materias seleccionadas se traslapan entre sí.",
			});
		}

		// Insert all rows in a single multi-value INSERT. SQLite
		// executes a single `INSERT INTO ... VALUES (...), (...), ...`
		// atomically: a mid-flight failure does not leave the
		// student half-enrolled. The Drizzle `db.batch(...)` API
		// requires a non-empty tuple, which is awkward for a
		// dynamic N — the multi-value insert is the right primitive.
		await db.insert(studentProgress).values(
			toEnrol.map((c) => ({
				studentControlNumber: u.controlNumber,
				subjectCanonicalId: c.subjectCanonicalId,
				status: "ENROLLED" as const,
				grade: null,
				evaluationType: null,
				period,
			})),
		);

		throw redirect(303, "/dashboard?enrolled=1");
	},
};

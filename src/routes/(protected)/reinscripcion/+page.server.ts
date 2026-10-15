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
 *   2. Read the student's already-enrolled subjects (same period) so
 *      the page can keep them out of the offer and still resolve the
 *      student's own groups for the schedule preview.
 *   3. Read ONE page of the `course_groups` catalog (joined with
 *      `subjects` so the UI can render area / credits / name without a
 *      second round-trip), narrowed and paged in SQL.
 *   4. Read the schedule blocks of the student's own groups — the only
 *      groups the SIM publishes a timetable for — so the page can render
 *      the schedule preview and run the conflict detector client-side
 *      without further fetches.
 *
 * Step 3 is paged (T9.14). The catalogue is 475 rows: shipping all of
 * them made the page unusable for a student and unobservable for the
 * agentic runner — 2,450 accessibility nodes, 65,890 tokens against a
 * 64,000 budget, `STEP_BUDGET_EXHAUSTED` on the first step. The filters
 * are therefore query parameters the WHERE clause applies, not a chain
 * the browser runs over 475 rows it has already paid for.
 *
 * The "Inscribir y firmar" form action below accepts a list of
 * `groupId`s, validates the selection (no duplicates, no already-
 * enrolled groups, no conflicts), inserts the corresponding
 * `student_progress` rows AND the `enrollments` rows that record WHICH
 * group was chosen, in a single `db.batch()`, and redirects to
 * `/dashboard?enrolled=1` on success.
 *
 * See: odd/tasks/opensim.md Tarea 4.1.
 */

import { env as workerEnv } from "cloudflare:workers";
import { type Actions, fail, redirect } from "@sveltejs/kit";
import {
	and,
	count,
	eq,
	inArray,
	lt,
	notInArray,
	type SQL,
	type SQLWrapper,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { OfferBlock, OfferGroup, OfferPage } from "#lib/components/simulador/types";
import { getDb } from "#lib/server/db";
import {
	courseGroups,
	courseScheduleBlocks,
	enrollments,
	studentProgress,
	subjects,
} from "#lib/server/db/schema";
import { currentAcademicPeriod } from "#lib/server/enrollment";
import { findConflicts } from "#lib/utils/schedule-conflict";
import { foldText } from "#lib/utils/text-match";
import type { OpenSimWorkerEnv } from "../../../cloudflare-workers";
import type { PageServerLoad } from "./$types";

const env = workerEnv as OpenSimWorkerEnv;

/**
 * Rows per page of the offering catalogue (T9.14).
 *
 * The agent's budget would tolerate far more — the measured 2,450 nodes
 * over 475 rows puts the ceiling near 500 — so the binding constraint is
 * the student's screen, not the runner. 50 keeps the pager at 10 pages
 * for the real catalogue and lands one page at ~258 nodes, ~6,900 tokens.
 *
 * Exported for the tests; the `_` prefix is what SvelteKit allows a
 * `+page.server.ts` to export beyond the framework's own names.
 */
export const _PAGE_SIZE = 50;

/**
 * `foldText`'s NFD fold, rebuilt as SQL.
 *
 * SQLite has no `unaccent()`, and its `lower()` is ASCII-only, so a plain
 * `LIKE` would stop matching "algebra" against "Álgebra Lineal" — for a
 * TecNM student the unaccented guess is the normal input, not the edge
 * case, so that is the behaviour `matchesText` was written for. The
 * uppercase entries come first because `lower()` would leave "Á" alone
 * and hand back a folded column that still misses the needle.
 *
 * shortcut: the 68 catalogued subjects spell with á é í ó ú ü ñ and
 * nothing else, so the map is closed — add a key if the curriculum
 * export ever grows another diacritic.
 */
const FOLD_SQL: Record<string, string> = {
	Á: "A",
	É: "E",
	Í: "I",
	Ó: "O",
	Ú: "U",
	Ü: "U",
	Ñ: "N",
	á: "a",
	é: "e",
	í: "i",
	ó: "o",
	ú: "u",
	ü: "u",
	ñ: "n",
};

function foldSql(column: SQLWrapper): SQL {
	let expression: SQLWrapper = column;
	for (const [accented, base] of Object.entries(FOLD_SQL)) {
		expression = sql`replace(${expression}, ${accented}, ${base})`;
	}
	return sql`lower(${expression})`;
}

/** `_` and `%` are LIKE wildcards; a student typing them means the character. */
function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** The self-reference of the duplicate-offering predicate below. */
const offeringTwin = alias(courseGroups, "offering_twin");

/**
 * The term an explicit `?period=` asks for, or `undefined` when it does not
 * ask for one.
 *
 * `undefined` and `""` are different things and only the first is a fallback:
 * `url.searchParams.get` returns `""` for a bare `?period=`, and letting that
 * through wrote rows whose term was the empty string. An override with no
 * value is not a term, so it falls back like any absent one (T10.1, S2).
 */
function requestedTerm(url: URL): string | undefined {
	const requested = url.searchParams.get("period")?.trim();
	return requested === undefined || requested === "" ? undefined : requested;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	// The (protected) layout's middleware is what normally populates
	// `locals.user`; the layout already redirects unauthenticated
	// visitors to /login. The non-null assertion is safe in
	// production but the explicit guard turns a layout regression into
	// a clean TypeError -> fail() -> error boundary, instead of a 500
	// TypeError on `u.controlNumber` (audit R8-7 / P0-3).
	const u = locals.user;
	const emptyOffer: OfferPage = { query: "", credits: "", page: 1, pages: 1, totalCount: 0 };
	if (!u) {
		return {
			period: null,
			groups: [] as OfferGroup[],
			blocks: [] as OfferBlock[],
			enrolledCanonicalIds: [] as string[],
			enrolledBlocks: [] as OfferBlock[],
			offer: emptyOffer,
		};
	}
	if (!env.DB) {
		return {
			period: null,
			groups: [] as OfferGroup[],
			blocks: [] as OfferBlock[],
			enrolledCanonicalIds: [] as string[],
			enrolledBlocks: [] as OfferBlock[],
			offer: emptyOffer,
		};
	}
	const db = getDb(env.DB);
	// Target period for a NEW enrollment. `getCurrentPeriod` reads the
	// student's existing ENROLLED rows, so it returns null for exactly
	// the students who most need to enrol (T10.4) — which deadlocked the
	// route: an empty catalog plus a 400 from the action, with no way to
	// create a first enrollment.
	//
	// A new enrolment belongs to the term it is made in (T10.1, S1). It used
	// to fall back to the student's most recent progress row, which ordered
	// by `desc(period)` on the term NAME as text: "ENERO-JUNIO/2099"
	// outranked "AGOSTO-DICIEMBRE/2026", so the demo student resolved to a
	// term that has not opened. `?period=` still wins, but only when it
	// carries a value — an empty one is not a term.
	const period = requestedTerm(url) ?? currentAcademicPeriod();

	// 1. Already-enrolled canonicalIds for this period. The offer query
	//    below excludes them, which is what the browser used to do with
	//    `if (g.alreadyEnrolled) return false` — the same rule, applied
	//    before the rows are fetched instead of after.
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

	// 2. Filter inputs. The simulator's controls are a plain GET form, so
	//    the URL is the only place a filter lives.
	const query = (url.searchParams.get("q") ?? "").trim();
	const requestedCredits = url.searchParams.get("credits");
	const credits: OfferPage["credits"] =
		requestedCredits === "lt5" || requestedCredits === "eq5" ? requestedCredits : "";
	const requestedPage = Number(url.searchParams.get("page") ?? "1");

	// 3. Every predicate the page can narrow by, as SQL. The count and the
	//    page below both apply this one clause, so there is a single answer
	//    to "which groups match".
	const conditions: SQL[] = [];
	// The SIM publishes the same group twice — once from an export with no
	// term filter, once from a term-filtered one — and because our offering
	// id embeds the period (`O-{code}-{group}-{period|NA}-{teacher}`) those
	// are two distinct rows that `course_groups` holds both of. The UI shows
	// no period, so the student just sees the same group listed twice.
	//
	// Drop a period-less row ONLY when a period-bearing twin exists on the
	// same (subject, group, teacher). That NOT EXISTS is the whole point:
	// a period-less row with no twin is the only record we have of that
	// group and MUST survive, so this filters duplicates, never data.
	// Simplifying it to `period IS NOT NULL` would delete 234 real rows from
	// the catalogue the moment the SIM published an untagged group alone.
	//
	// Both sides also require `student_control_number IS NULL`: enrolment
	// rows carry no period either, and one student's group must never be
	// allowed to suppress another student's.
	conditions.push(
		sql`(${courseGroups.period} IS NOT NULL OR NOT EXISTS (
			SELECT 1 FROM ${courseGroups} AS "offering_twin"
			WHERE ${offeringTwin.studentControlNumber} IS NULL
				AND ${offeringTwin.period} IS NOT NULL
				AND ${offeringTwin.subjectCanonicalId} = ${courseGroups.subjectCanonicalId}
				AND ${offeringTwin.groupCode} = ${courseGroups.groupCode}
				AND ${offeringTwin.teacherName} = ${courseGroups.teacherName}
		))`,
	);
	if (enrolledCanonicalIds.length > 0) {
		conditions.push(notInArray(courseGroups.subjectCanonicalId, enrolledCanonicalIds));
	}
	const needle = foldText(query);
	if (needle !== "") {
		const pattern = `%${escapeLike(needle)}%`;
		conditions.push(
			sql`(${foldSql(subjects.code)} LIKE ${pattern} ESCAPE '\\' OR ${foldSql(subjects.name)} LIKE ${pattern} ESCAPE '\\')`,
		);
	}
	if (credits === "lt5") conditions.push(lt(subjects.credits, 5));
	if (credits === "eq5") conditions.push(eq(subjects.credits, 5));
	// Unconditional (the duplicate predicate is always pushed), so the count
	// below and the page after it can never disagree about what "the offer" is.
	const where = and(...conditions);

	// 4. The total comes off the SAME WHERE clause as the page. Counting
	//    before filtering would report 475 next to a 12-row search, and
	//    counting after fetching would mean fetching all 475 first.
	const countRows = await db
		.select({ n: count() })
		.from(courseGroups)
		.innerJoin(subjects, eq(subjects.canonicalId, courseGroups.subjectCanonicalId))
		.where(where);
	const totalCount = Number(countRows[0]?.n ?? 0);
	const pages = Math.max(1, Math.ceil(totalCount / _PAGE_SIZE));
	// A `?page=999` past the end serves the last page rather than an empty
	// list under a "475 grupos" badge.
	const page =
		Number.isInteger(requestedPage) && requestedPage > 1 ? Math.min(requestedPage, pages) : 1;

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
		.innerJoin(subjects, eq(subjects.canonicalId, courseGroups.subjectCanonicalId))
		.where(where)
		// `courseGroups.id` is the primary key, so code + id is a total
		// order: without it a row could appear on two pages.
		.orderBy(subjects.code, courseGroups.id)
		.limit(_PAGE_SIZE)
		.offset((page - 1) * _PAGE_SIZE);

	const groups: OfferGroup[] = offerRows.map((r) => ({
		...r,
		alreadyEnrolled: enrolledCanonicalIds.includes(r.subjectCanonicalId),
	}));

	// 5. Schedule blocks for the student's OWN groups, which are the only
	//    groups that can carry any.
	//
	//    The SIM offering catalogue publishes who teaches and in which
	//    term, never a timetable: `docs/data/sim-grupos-oferta.json` has
	//    exactly `code, credits, group, hasLab, name, period, teacher`
	//    and no `day` / `start_time` / `end_time`, so the 468 catalogue
	//    rows structurally cannot have a block. The query that handed all
	//    475 group ids to `inArray` was therefore claiming a fact no
	//    source states — and at 475 ids it also blew past D1's
	//    100-bound-parameter ceiling, which is the 500 in production.
	//    Asking the enrolled subjects for their groups fixes both: the ids
	//    come from `enrolledCanonicalIds` (already computed above), and
	//    the bound count is one per subject the student actually has.
	const enrolledGroupIds = (
		enrolledCanonicalIds.length === 0
			? []
			: await db
					.select({ id: courseGroups.id })
					.from(courseGroups)
					.where(inArray(courseGroups.subjectCanonicalId, enrolledCanonicalIds))
	).map((r) => r.id);
	const blockRows =
		enrolledGroupIds.length === 0
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
					.where(inArray(courseScheduleBlocks.groupId, enrolledGroupIds));

	// Every block that exists belongs to an already-enrolled group, so
	// the offer block list and the enrolled block list are the same rows.
	// Both are returned because the simulator still asks for both: keeping
	// the shape means a future offering export that DOES carry a timetable
	// only has to widen `blocks` to get the candidate side back.
	const blocks: OfferBlock[] = blockRows;
	const enrolledBlocks: OfferBlock[] = blockRows;

	return {
		period,
		groups,
		blocks,
		enrolledCanonicalIds,
		enrolledBlocks,
		offer: { query, credits, page, pages, totalCount } satisfies OfferPage,
	};
};

export const actions: Actions = {
	/**
	 * Enrolls the student in the given `groupId`s for the current
	 * period. Re-validates the selection on the server (no
	 * duplicates, no already-enrolled groups, no schedule conflicts)
	 * and inserts the resulting `student_progress` and `enrollments`
	 * rows in a single `db.batch()`. On success, redirects to
	 * `/dashboard?enrolled=1` so the dashboard can flash a success
	 * message.
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
		// The SAME resolution `load` uses (T10.1, S4). When these two
		// disagreed the page offered one term and the action wrote
		// another, which is its own silent bug.
		const period = requestedTerm(url) ?? currentAcademicPeriod();

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

		// The PRIMARY KEY is (student, subject, period). EVERY status occupies
		// that triple — APPROVED, ENROLLED and LOCKED alike — so filtering
		// by status here is what let an APPROVED row through to the INSERT
		// and raise UNIQUE constraint failed, a 500. (T10.1, S3)
		//
		// A past term does NOT block: the filter is the term, not the
		// student's history. Re-taking a subject they completed in 2019 is
		// a different (student, subject, period) and must stay allowed.
		const alreadyHeld = await db
			.select({ subjectCanonicalId: studentProgress.subjectCanonicalId })
			.from(studentProgress)
			.where(
				and(
					eq(studentProgress.studentControlNumber, u.controlNumber),
					eq(studentProgress.period, period),
				),
			);
		const taken = new Set(alreadyHeld.map((r) => r.subjectCanonicalId));
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

		// Record the signature in BOTH tables, in one `db.batch` so D1
		// wraps them in a single transaction: `student_progress` is the
		// fact "took this subject", `enrollments` is the fact "chose this
		// group". Without the second row the choice was lost the moment
		// the redirect fired — nothing downstream could ever resolve the
		// student's groups back to the group they picked.
		//
		// `enrollments.period` carries the resolved term NAME, the same
		// string `student_progress.period` holds above. `course_groups.
		// period` is a SIM term NUMBER ("1".."9") and cannot be joined
		// against it.
		//
		// Both statements are multi-value INSERTs because the row count is
		// dynamic: SQLite executes a single `INSERT INTO ... VALUES (...), (...), ...`
		// atomically, so a mid-flight failure does not leave the student
		// half-enrolled. `toEnrol` is never empty here — the dedupe above
		// cannot collapse a non-empty `unique` to nothing — which is what
		// `db.batch` requires (it rejects an empty query list).
		await db.batch([
			db.insert(studentProgress).values(
				toEnrol.map((c) => ({
					studentControlNumber: u.controlNumber,
					subjectCanonicalId: c.subjectCanonicalId,
					status: "ENROLLED" as const,
					grade: null,
					evaluationType: null,
					period,
				})),
			),
			db.insert(enrollments).values(
				toEnrol.map((c) => ({
					studentControlNumber: u.controlNumber,
					groupId: c.groupId,
					period,
				})),
			),
		]);

		throw redirect(303, "/dashboard?enrolled=1");
	},
};

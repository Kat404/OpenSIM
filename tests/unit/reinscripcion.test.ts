/**
 * OpenSIM — Reinscripción loader / action tests.
 *
 * Three regressions this file exists to pin, all of them found the same
 * way: the page 500'd in production and the cause turned out to be a query
 * that claimed a fact no source states.
 *
 *   1. The loader handed every one of the 475 `course_groups` ids to
 *      `inArray(courseScheduleBlocks.groupId, ...)`. D1 caps a query at
 *      100 bound parameters, so that was a 500 by arithmetic. The fix is
 *      not chunking: the 468 offering-catalogue rows carry no timetable at
 *      all, so the query was asking about rows that cannot exist.
 *
 *   2. `enroll` inserted only into `student_progress`, which records THAT
 *      a student took a subject and never WHICH group they chose. The
 *      choice was dropped on the floor the moment the redirect fired.
 *
 *   3. `seed.sql` is applied repeatedly (local dev, CI, demo D1), so a
 *      second run has to land exactly the same counts. Two regressions
 *      in this repo's history were seeded twice and changed shape.
 *
 * The harness (`_helpers/harness.ts`) runs the real migration SQL over
 * `node:sqlite`, so the tables under test are the ones production gets.
 */

import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OfferBlock, OfferGroup, OfferPage } from "../../src/lib/components/simulador/types";
import { currentAcademicPeriod } from "../../src/lib/server/enrollment";
import {
	_PAGE_SIZE,
	actions as reinscripcionActions,
	load as reinscripcionLoad,
} from "../../src/routes/(protected)/reinscripcion/+page.server";
import {
	type D1Like,
	makeEvent,
	makeTestD1,
	makeUser,
	PERIOD,
	seedBlock,
	seedCareer,
	seedGroup,
	seedProfile,
	seedProgress,
	seedSubject,
	setWorkerDb,
} from "./_helpers/harness";

await vi.hoisted(async () => {
	(await import("./_helpers/harness")).installWorkerEnv();
});

const CONTROL = "12345678";
const PREVIOUS_PERIOD = "AGOSTO-DICIEMBRE/2025";
/** D1's documented ceiling: "Maximum bound parameters per query | 100". */
const D1_MAX_BOUND_PARAMS = 100;
/** Size of the real SIM offering catalogue (`docs/data/sim-grupos-oferta.json`). */
const CATALOGUE_SIZE = 468;
/**
 * Every `course_groups` row production has: the 468 catalogue entries plus
 * the 7 enrolment rows the demo student owns (T9.14).
 */
const OFFER_ROWS = 475;
/**
 * Subjects in the duplicate-shaped fixture: more than `_PAGE_SIZE`, so the
 * dedup has to hold across a page boundary rather than inside one page.
 */
const DUPLICATED_SUBJECTS = 120;

interface ReinscripcionData {
	period: string;
	groups: (OfferGroup & { groupId: string })[];
	blocks: OfferBlock[];
	enrolledCanonicalIds: string[];
	enrolledBlocks: OfferBlock[];
	offer: OfferPage;
}

interface RecordedQuery {
	sql: string;
	params: number;
}

/**
 * Wraps the harness D1 so every `prepare`/`bind` pair is recorded with its
 * bound-parameter count. node:sqlite's own variable ceiling is thousands,
 * so "the query ran" would prove nothing about D1's 100; counting the
 * bindings is what makes the production 500 reproducible here.
 */
function spyPrepare(d1: D1Like, sink: RecordedQuery[]): D1Like {
	return {
		prepare(sql: string) {
			const stmt = d1.prepare(sql) as {
				bind: (...params: unknown[]) => unknown;
				all: () => unknown;
				raw: () => unknown;
				first: (column?: string) => unknown;
				run: () => unknown;
			};
			return {
				bind(...params: unknown[]) {
					sink.push({ sql, params: params.length });
					return stmt.bind(...params);
				},
				all: () => stmt.all(),
				raw: () => stmt.raw(),
				first: (column?: string) => stmt.first(column),
				run: () => stmt.run(),
			};
		},
		batch: (stmts) => d1.batch(stmts),
		exec: (sql) => d1.exec(sql),
	};
}

/**
 * Seeds the offering catalogue: `count` subjects, each with one
 * catalogue group (`student_control_number IS NULL`). The real export has
 * no `day` / `start_time` / `end_time`, so none of these get a schedule
 * block — that absence is the fact under test, not an oversight here.
 */
function seedCatalogue(raw: DatabaseSync, count: number): void {
	const subject = raw.prepare(
		`INSERT INTO subjects (canonical_id, code, name, semester, ht, hp, credits, area)
		 VALUES (?, ?, ?, 1, 3, 3, 5, 'Sistemas')`,
	);
	const group = raw.prepare(
		`INSERT INTO course_groups (id, subject_canonical_id, group_code, teacher_name, has_lab, period, credits)
		 VALUES (?, ?, 'A', 'DOC-001', 0, '3', 5)`,
	);
	for (let i = 0; i < count; i++) {
		const n = String(i).padStart(4, "0");
		subject.run(`cat-${n}`, `CAT${n}`, `Materia de oferta ${n}`);
		group.run(`O-CAT${n}-A-3-DOC-001`, `cat-${n}`);
	}
}

/**
 * One catalogue row with an explicit term and teacher. `seedGroup` pins a
 * teacher name and never sets `period`, and both are what the duplicate
 * predicate keys on, so this is the only honest way to build the shape the
 * SIM actually publishes.
 */
function seedOfferingRow(
	raw: DatabaseSync,
	id: string,
	subjectCanonicalId: string,
	period: string | null,
): void {
	raw
		.prepare(
			`INSERT INTO course_groups (id, subject_canonical_id, group_code, teacher_name, has_lab, period, credits, is_lab_session)
			 VALUES (?, ?, 'A', 'DOC-001', 0, ?, 4, 0)`,
		)
		.run(id, subjectCanonicalId, period);
}

/**
 * The production catalogue shape: every group published TWICE, once from an
 * export with no term filter (`-NA-`, `period` NULL) and once from a
 * term-filtered one (`-1-`). Identical subject, group code and teacher — the
 * only difference is the term the page never renders.
 */
function seedDuplicatedCatalogue(raw: DatabaseSync, subjects: number): void {
	const subject = raw.prepare(
		`INSERT INTO subjects (canonical_id, code, name, semester, ht, hp, credits, area)
		 VALUES (?, ?, ?, 1, 3, 3, 4, 'Sistemas')`,
	);
	for (let i = 0; i < subjects; i++) {
		const n = String(i).padStart(4, "0");
		subject.run(`dup-${n}`, `DUP${n}`, `Materia duplicada ${n}`);
		seedOfferingRow(raw, `O-DUP${n}-A-NA-DOC-001`, `dup-${n}`, null);
		seedOfferingRow(raw, `O-DUP${n}-A-1-DOC-001`, `dup-${n}`, "1");
	}
}

/** Catalogue rows in the table, duplicates included — the pre-filter truth. */
function catalogueRowCount(raw: DatabaseSync): number {
	const row = raw
		.prepare(`SELECT count(*) AS n FROM course_groups WHERE student_control_number IS NULL`)
		.get() as { n: number };
	return row.n;
}

/**
 * `group_code` for a served row. The loader does not select it, and parsing
 * it back out of the id would let the test agree with a bug in the id format;
 * the column is the real thing the predicate keys on.
 */
function groupCodeOf(raw: DatabaseSync, groupId: string): string {
	const row = raw
		.prepare(`SELECT group_code AS c FROM course_groups WHERE id = ?`)
		.get(groupId) as {
		c: string;
	};
	return row.c;
}

/** The fixture shape for the demo student: their own groups plus blocks. */
function seedOwnGroups(raw: DatabaseSync): void {
	seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027" });
	seedGroup(raw, "G-SCC1027-1", "sistemas-1", "A", CONTROL);
	seedBlock(raw, { groupId: "G-SCC1027-1", day: "L", startTime: "08:00", endTime: "10:00" });
	seedProgress(raw, CONTROL, "sistemas-1", "ENROLLED", PERIOD);
}

function signedIn(url = "https://opensim.test/reinscripcion") {
	return makeEvent({ user: makeUser(), url });
}

const load = async (event: unknown): Promise<ReinscripcionData> =>
	(await reinscripcionLoad(event as never)) as ReinscripcionData;

let raw: DatabaseSync;
let recorded: RecordedQuery[];

beforeEach(() => {
	const made = makeTestD1();
	raw = made.raw;
	recorded = [];
	setWorkerDb(spyPrepare(made.d1, recorded));
	seedCareer(raw);
	seedProfile(raw);
});

afterEach(() => {
	setWorkerDb(null);
	raw.close();
});

describe("reinscripcion loader", () => {
	it("returns without error against a catalogue-backed database", async () => {
		seedCatalogue(raw, CATALOGUE_SIZE);
		seedOwnGroups(raw);

		const data = await load(signedIn());

		expect(data.period).toBe(PERIOD);
		// Paged, not the whole catalogue: the student's own group is
		// excluded and 468 - 1 offerable rows come back one page at a time.
		expect(data.groups.length).toBeLessThanOrEqual(_PAGE_SIZE);
		expect(data.offer.totalCount).toBe(CATALOGUE_SIZE);
		expect(data.blocks).toHaveLength(1);
		expect(data.enrolledBlocks).toHaveLength(1);
	});

	it("binds at most one parameter per group the student actually has", async () => {
		seedCatalogue(raw, CATALOGUE_SIZE);
		seedOwnGroups(raw);

		await load(signedIn());

		const blockQuery = recorded.find(
			(q) => q.sql.startsWith("select") && q.sql.includes(`"course_schedule_blocks"`),
		);
		expect(blockQuery).toBeDefined();
		// The old code bound one variable per course_groups row: 475 against
		// a ceiling of 100.
		expect(blockQuery?.params).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS);
		expect(blockQuery?.params).toBe(1);
	});

	it("returns an empty envelope for an anonymous visitor", async () => {
		seedCatalogue(raw, CATALOGUE_SIZE);

		const data = await load(makeEvent({ user: null, url: "https://opensim.test/reinscripcion" }));

		expect(data.groups).toEqual([]);
		expect(data.blocks).toEqual([]);
		expect(data.period).toBeNull();
		expect(data.offer.totalCount).toBe(0);
	});
});

describe("reinscripcion — the offer fits on a screen (T9.14)", () => {
	it("serves one page of the 475-row catalogue and still reports the whole", async () => {
		seedCatalogue(raw, OFFER_ROWS);

		const data = await load(signedIn());

		// The whole defect in two numbers: the fetch is bounded, the count
		// is not.
		expect(data.groups).toHaveLength(_PAGE_SIZE);
		expect(data.groups.length).toBeLessThanOrEqual(_PAGE_SIZE);
		expect(data.offer.totalCount).toBe(OFFER_ROWS);
		expect(data.offer.pages).toBe(Math.ceil(OFFER_ROWS / _PAGE_SIZE));
		expect(data.offer.page).toBe(1);
	});

	it("narrows the text filter in SQL, before the count, not after", async () => {
		seedCatalogue(raw, OFFER_ROWS);

		const data = await load(
			signedIn("https://opensim.test/reinscripcion?q=materia+de+oferta+0001"),
		);

		// One match, and the total reports the match — counting first would
		// show 475 next to a 1-row result.
		expect(data.offer.totalCount).toBe(1);
		expect(data.groups).toHaveLength(1);
		expect(data.groups[0].subjectCode).toBe("CAT0001");
		expect(data.offer.query).toBe("materia de oferta 0001");
	});

	it("matches the search accent-insensitively, as `matchesText` does", async () => {
		seedCatalogue(raw, OFFER_ROWS);
		seedSubject(raw, { canonicalId: "acf-x", code: "ACF-9999", name: "Álgebra Lineal" });
		seedGroup(raw, "O-ACF-9999-A", "acf-x", "A", null);

		// SQLite's `lower()` is ASCII-only, so this only passes because the
		// loader rebuilds the fold as SQL.
		const data = await load(signedIn("https://opensim.test/reinscripcion?q=algebra"));

		expect(data.offer.totalCount).toBe(1);
		expect(data.groups[0].subjectName).toBe("Álgebra Lineal");
	});

	it("treats `_` and `%` as typed characters, not LIKE wildcards", async () => {
		seedCatalogue(raw, OFFER_ROWS);

		const data = await load(signedIn("https://opensim.test/reinscripcion?q=%25"));

		// Bare `%` is every row when it escapes, and no row when it does not.
		expect(data.offer.totalCount).toBe(0);
	});

	it("keeps the enrolled subjects out of the offer page", async () => {
		seedCatalogue(raw, CATALOGUE_SIZE);
		seedOwnGroups(raw);

		const data = await load(signedIn());

		// The rule moved from `if (g.alreadyEnrolled) return false` in the
		// browser to `notInArray` in the WHERE clause; same answer, and now
		// it also keeps those rows out of the count.
		expect(data.offer.totalCount).toBe(CATALOGUE_SIZE);
		expect(data.groups.filter((g) => g.alreadyEnrolled)).toEqual([]);
	});

	it("serves a different page of rows for a different page number", async () => {
		seedCatalogue(raw, OFFER_ROWS);

		const first = await load(signedIn());
		const second = await load(signedIn("https://opensim.test/reinscripcion?page=2"));

		// A `LIMIT` with no `OFFSET` — or an unstable `ORDER BY` — returns
		// page 1 twice and quietly loses half the catalogue.
		expect(first.groups.map((g) => g.groupId)).toHaveLength(_PAGE_SIZE);
		expect(second.groups).toHaveLength(_PAGE_SIZE);
		const firstIds = new Set(first.groups.map((g) => g.groupId));
		expect(second.groups.filter((g) => firstIds.has(g.groupId))).toEqual([]);
	});

	it("serves the last page for a page number past the end", async () => {
		seedCatalogue(raw, OFFER_ROWS);

		const data = await load(signedIn("https://opensim.test/reinscripcion?page=999"));

		expect(data.offer.page).toBe(data.offer.pages);
		expect(data.groups.length).toBeGreaterThan(0);
		expect(data.groups.length).toBeLessThanOrEqual(_PAGE_SIZE);
	});

	it("ignores a credits filter it does not recognise", async () => {
		seedCatalogue(raw, OFFER_ROWS);

		const data = await load(signedIn("https://opensim.test/reinscripcion?credits=lt9000"));

		expect(data.offer.credits).toBe("");
		expect(data.offer.totalCount).toBe(OFFER_ROWS);
	});
});

describe("reinscripcion — the duplicated offering (the SIM publishes each group twice)", () => {
	it("never serves two rows sharing (subject, group, teacher), on any page", async () => {
		seedDuplicatedCatalogue(raw, DUPLICATED_SUBJECTS);

		const seen = new Map<string, string>();
		const pages = Math.ceil(DUPLICATED_SUBJECTS / _PAGE_SIZE);
		let totalCount = 0;
		for (let page = 1; page <= pages; page++) {
			const data = await load(signedIn(`https://opensim.test/reinscripcion?page=${page}`));
			totalCount = data.offer.totalCount;
			for (const g of data.groups) {
				const key = [g.subjectCanonicalId, groupCodeOf(raw, g.groupId), g.teacherName].join("|");
				// Before the fix this fails on page 1: the two copies of a
				// group sort next to each other under the same subject code.
				expect(seen.has(key), `page ${page} served ${g.groupId} twice under ${key}`).toBe(false);
				seen.set(key, g.groupId);
			}
		}

		// Every subject, exactly once, across every page.
		expect(seen.size).toBe(DUPLICATED_SUBJECTS);
		// And the badge counts that same deduplicated set, not the wider one.
		expect(totalCount).toBe(DUPLICATED_SUBJECTS);
	});

	it("keeps a period-less group that has no period-bearing twin — the anti-loss test", async () => {
		seedSubject(raw, {
			canonicalId: "sin-periodo",
			code: "AAA1001",
			name: "Materia sin periodo",
			credits: 4,
		});
		seedOfferingRow(raw, "O-AAA1001-A-NA-DOC-001", "sin-periodo", null);

		// The SIM published this group once, with no term filter. It is the
		// only record of it: dropping it would be deletion, not deduplication.
		const lonely = await load(signedIn());
		expect(lonely.offer.totalCount).toBe(1);
		expect(lonely.groups.map((g) => g.groupId)).toEqual(["O-AAA1001-A-NA-DOC-001"]);

		// Now the term-filtered export lands. Only NOW does the period-less
		// copy have a better version, and only now is it the one that goes.
		seedOfferingRow(raw, "O-AAA1001-A-1-DOC-001", "sin-periodo", "1");

		const paired = await load(signedIn());
		expect(paired.offer.totalCount).toBe(1);
		expect(paired.groups.map((g) => g.groupId)).toEqual(["O-AAA1001-A-1-DOC-001"]);
	});

	it("counts the deduplicated set, not the rows it then discards", async () => {
		seedDuplicatedCatalogue(raw, DUPLICATED_SUBJECTS);

		const data = await load(signedIn());

		// The table holds twice the offer. A count taken before the predicate
		// reads 240 next to a 50-row page — the badge and the list disagree,
		// which is the half of the bug that lives in the WHERE clause.
		expect(catalogueRowCount(raw)).toBe(DUPLICATED_SUBJECTS * 2);
		expect(data.offer.totalCount).toBe(DUPLICATED_SUBJECTS);
		expect(data.offer.pages).toBe(Math.ceil(DUPLICATED_SUBJECTS / _PAGE_SIZE));
		// Every served row belongs to that same set, not the wider one.
		expect(data.groups.every((g) => g.groupId.includes("-1-DOC-001"))).toBe(true);
	});

	it("never lets one student's own group suppress another row", async () => {
		seedSubject(raw, { canonicalId: "propia", code: "BBB2002", credits: 4 });
		// An enrolment row: no period, exactly like the untagged catalogue
		// row, but it belongs to a student and is not the catalogue's to drop.
		seedOfferingRow(raw, "G-BBB2002-1", "propia", null);
		seedProgress(raw, CONTROL, "propia", "ENROLLED", PERIOD);

		const data = await load(signedIn());

		// The enrolment row is filtered out as an already-enrolled subject,
		// not silently deleted as a duplicate of nothing.
		expect(data.enrolledCanonicalIds).toEqual(["propia"]);
		expect(data.groups).toEqual([]);
		expect(data.offer.totalCount).toBe(0);
	});
});

describe("reinscripcion — the dead conflict detector", () => {
	it("offers zero candidate blocks for every catalogue group", async () => {
		seedCatalogue(raw, CATALOGUE_SIZE);
		seedOwnGroups(raw);

		const data = await load(signedIn());

		// `EnrollmentSimulator` builds `candidateBlocks` from blocks whose
		// groupId is in `selectedIds`, and the only selectable groups are
		// catalogue ones (the student's own arrive pre-filtered as
		// `alreadyEnrolled`). If any catalogue group had a block,
		// `candidateBlocks` would stop being empty and the conflict
		// detector would start claiming a detection it has never made.
		const blockGroupIds = new Set(data.blocks.map((b) => b.groupId));
		const catalogueGroups = data.groups.filter((g) => !g.alreadyEnrolled);
		expect(catalogueGroups.length).toBeGreaterThan(0);
		expect(catalogueGroups.length).toBeLessThanOrEqual(_PAGE_SIZE);
		expect(catalogueGroups.filter((g) => blockGroupIds.has(g.groupId))).toEqual([]);
	});

	it("the offering catalogue source carries no timetable to begin with", () => {
		// The guard against "fixing" the empty detector by inventing
		// schedule data: if a future export ever grows these keys, this
		// fails and the seed/loader start carrying a real timetable.
		const path = fileURLToPath(new URL("../../docs/data/sim-grupos-oferta.json", import.meta.url));
		const dataset = JSON.parse(readFileSync(path, "utf8")) as { groups: Record<string, unknown>[] };

		expect(dataset.groups).toHaveLength(CATALOGUE_SIZE);
		for (const key of ["day", "start_time", "end_time", "startTime", "endTime"]) {
			expect(Object.keys(dataset.groups[0])).not.toContain(key);
		}
	});
});

describe("reinscripcion enroll action", () => {
	/** A `POST` with repeated `groupId` fields, which a Record cannot express. */
	function postEnroll(groupIds: string[], url = "https://opensim.test/reinscripcion") {
		const body = new URLSearchParams();
		for (const id of groupIds) body.append("groupId", id);
		return {
			...makeEvent({ user: makeUser(), url }),
			request: new Request(url, { method: "POST", body }),
		};
	}

	function seedPriorTerm(): void {
		seedSubject(raw, { canonicalId: "prev-1", code: "AAA1000" });
		seedProgress(raw, CONTROL, "prev-1", "ENROLLED", PREVIOUS_PERIOD);
		seedSubject(raw, { canonicalId: "cat-0001", code: "CAT0001" });
		seedGroup(raw, "O-CAT0001-A-3-DOC-001", "cat-0001", "A", null);
	}

	it("records the chosen group in `enrollments` with the term NAME", async () => {
		seedPriorTerm();

		// The term is named here on purpose (T10.1, S2). This test used to
		// inherit whatever period the seeded student happened to carry, which
		// meant it asserted whatever `getLatestProgressPeriod` resolved rather
		// than the rule its own name states. A test should say which term it means.
		await expect(
			reinscripcionActions.enroll(
				postEnroll(
					["O-CAT0001-A-3-DOC-001"],
					`https://opensim.test/reinscripcion?period=${PREVIOUS_PERIOD}`,
				) as never,
			),
		).rejects.toMatchObject({
			status: 303,
			location: "/dashboard?enrolled=1",
		});

		const rows = raw.prepare("SELECT * FROM enrollments").all() as Record<string, unknown>[];
		expect(rows).toEqual([
			{
				student_control_number: CONTROL,
				group_id: "O-CAT0001-A-3-DOC-001",
				// The term NAME, not `course_groups.period`. The group row
				// seeded above carries the SIM term NUMBER "3"; these two
				// columns share a name and cannot be joined.
				period: PREVIOUS_PERIOD,
			},
		]);
		expect(rows[0].period).not.toBe("3");

		const progress = raw
			.prepare("SELECT * FROM student_progress WHERE subject_canonical_id = 'cat-0001'")
			.all() as Record<string, unknown>[];
		expect(progress).toHaveLength(1);
		expect(progress[0].period).toBe(PREVIOUS_PERIOD);
	});

	it("writes both tables in a single batch", async () => {
		seedPriorTerm();

		await expect(
			reinscripcionActions.enroll(postEnroll(["O-CAT0001-A-3-DOC-001"]) as never),
		).rejects.toThrow();

		// `db.batch` is the only writer here: a `student_progress` row
		// without its `enrollments` twin is the exact state that lost the
		// group choice in the first place.
		expect(recorded.filter((q) => q.sql.startsWith(`insert into "student_progress"`))).toHaveLength(
			1,
		);
		expect(recorded.filter((q) => q.sql.startsWith(`insert into "enrollments"`))).toHaveLength(1);
	});

	it("records nothing when the selection fails validation", async () => {
		seedPriorTerm();

		const result = await reinscripcionActions.enroll(postEnroll([]) as never);

		expect(result).toMatchObject({ status: 400 });
		expect(raw.prepare("SELECT count(*) AS n FROM enrollments").get()).toEqual({ n: 0 });
	});

	// ---- T10.1: the PRIMARY KEY is (student, subject, period), and EVERY
	// status occupies that triple. The guard used to read ENROLLED only, so an
	// APPROVED or a LOCKED row for the same subject and term went straight to
	// the INSERT and raised UNIQUE constraint failed — a 500. Confirmed by
	// running it, not by reading it: the answer was
	//   UNIQUE constraint failed: student_progress.student_control_number,
	//   student_progress.subject_canonical_id, student_progress.period

	/** The calendar term a new enrolment belongs to, per `currentAcademicPeriod`. */
	function calendarTerm(): string {
		return currentAcademicPeriod();
	}

	function enrolOffering(period: string) {
		seedSubject(raw, { canonicalId: "cat-0001", code: "CAT0001" });
		seedGroup(raw, "O-CAT0001-A-3-DOC-001", "cat-0001", "A", null);
		return postEnroll(
			["O-CAT0001-A-3-DOC-001"],
			`https://opensim.test/reinscripcion?period=${period}`,
		);
	}

	for (const status of ["APPROVED", "LOCKED", "ENROLLED"] as const) {
		it(`rejects a subject the student already has a ${status} row for this term`, async () => {
			const term = calendarTerm();
			// Seed the subject before the row that references it.
			const event = enrolOffering(term);
			seedProgress(raw, CONTROL, "cat-0001", status, term);

			const result = await reinscripcionActions.enroll(event as never);

			// A clean refusal, not a database error. 409 says "conflicto con lo
			// que ya tienes", which is what this is.
			expect(result).toMatchObject({ status: 409 });
			expect(raw.prepare("SELECT count(*) AS n FROM enrollments").get()).toEqual({ n: 0 });
		});
	}

	// `student_progress.status` is TEXT with no CHECK
	// (drizzle/0006_lush_wild_pack.sql), so a row edited by hand arrives with
	// any string at all. The rule is not "reject these three statuses", it is
	// "reject anything already holding this (student, subject, period)" — this
	// pins the difference, because a guard that enumerated statuses would pass
	// the loop above and fail here.
	for (const status of ["approved", "ENROLLED ", "CURSANDO"]) {
		it(`refuses a subject held under the out-of-union status ${JSON.stringify(status)}`, async () => {
			const term = calendarTerm();
			const event = enrolOffering(term);
			seedProgress(raw, CONTROL, "cat-0001", status, term);

			const result = await reinscripcionActions.enroll(event as never);

			expect(result).toMatchObject({ status: 409 });
			expect(raw.prepare("SELECT count(*) AS n FROM enrollments").get()).toEqual({ n: 0 });
		});
	}

	it("enrols into the calendar term even when the newest row belongs to a later term", async () => {
		// `getLatestProgressPeriod` ordered by `desc(period)` on the term NAME
		// as text, so "ENERO-JUNIO/2099" outranked "AGOSTO-DICIEMBRE/2026" and
		// the student would enrol into a term that has not opened. A new
		// enrolment belongs to the term it is made in.
		seedSubject(raw, { canonicalId: "future-1", code: "FUT1000" });
		seedProgress(raw, CONTROL, "future-1", "LOCKED", "ENERO-JUNIO/2099");
		// No `?period=` here ON PURPOSE: that override would short-circuit the
		// chain and the test would pass without exercising anything.
		const event = enrolOffering("");

		await expect(reinscripcionActions.enroll(event as never)).rejects.toMatchObject({
			status: 303,
		});

		const rows = raw.prepare("SELECT period FROM enrollments").all() as { period: string }[];
		expect(rows).toEqual([{ period: calendarTerm() }]);
	});

	it("lets the student re-take a subject they completed in an EARLIER term", async () => {
		// The other half of the rule: an APPROVED row in a past term must not
		// block. Only the same term collides.
		const event = enrolOffering(calendarTerm());
		seedProgress(raw, CONTROL, "cat-0001", "APPROVED", "AGOSTO-DICIEMBRE/2019");

		await expect(reinscripcionActions.enroll(event as never)).rejects.toMatchObject({
			status: 303,
		});
		expect(raw.prepare("SELECT count(*) AS n FROM enrollments").get()).toEqual({ n: 1 });
	});
});

describe("seed.sql idempotence", () => {
	function applySeed(): Record<string, number> {
		const path = fileURLToPath(new URL("../../src/lib/server/db/seed.sql", import.meta.url));
		raw.exec(readFileSync(path, "utf8"));
		const tables = [
			"careers",
			"subjects",
			"subject_prerequisites",
			"subject_units",
			"course_groups",
			"course_schedule_blocks",
			"student_profiles",
			"student_progress",
			"enrollments",
			"complementary_credit_activities",
		];
		const counts: Record<string, number> = {};
		for (const table of tables) {
			const row = raw.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number };
			counts[table] = row.n;
		}
		return counts;
	}

	it("a second run changes no counts", () => {
		// FK enforcement ON: the profile `INSERT OR REPLACE` is a DELETE
		// that cascades into `course_groups`, whose children
		// (`enrollments`, `course_schedule_blocks`) are NO ACTION. Without
		// the DELETE-before-REPLACE ordering the second run dies with
		// "FOREIGN KEY constraint failed" — which is the regression.
		raw.exec("PRAGMA foreign_keys = ON");

		const first = applySeed();
		const second = applySeed();

		expect(second).toEqual(first);
		expect(first.enrollments).toBe(7);
		expect(first.course_groups).toBe(468 + 7);
		expect(first.course_schedule_blocks).toBe(14);
	});

	it("seeds the demo student's group choices with the term name", () => {
		raw.exec("PRAGMA foreign_keys = ON");
		applySeed();

		const rows = raw
			.prepare("SELECT group_id, period FROM enrollments ORDER BY group_id")
			.all() as { group_id: string; period: string }[];
		expect(rows).toHaveLength(7);
		expect(rows.map((r) => r.period)).toEqual(Array(7).fill("AGOSTO-DICIEMBRE/2026"));
	});
});

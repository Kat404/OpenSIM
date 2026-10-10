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
import type { OfferBlock, OfferGroup } from "../../src/lib/components/simulador/types";
import {
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

interface ReinscripcionData {
	period: string;
	groups: (OfferGroup & { groupId: string })[];
	blocks: OfferBlock[];
	enrolledCanonicalIds: string[];
	enrolledBlocks: OfferBlock[];
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
		expect(data.groups).toHaveLength(CATALOGUE_SIZE + 1);
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
		expect(catalogueGroups).toHaveLength(CATALOGUE_SIZE);
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

		await expect(
			reinscripcionActions.enroll(postEnroll(["O-CAT0001-A-3-DOC-001"]) as never),
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
});

describe("seed.sql idempotence", () => {
	function applySeed(): Record<string, number> {
		const path = fileURLToPath(new URL("../../src/lib/server/db/seed.sql", import.meta.url));
		raw.exec(readFileSync(path, "utf8"));
		const tables = [
			"careers",
			"subjects",
			"subject_aliases",
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

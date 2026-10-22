/**
 * OpenSIM — `(protected)` loader unit tests (Phase 11 T11.5).
 *
 * The five loaders the request layer never exercised: horario,
 * dashboard, retícula, kardex and trámites. Each one owns a data
 * shape the page renders directly, so the assertions here are on the
 * returned envelope and on the filtering decisions (ENROLLED vs
 * APPROVED, today's day-letter, prerequisite-derived LOCKED).
 *
 * Unauthenticated behaviour differs per loader and that difference is
 * itself part of the contract:
 *   - dashboard throws a 302 redirect to /login
 *   - horario / retícula / kardex / trámites degrade to an empty,
 *     locked view
 *
 * All of them rely on the `(protected)` layout's `load` for the real
 * gate; the per-loader behaviour is the fallback if that layout ever
 * regresses.
 */

import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentAcademicPeriod } from "../../src/lib/server/enrollment";
import { PROCEDURE_UNAVAILABLE_NOTICE } from "../../src/lib/utils/procedure-labels";
import { getTodayDayLetter } from "../../src/lib/utils/time";
import { load as kardexLoad } from "../../src/routes/(protected)/academico/kardex/+page.server";
import { load as dashboardLoad } from "../../src/routes/(protected)/dashboard/+page.server";
import { load as horarioLoad } from "../../src/routes/(protected)/horario/+page.server";
import { load as reticulaLoad } from "../../src/routes/(protected)/reticula/+page.server";
import { load as temarioLoad } from "../../src/routes/(protected)/temario/+page.server";
import {
	actions as tramitesActions,
	load as tramitesLoad,
} from "../../src/routes/(protected)/tramites/+page.server";
import {
	makeEvent,
	makeUser,
	PERIOD,
	seedBlock,
	seedCareer,
	seedGroup,
	seedProfile,
	seedProgress,
	seedSubject,
	setWorkerDb,
	withTestDb,
} from "./_helpers/harness";

await vi.hoisted(async () => {
	(await import("./_helpers/harness")).installWorkerEnv();
});

const CONTROL = "12345678";
const PREVIOUS_PERIOD = "AGOSTO-DICIEMBRE/2025";

let raw: ReturnType<typeof withTestDb>["raw"];

/** One subject with an offer group and a Monday 08:00–10:00 block. */
function seedCurrentEnrollment(subject = { id: "sistemas-1", code: "SCC1027" }): void {
	seedSubject(raw, {
		canonicalId: subject.id,
		code: subject.code,
		name: `Materia ${subject.code}`,
	});
	seedGroup(raw, `G-${subject.code}-1`, subject.id, "A", CONTROL);
	seedBlock(raw, {
		groupId: `G-${subject.code}-1`,
		day: "L",
		startTime: "08:00",
		endTime: "10:00",
		classroom: "Lab 1",
	});
	seedProgress(raw, CONTROL, subject.id, "ENROLLED", PERIOD);
}

function anonymous() {
	return makeEvent({ user: null, url: "https://opensim.test/dashboard" });
}

function signedIn(overrides = {}) {
	return makeEvent({ user: makeUser(overrides), url: "https://opensim.test/dashboard" });
}

// A SvelteKit `PageServerLoad` is typed `MaybePromise<void | PageData>`,
// which makes every property access on the result a type error in the test.
// The loaders never actually return `void`, so each wrapper below narrows to
// the envelope the test asserts on.
interface HorarioItem {
	subject: { canonicalId: string; code: string; name: string };
	block: { day: string; startTime: string; endTime: string; classroom: string };
}

interface HorarioData {
	schedule: HorarioItem[];
	pending: PendingGroup[];
	period: string | null;
}

interface PendingGroup {
	subject: { canonicalId: string; code: string; name: string };
	group: { id: string; groupCode: string; teacherName: string };
}

interface TodayClass {
	code: string;
	name: string;
	subjectCanonicalId: string;
	startTime: string;
	endTime: string;
	classroom: string;
}

interface DashboardData {
	firstName: string;
	kpis: {
		certifiedAverage: number;
		arithmeticAverage: number;
		approvedCredits: number;
		totalCredits: number;
		advancePercentage: number;
	};
	todayClasses: TodayClass[];
	hasEnrollment: boolean;
	period: string | null;
}

interface ReticulaData {
	subjects: {
		canonicalId: string;
		code: string;
		name: string;
		semester: number;
		credits: number;
	}[];
	edges: { from: string; to: string }[];
	statusByCanonicalId: Record<string, string>;
}

interface KardexData {
	entries: {
		code: string;
		name: string;
		grade: number | null;
		credits: number;
		period: string;
		evaluationType: string | null;
		status: string;
	}[];
}

interface Procedure {
	id: string;
	label: string;
	description: string;
	creditsRequired: number;
	creditsHave: number;
	creditsRemaining: number;
	percentage: number;
	unlocked: boolean;
	blockedReason: string | null;
}

interface TramitesData {
	approvedCredits: number;
	complementaryCredits: number;
	complementaryRequired: number;
	totalCredits: number;
	socialServiceDone: boolean;
	procedures: Procedure[];
}

/**
 * Phase 10 S1 (2026-10-15): the credit lives on the activity row, not on the
 * subject. A transversal subject is worth one complementary credit for being
 * taken; the row records what it actually paid out.
 */
function seedComplementary(raw: DatabaseSync, count: number, credits = 1): void {
	for (let i = 0; i < count; i++) {
		seedSubject(raw, { canonicalId: `complementario-${i}`, code: `ITM-1${i}0` });
		raw
			.prepare(
				`INSERT INTO complementary_credit_activities
					(student_control_number, subject_canonical_id, period, credits)
				 VALUES (?, ?, ?, ?)`,
			)
			.run(CONTROL, `complementario-${i}`, PERIOD, credits);
	}
}

const loadHorario = async (event: unknown): Promise<HorarioData> =>
	(await horarioLoad(event as never)) as HorarioData;

const loadDashboard = async (event: unknown): Promise<DashboardData> =>
	(await dashboardLoad(event as never)) as DashboardData;

const loadReticula = async (event: unknown): Promise<ReticulaData> =>
	(await reticulaLoad(event as never)) as ReticulaData;

const loadKardex = async (event: unknown): Promise<KardexData> =>
	(await kardexLoad(event as never)) as KardexData;

const loadTramites = async (event: unknown): Promise<TramitesData> =>
	(await tramitesLoad(event as never)) as TramitesData;

interface TemarioSubtopic {
	index: string;
	title: string;
	evalFrom: string | null;
	evalTo: string | null;
}

interface TemarioUnit {
	unitNumber: number;
	title: string;
	subtopics: TemarioSubtopic[];
	evalFrom: string | null;
	evalTo: string | null;
	instruments: string[];
	criteria: string[];
}

interface TemarioSubject {
	canonicalId: string;
	code: string;
	name: string;
	units: TemarioUnit[];
}

interface TemarioData {
	subjects: TemarioSubject[];
	coverage: { withTemario: number; total: number };
}

const loadTemario = async (event: unknown): Promise<TemarioData> =>
	(await temarioLoad(event as never)) as TemarioData;

function seedUnit(raw: DatabaseSync, canonicalId: string, unitNumber: number, title: string): void {
	raw
		.prepare(
			`INSERT INTO subject_units (subject_canonical_id, unit_number, title, subtopics_json)
			 VALUES (?, ?, ?, '[]')`,
		)
		.run(canonicalId, unitNumber, title);
}

function procedureById(data: TramitesData, id: string): Procedure {
	const found = data.procedures.find((p) => p.id === id);
	if (!found) throw new Error(`no procedure ${id}`);
	return found;
}

beforeEach(() => {
	({ raw } = withTestDb());
	seedCareer(raw);
	seedProfile(raw);
});

afterEach(() => {
	raw.close();
});

describe("temario loader", () => {
	it("returns an empty coverage view for an anonymous visitor", async () => {
		const result = await loadTemario(anonymous());
		expect(result).toEqual({ subjects: [], coverage: { withTemario: 0, total: 0 } });
	});

	// T9.12 — operator decision 2026-10-13: explicit coverage. The numbers
	// the page shows must come from the DB, never from a hard-coded ratio.

	it("counts the subjects that have a temario against the whole plan", async () => {
		seedSubject(raw, {
			canonicalId: "aec-1034",
			code: "AEC1034",
			name: "Sistemas de comunicación",
		});
		seedUnit(raw, "aec-1034", 1, "UNIDAD 1");
		seedUnit(raw, "aec-1034", 2, "UNIDAD 2");
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027", name: "Programación" });

		const result = await loadTemario(signedIn());
		expect(result.coverage).toEqual({ withTemario: 1, total: 2 });
		const conTemario = result.subjects.find((s) => s.canonicalId === "aec-1034");
		expect(conTemario?.units).toHaveLength(2);
	});

	it("returns an empty unit list for a subject the portal does not publish", async () => {
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027", name: "Programación" });

		const result = await loadTemario(signedIn());
		const sinTemario = result.subjects.find((s) => s.canonicalId === "sistemas-1");
		expect(sinTemario?.units).toEqual([]);
		expect(result.coverage).toEqual({ withTemario: 0, total: 1 });
	});

	it("parses subtopics, instruments and criteria out of their JSON columns", async () => {
		seedSubject(raw, { canonicalId: "aec-1034", code: "AEC1034" });
		raw
			.prepare(
				`INSERT INTO subject_units
					(subject_canonical_id, unit_number, title, subtopics_json, eval_from, eval_to, instruments, criteria)
				 VALUES ('aec-1034', 1, 'UNIDAD 1', ?, '24/08/2026', '28/08/2026', ?, ?)`,
			)
			.run(
				JSON.stringify([
					{ index: "1.1", title: "IMPACTO", evalFrom: "24/08/2026", evalTo: "28/08/2026" },
				]),
				JSON.stringify(["CÁTEDRA DOCENTE"]),
				JSON.stringify(["EVALUACIÓN ESCRITA"]),
			);

		const result = await loadTemario(signedIn());
		const unit = result.subjects[0]?.units[0];
		expect(unit?.title).toBe("UNIDAD 1");
		expect(unit?.evalFrom).toBe("24/08/2026");
		expect(unit?.evalTo).toBe("28/08/2026");
		expect(unit?.subtopics).toEqual([
			{ index: "1.1", title: "IMPACTO", evalFrom: "24/08/2026", evalTo: "28/08/2026" },
		]);
		expect(unit?.instruments).toEqual(["CÁTEDRA DOCENTE"]);
		expect(unit?.criteria).toEqual(["EVALUACIÓN ESCRITA"]);
	});

	it("survives a unit whose JSON columns are absent or malformed", async () => {
		seedSubject(raw, { canonicalId: "aec-1034", code: "AEC1034" });
		raw
			.prepare(
				`INSERT INTO subject_units (subject_canonical_id, unit_number, title, subtopics_json)
				 VALUES ('aec-1034', 1, 'UNIDAD 1', 'no es json')`,
			)
			.run();

		const result = await loadTemario(signedIn());
		const unit = result.subjects[0]?.units[0];
		expect(unit?.title).toBe("UNIDAD 1");
		expect(unit?.subtopics).toEqual([]);
		expect(unit?.instruments).toEqual([]);
		expect(unit?.evalFrom).toBeNull();
	});

	it("survives a subtopics array holding a null", async () => {
		seedSubject(raw, { canonicalId: "aec-1034", code: "AEC1034" });
		raw
			.prepare(
				`INSERT INTO subject_units (subject_canonical_id, unit_number, title, subtopics_json)
				 VALUES ('aec-1034', 1, 'UNIDAD 1', ?)`,
			)
			.run(JSON.stringify([null, "texto", 7, { index: "1.1", title: "OK" }]));

		const result = await loadTemario(signedIn());
		const unit = result.subjects[0]?.units[0];
		expect(unit?.subtopics).toHaveLength(4);
		expect(unit?.subtopics[3]).toEqual({ index: "1.1", title: "OK", evalFrom: null, evalTo: null });
		expect(unit?.subtopics[0]).toEqual({ index: "", title: "", evalFrom: null, evalTo: null });
	});

	it("orders subjects by code so SSR and CSR agree", async () => {
		seedSubject(raw, { canonicalId: "z-1", code: "ZZZ999" });
		seedSubject(raw, { canonicalId: "a-1", code: "AAA111" });

		const result = await loadTemario(signedIn());
		expect(result.subjects.map((s) => s.code)).toEqual(["AAA111", "ZZZ999"]);
	});
});

describe("horario loader", () => {
	it("returns an empty schedule for an anonymous visitor", async () => {
		const result = await loadHorario(anonymous());
		expect(result).toEqual({ schedule: [], pending: [], period: null });
	});

	it("joins the enrollment's blocks with the subjects catalog", async () => {
		seedCurrentEnrollment();
		const result = await loadHorario(signedIn());

		expect(result.period).toBe(PERIOD);
		expect(result.schedule).toEqual([
			{
				subject: { canonicalId: "sistemas-1", code: "SCC1027", name: "Materia SCC1027" },
				block: { day: "L", startTime: "08:00", endTime: "10:00", classroom: "Lab 1" },
			},
		]);
	});

	it("returns an empty schedule (no synthetic data) when the student is enrolled in nothing", async () => {
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027" });
		seedProgress(raw, CONTROL, "sistemas-1", "APPROVED", PREVIOUS_PERIOD);

		const result = await loadHorario(signedIn());
		expect(result.schedule).toEqual([]);
		expect(result.pending).toEqual([]);
		expect(result.period).toBeNull();
	});

	// T9.11 — H11: the SIM publishes no schedule for an OFFERED group. The
	// schedule only exists once the student is enrolled. So an enrolled
	// group with no blocks is real data with a known cause, not an empty
	// grid and not a rendering failure.

	it("lists an enrolled group with no blocks as pending, not as an empty schedule", async () => {
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027", name: "Programación" });
		seedGroup(raw, "G-SCC1027-9", "sistemas-1", "9B", CONTROL);
		seedProgress(raw, CONTROL, "sistemas-1", "ENROLLED", PERIOD);

		const result = await loadHorario(signedIn());
		expect(result.schedule).toEqual([]);
		expect(result.pending).toEqual([
			{
				subject: { canonicalId: "sistemas-1", code: "SCC1027", name: "Programación" },
				group: { id: "G-SCC1027-9", groupCode: "9B", teacherName: "Docente Prueba" },
			},
		]);
		expect(result.period).toBe(PERIOD);
	});

	it("does not list a scheduled group as pending", async () => {
		seedCurrentEnrollment();
		const result = await loadHorario(signedIn());
		expect(result.pending).toEqual([]);
	});

	it("keeps scheduled and pending groups in one answer when both exist", async () => {
		seedCurrentEnrollment();
		seedSubject(raw, { canonicalId: "sistemas-2", code: "SCC1042", name: "Bases de datos" });
		seedGroup(raw, "G-SCC1042-7", "sistemas-2", "7A", CONTROL);
		seedProgress(raw, CONTROL, "sistemas-2", "ENROLLED", PERIOD);

		const result = await loadHorario(signedIn());
		expect(result.schedule).toHaveLength(1);
		expect(result.pending).toHaveLength(1);
		expect(result.pending[0]?.subject.code).toBe("SCC1042");
	});

	it("never lists an offering-catalogue group as this student's pending", async () => {
		// `student_control_number IS NULL` is a catalogue row, not an
		// enrolment. Offering groups have no schedule either, so counting
		// them would paint 468 phantom subjects on the grid.
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027" });
		seedGroup(raw, "G-CATALOGO-1", "sistemas-1", "A", null);
		seedProgress(raw, CONTROL, "sistemas-1", "ENROLLED", PERIOD);

		const result = await loadHorario(signedIn());
		expect(result.pending).toEqual([]);
		expect(result.schedule).toEqual([]);
	});

	it("sorts the grid by weekday order, not by insertion order", async () => {
		seedCurrentEnrollment();
		raw
			.prepare(
				`INSERT INTO course_schedule_blocks (group_id, day, start_time, end_time, classroom)
				 VALUES ('G-SCC1027-1', 'X', '12:00', '14:00', 'Aula 3')`,
			)
			.run();

		const result = await loadHorario(signedIn());
		// Monday first, Wednesday second — a stable order for SSR/CSR parity.
		expect(result.schedule.map((c) => c.block.day)).toEqual(["L", "X"]);
	});

	it("drops a block whose day letter is not on the TecNM grid, and says so", async () => {
		seedCurrentEnrollment();
		raw
			.prepare(
				`INSERT INTO course_schedule_blocks (group_id, day, start_time, end_time, classroom)
				 VALUES ('G-SCC1027-1', 'Q', '12:00', '14:00', 'Aula 3')`,
			)
			.run();

		// A block that vanishes without a trace is a class the student
		// does not see and cannot explain. The drop is logged, with the
		// value that caused it.
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const result = await loadHorario(signedIn());
			expect(result.schedule.map((c) => c.block.day)).toEqual(["L"]);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('"Q"'));
		} finally {
			warn.mockRestore();
		}
	});

	it("skips a block whose subject is missing from the catalog", async () => {
		seedCurrentEnrollment();
		// The catalog row is gone (spec pins FKs at insert time, so this
		// is the defensive path the loader's `if (!info) continue` covers).
		raw.exec("PRAGMA foreign_keys = OFF");
		raw.prepare("DELETE FROM subjects WHERE canonical_id = 'sistemas-1'").run();
		raw.exec("PRAGMA foreign_keys = ON");

		const result = await loadHorario(signedIn());
		expect(result.schedule).toEqual([]);
		expect(result.period).toBe(PERIOD);
	});

	it("KNOWN DEFECT: a student with only APPROVED history resolves to period null", async () => {
		// `horario` calls `getCurrentPeriod`, which reads ENROLLED rows
		// only (`src/lib/server/enrollment.ts:74`). Phase 10 T10.4 fixed
		// exactly this blind spot for `reinscripcion` by falling back to
		// `getLatestProgressPeriod` → `currentAcademicPeriod`; horario,
		// dashboard and the carga export were not given the same fallback,
		// so a student mid-transfer between terms sees an empty grid and
		// `period: null` even though their last term is on file. Reported,
		// not fixed here. Characterization test: it passes because the
		// current (incomplete) behaviour is what is pinned.
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027" });
		seedGroup(raw, "G-SCC1027-1", "sistemas-1", "A", CONTROL);
		seedBlock(raw, { groupId: "G-SCC1027-1", day: "L", startTime: "08:00", endTime: "10:00" });
		seedProgress(raw, CONTROL, "sistemas-1", "APPROVED", PREVIOUS_PERIOD);

		const result = await loadHorario(signedIn());
		expect(result).toEqual({ schedule: [], pending: [], period: null });
	});

	it("ignores the enrollment of a different student", async () => {
		seedProfile(raw, { controlNumber: "87654321", fullName: "Grace Hopper Ramirez" });
		// Offer catalog exists, but the ENROLLED row belongs to the other
		// student, so the signed-in student's grid must stay empty.
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027" });
		seedGroup(raw, "G-SCC1027-1", "sistemas-1", "A", CONTROL);
		seedBlock(raw, {
			groupId: "G-SCC1027-1",
			day: "L",
			startTime: "08:00",
			endTime: "10:00",
		});
		seedProgress(raw, "87654321", "sistemas-1", "ENROLLED", PERIOD);

		const result = await loadHorario(signedIn());
		expect(result.schedule).toEqual([]);
		expect(result.period).toBeNull();
	});
});

describe("dashboard loader", () => {
	// The dashboard widget shows only the blocks of TODAY's weekday, and
	// the loader asks the real clock which day that is. The fixture
	// above pins its block to Monday, so without a frozen clock this
	// suite failed every Monday. Wednesday 2026-10-14 12:00 in Morelia
	// is a Wednesday, which is neither the fixture's Monday nor the
	// letter the test builds its own blocks around.
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-14T18:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("redirects an anonymous visitor to /login", async () => {
		// The only loader of the five that refuses outright rather than
		// rendering an empty shell.
		await expect(loadDashboard(anonymous())).rejects.toMatchObject({
			status: 302,
			location: "/login",
		});
	});

	it("returns the KPI envelope from the student profile", async () => {
		const result = await loadDashboard(signedIn());

		expect(result.firstName).toBe("Ada");
		expect(result.kpis).toEqual({
			certifiedAverage: 88.5,
			arithmeticAverage: 87.2,
			approvedCredits: 182,
			totalCredits: 260,
			advancePercentage: 70,
		});
		expect(result.hasEnrollment).toBe(false);
		expect(result.todayClasses).toEqual([]);
		expect(result.period).toBeNull();
	});

	it("reports hasEnrollment only for a current ENROLLED row", async () => {
		seedCurrentEnrollment();
		const result = await loadDashboard(signedIn());
		expect(result.hasEnrollment).toBe(true);
		expect(result.period).toBe(PERIOD);
	});

	it("does not count a fully-approved student with no current enrollment as enrolled", async () => {
		// Audit M1 regression guard: the old loader counted all progress
		// rows, so an approved-only student looked enrolled.
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027" });
		seedProgress(raw, CONTROL, "sistemas-1", "APPROVED", PREVIOUS_PERIOD);

		const result = await loadDashboard(signedIn());
		expect(result.hasEnrollment).toBe(false);
	});

	it("returns only today's classes from the weekly schedule", async () => {
		seedCurrentEnrollment();
		// A second block on a different day, plus one on today's letter in
		// the afternoon: `getTodayDayLetter` decides which survive.
		const today = getTodayDayLetter();
		seedSubject(raw, { canonicalId: "algebra-1", code: "SCC0901", name: "Álgebra" });
		seedGroup(raw, "G-SCC0901-1", "algebra-1", "A", CONTROL);
		seedProgress(raw, CONTROL, "algebra-1", "ENROLLED", PERIOD);
		const otherDay = today === "V" ? "L" : "V";
		seedBlock(raw, {
			groupId: "G-SCC0901-1",
			day: otherDay,
			startTime: "12:00",
			endTime: "14:00",
			classroom: "Aula 3",
		});
		seedBlock(raw, {
			groupId: "G-SCC0901-1",
			day: today,
			startTime: "16:00",
			endTime: "18:00",
			classroom: "Aula 4",
		});

		const result = await loadDashboard(signedIn());

		expect(result.todayClasses.map((c) => c.code)).toEqual(["SCC0901"]);
		expect(result.todayClasses[0]).toMatchObject({
			startTime: "16:00",
			endTime: "18:00",
			classroom: "Aula 4",
		});
	});

	it("falls back to the session's KPIs when the profile query returns nothing", async () => {
		raw.exec("PRAGMA foreign_keys = OFF");
		raw.prepare("DELETE FROM student_profiles WHERE control_number = ?").run(CONTROL);
		raw.exec("PRAGMA foreign_keys = ON");

		const result = await loadDashboard(signedIn());
		expect(result.kpis.approvedCredits).toBe(182);
		expect(result.hasEnrollment).toBe(false);
	});
});

describe("retícula loader", () => {
	beforeEach(() => {
		seedSubject(raw, { canonicalId: "base-1", code: "SCC0501", semester: 1 });
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027", semester: 2 });
	});

	it("returns an empty graph for an anonymous visitor", async () => {
		const result = await loadReticula(anonymous());
		expect(result).toEqual({ subjects: [], edges: [], statusByCanonicalId: {} });
	});

	it("returns the catalog, prerequisite edges and derived statuses", async () => {
		raw
			.prepare(
				"INSERT INTO subject_prerequisites (subject_canonical_id, prerequisite_canonical_id) VALUES (?, ?)",
			)
			.run("sistemas-1", "base-1");

		const result = await loadReticula(signedIn());

		expect(result.subjects.map((s) => s.canonicalId)).toEqual(["base-1", "sistemas-1"]);
		expect(result.edges).toEqual([{ from: "base-1", to: "sistemas-1" }]);
		// No APPROVED prereq yet → LOCKED; the root subject is AVAILABLE.
		expect(result.statusByCanonicalId).toEqual({
			"base-1": "AVAILABLE",
			"sistemas-1": "LOCKED",
		});
	});

	it("unlocks a subject once its prerequisite is APPROVED", async () => {
		raw
			.prepare(
				"INSERT INTO subject_prerequisites (subject_canonical_id, prerequisite_canonical_id) VALUES (?, ?)",
			)
			.run("sistemas-1", "base-1");
		seedProgress(raw, CONTROL, "base-1", "APPROVED", PREVIOUS_PERIOD);

		const result = await loadReticula(signedIn());
		expect(result.statusByCanonicalId["sistemas-1"]).toBe("AVAILABLE");
	});

	it("keeps an explicit progress row over the derived status", async () => {
		raw
			.prepare(
				"INSERT INTO subject_prerequisites (subject_canonical_id, prerequisite_canonical_id) VALUES (?, ?)",
			)
			.run("sistemas-1", "base-1");
		// Prereq not approved, so derivation would say LOCKED; the
		// student's own ENROLLED row must win.
		seedProgress(raw, CONTROL, "sistemas-1", "ENROLLED", PERIOD);

		const result = await loadReticula(signedIn());
		expect(result.statusByCanonicalId["sistemas-1"]).toBe("ENROLLED");
	});

	it("never leaks another student's progress", async () => {
		seedProfile(raw, { controlNumber: "87654321", fullName: "Grace Hopper Ramirez" });
		seedProgress(raw, "87654321", "base-1", "APPROVED", PREVIOUS_PERIOD);

		const result = await loadReticula(signedIn());
		expect(result.statusByCanonicalId["base-1"]).toBe("AVAILABLE");
	});
});

describe("kardex loader", () => {
	it("returns no entries for an anonymous visitor", async () => {
		const result = await loadKardex(anonymous());
		expect(result).toEqual({ entries: [] });
	});

	it("returns one uniform row per progress entry joined to the catalog", async () => {
		seedSubject(raw, {
			canonicalId: "sistemas-1",
			code: "SCC1027",
			name: "Programación",
			credits: 6,
		});
		raw
			.prepare(
				`INSERT INTO student_progress
					(student_control_number, subject_canonical_id, status, grade, evaluation_type, period)
				 VALUES (?, ?, 'APPROVED', 92.5, 'ORDINARIO', ?)`,
			)
			.run(CONTROL, "sistemas-1", PREVIOUS_PERIOD);

		const result = await loadKardex(signedIn());

		expect(result.entries).toEqual([
			{
				code: "SCC1027",
				name: "Programación",
				grade: 92.5,
				credits: 6,
				period: PREVIOUS_PERIOD,
				evaluationType: "ORDINARIO",
				status: "APPROVED",
			},
		]);
	});

	it("normalises a missing evaluation type to null", async () => {
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027" });
		seedProgress(raw, CONTROL, "sistemas-1", "ENROLLED", PERIOD);

		const result = await loadKardex(signedIn());
		expect(result.entries[0]).toMatchObject({ evaluationType: null, grade: null });
	});

	it("returns an empty list for a student with no academic history", async () => {
		const result = await loadKardex(signedIn());
		expect(result.entries).toEqual([]);
	});
});

describe("trámites loader", () => {
	it("locks all three procedures with an explicit 'no autenticado' reason", async () => {
		const result = await loadTramites(anonymous());

		expect(result.approvedCredits).toBe(0);
		expect(result.totalCredits).toBe(260);
		expect(result.socialServiceDone).toBe(false);
		expect(result.procedures.map((p) => p.id)).toEqual([
			"servicio-social",
			"residencia",
			"titulacion",
		]);
		expect(result.procedures.every((p) => !p.unlocked)).toBe(true);
		expect(result.procedures[0]?.blockedReason).toBe("No autenticado. Inicia sesión.");
	});

	it("unlocks Servicio Social at 182 approved credits and 5 complementary credits", async () => {
		seedComplementary(raw, 5);
		const result = await loadTramites(signedIn({ approvedCredits: 182, remainingCredits: 78 }));
		const social = procedureById(result, "servicio-social");
		expect(social.unlocked).toBe(true);
		expect(social.blockedReason).toBeNull();
		expect(social.creditsRemaining).toBe(0);
		// Residencia needs 208, so it stays locked with a count of the gap.
		const residencia = procedureById(result, "residencia");
		expect(residencia.unlocked).toBe(false);
		expect(residencia.blockedReason).toContain("Necesitas 26 créditos más");
	});

	// T9.13 — the complementary gate is a SECOND gate on the loader, not
	// only on the pure function.

	it("keeps Servicio Social locked at 182 approved credits with no complementary credits", async () => {
		const result = await loadTramites(signedIn({ approvedCredits: 182, remainingCredits: 78 }));
		const social = procedureById(result, "servicio-social");
		expect(result.complementaryCredits).toBe(0);
		expect(social.unlocked).toBe(false);
		expect(social.blockedReason).toContain("5 créditos complementarios más");
	});

	// Phase 10 S1/S4: the total is the SUM of what each activity paid out, not a
	// row count. This is the assertion T9.13 could not have made, because at the
	// time every subject carried no weight and both readings coincided.

	it("sums each completed activity's own credit, not the number of rows", async () => {
		seedComplementary(raw, 3, 2);
		const result = await loadTramites(signedIn());
		expect(result.complementaryCredits).toBe(6);
		expect(result.complementaryRequired).toBe(5);
	});

	it("unlocks Servicio Social on 4 credits when one activity is worth 2", async () => {
		// Two rows, four credits: a row count would have said 2 and kept the
		// gate closed with the gate's own data sitting in the table.
		seedComplementary(raw, 2, 2);
		const result = await loadTramites(signedIn());
		expect(result.complementaryCredits).toBe(4);
		expect(procedureById(result, "servicio-social").unlocked).toBe(false);
		expect(procedureById(result, "servicio-social").blockedReason).toContain(
			"1 créditos complementarios más",
		);
	});

	it("counts only THIS student's complementary activities", async () => {
		seedComplementary(raw, 5);
		seedProfile(raw, { controlNumber: "87654321", fullName: "Grace Hopper Ramirez" });
		raw
			.prepare(
				`INSERT INTO complementary_credit_activities
					(student_control_number, subject_canonical_id, period)
				 VALUES ('87654321', 'complementario-0', ?)`,
			)
			.run(PERIOD);
		// Six rows exist in the table; this student owns five of them.
		const total = raw
			.prepare("SELECT COUNT(*) AS n FROM complementary_credit_activities")
			.get() as { n: number };
		expect(total.n).toBe(6);
		const result = await loadTramites(signedIn());
		expect(result.complementaryCredits).toBe(5);
		// 182 reticular + exactly 5 complementary clears both gates.
		expect(procedureById(result, "servicio-social").unlocked).toBe(true);
	});

	it("counts an external complementary activity that has no subject", async () => {
		// Phase 10 S1 (2026-10-15): the four transversal subjects are not the
		// only route to the block. A course, a workshop or an outside
		// participation is an activity with NO subject, and it still counts.
		// Before this the column was NOT NULL and the credit came from the
		// subject, so an external activity was not even representable.
		raw
			.prepare(
				`INSERT INTO complementary_credit_activities
					(student_control_number, subject_canonical_id, period, credits)
				 VALUES (?, NULL, ?, 1)`,
			)
			.run(CONTROL, PERIOD);
		const result = await loadTramites(signedIn());
		expect(result.complementaryCredits).toBe(1);
	});

	it("reaches the 5-credit block with the four transversals plus one external activity", async () => {
		// The operator's rule in one test: the four transversal subjects are
		// worth 1 each and stop at 4, and the fifth comes from outside them.
		// Under 0015 this was impossible by construction — the weights had to
		// add up to 5 or the seed refused to run.
		seedComplementary(raw, 4, 1);
		raw
			.prepare(
				`INSERT INTO complementary_credit_activities
					(student_control_number, subject_canonical_id, period, credits)
				 VALUES (?, NULL, ?, 1)`,
			)
			.run(CONTROL, PERIOD);
		const result = await loadTramites(signedIn({ approvedCredits: 182, remainingCredits: 78 }));
		expect(result.complementaryCredits).toBe(5);
		expect(procedureById(result, "servicio-social").unlocked).toBe(true);
	});

	it("sums a subject-less activity at whatever weight it was recognised with", async () => {
		// S1: the weight belongs to the ACTIVITY, so an external course is worth
		// what the institution gave it for. A 5-credit course is exactly how the
		// block is completed without touching the four transversals — which is
		// what makes `subjects.complementary_credits` impossible to keep.
		seedComplementary(raw, 4, 1);
		raw
			.prepare(
				`INSERT INTO complementary_credit_activities
					(student_control_number, subject_canonical_id, period, credits)
				 VALUES (?, NULL, ?, 5)`,
			)
			.run(CONTROL, PERIOD);
		const result = await loadTramites(signedIn({ approvedCredits: 182, remainingCredits: 78 }));
		expect(result.complementaryCredits).toBe(9);
		expect(procedureById(result, "servicio-social").unlocked).toBe(true);
	});

	it("leaves Residencia unlocked even when the complementary gate is unmet", async () => {
		raw.prepare("UPDATE student_profiles SET approved_credits = 240, remaining_credits = 20").run();
		const result = await loadTramites(signedIn());
		expect(procedureById(result, "residencia").unlocked).toBe(true);
		expect(procedureById(result, "servicio-social").unlocked).toBe(false);
	});

	it("keeps Titulación locked until both Residencia and Servicio Social are done", async () => {
		seedSubject(raw, { canonicalId: "servicio-social", code: "SS1000" });
		seedProgress(raw, CONTROL, "servicio-social", "APPROVED", PREVIOUS_PERIOD);
		// 240 credits clears both credit gates (182 social / 208 residencia).
		// The loader reads the profile row, not the session snapshot.
		raw.prepare("UPDATE student_profiles SET approved_credits = 240, remaining_credits = 20").run();

		const withoutService = await loadTramites(signedIn());
		expect(withoutService.approvedCredits).toBe(240);
		expect(withoutService.socialServiceDone).toBe(true);
		expect(procedureById(withoutService, "titulacion").unlocked).toBe(true);

		// Same credits, but the social-service row is missing.
		raw
			.prepare("DELETE FROM student_progress WHERE subject_canonical_id = 'servicio-social'")
			.run();
		const withoutServiceRow = await loadTramites(signedIn());
		const titulacion = procedureById(withoutServiceRow, "titulacion");
		expect(withoutServiceRow.socialServiceDone).toBe(false);
		expect(titulacion.unlocked).toBe(false);
		expect(titulacion.blockedReason).toBe("Debes completar el Servicio Social antes de titularte");
	});

	it("reads the credit totals from the profile row, not the session snapshot", async () => {
		raw
			.prepare("UPDATE student_profiles SET approved_credits = 100, remaining_credits = 160")
			.run();
		const result = await loadTramites(signedIn({ approvedCredits: 182, remainingCredits: 78 }));
		expect(result.approvedCredits).toBe(100);
	});

	it("clamps the percentage at 100 for an over-credited student", async () => {
		raw.prepare("UPDATE student_profiles SET approved_credits = 300").run();
		const result = await loadTramites(signedIn({ approvedCredits: 300 }));
		const social = procedureById(result, "servicio-social");
		expect(social.percentage).toBe(100);
		expect(social.creditsRemaining).toBe(0);
	});
});

describe("trámites form action", () => {
	it("returns 401 for an anonymous POST", async () => {
		// SvelteKit 3 runs the action before any layout `load`, so this
		// explicit guard is the only thing protecting the surface.
		const event = makeEvent({
			user: null,
			url: "https://opensim.test/tramites",
			formData: { procedure: "titulacion" },
		});
		const result = (await tramitesActions.default(event as never)) as {
			status: number;
			data: { error: string };
		};
		expect(result.status).toBe(401);
		expect(result.data.error).toBe("No autenticado. Inicia sesión.");
	});

	it("returns 400 for an unrecognised procedure id", async () => {
		const event = makeEvent({
			user: makeUser(),
			url: "https://opensim.test/tramites",
			formData: { procedure: "inventado" },
		});
		const result = (await tramitesActions.default(event as never)) as {
			status: number;
			data: { error: string; procedure: string };
		};
		expect(result.status).toBe(400);
		expect(result.data.procedure).toBe("inventado");
	});

	it("refuses the three known procedure ids: OpenSIM does not store trámites yet", async () => {
		for (const procedure of ["servicio-social", "residencia", "titulacion"]) {
			const event = makeEvent({
				user: makeUser(),
				url: "https://opensim.test/tramites",
				formData: { procedure },
			});
			const result = (await tramitesActions.default(event as never)) as {
				status: number;
				data: { notice: string };
			};
			// Phase 12 T12.1: the stub is no longer dressed as "accepted".
			// 202 said "we took it"; nothing was taken, and the forms are
			// disabled on screen, so the honest answer is 501.
			expect(result.status).toBe(501);
			expect(result.data.notice).toBe(PROCEDURE_UNAVAILABLE_NOTICE);
		}
	});
});

describe("loaders without a D1 binding", () => {
	it("renders a neutral degraded view instead of throwing", async () => {
		setWorkerDb(null);

		await expect(loadHorario(signedIn())).resolves.toEqual({
			schedule: [],
			pending: [],
			period: null,
		});
		await expect(loadKardex(signedIn())).resolves.toEqual({ entries: [] });
		await expect(loadReticula(signedIn())).resolves.toEqual({
			subjects: [],
			edges: [],
			statusByCanonicalId: {},
		});

		const tramites = await loadTramites(signedIn());
		expect(tramites.approvedCredits).toBe(0);
		expect(tramites.procedures[0]?.blockedReason).toBe("Servicio no disponible");

		// Dashboard still refuses an anonymous visitor before checking D1.
		await expect(loadDashboard(anonymous())).rejects.toMatchObject({ status: 302 });
	});
});

describe("currentAcademicPeriod — first-enrolment fallback", () => {
	it("derives a term from the calendar when the student has no rows", () => {
		// The helper `reinscripcion` uses (Phase 10 T10.4) to escape the
		// first-enrolment deadlock. The other loaders still call
		// `getCurrentPeriod`, which reads ENROLLED rows only, so this is
		// NOT reachable from horario/dashboard — see the defect note in
		// the horario suite.
		expect(currentAcademicPeriod(new Date("2026-10-06T12:00:00Z"))).toBe("AGOSTO-DICIEMBRE/2026");
		expect(currentAcademicPeriod(new Date("2026-03-06T12:00:00Z"))).toBe("ENERO-JUNIO/2026");
	});
});

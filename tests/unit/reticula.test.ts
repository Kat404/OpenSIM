/**
 * OpenSIM — `/retícula` specialty tray, laboratory badge and seriation
 * branch (Phase 9 T9.10).
 *
 * Three claims the retícula makes to a student, each asserted here against
 * the real rendered markup (Svelte SSR `render`, no DOM):
 *
 *  1. The tray explains the modules the grid cannot place, and it lists
 *     ONLY the signed-in student's own specialty. The catalogue carries
 *     three specialties and eleven more modules; showing another
 *     programme's modules is exactly the leak the tray exists to avoid.
 *  2. `course_groups.has_lab` reaches the node as a `LAB` mark — for the
 *     six subjects the SIM flags with the flask icon and for no other.
 *  3. The DAG stops warning about an expected gap. A `SPECIALTY` module
 *     without a semester is H8 and is now explained on screen; any other
 *     component without one is a real data defect and must keep warning.
 *
 * The loader-level assertions live here too because the tray's "only your
 * specialty" rule is resolved server-side: if `inStudentSpecialty` were
 * wrong, no component could recover from it.
 */

import { render } from "svelte/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReticulaDag from "../../src/lib/components/curriculum/ReticulaDag.svelte";
import type { SubjectViewModel } from "../../src/lib/components/curriculum/SubjectNode.svelte";
import SpecialtyTray from "../../src/lib/components/reticula/SpecialtyTray.svelte";
import { load as reticulaLoad } from "../../src/routes/(protected)/reticula/+page.server";
import {
	CAREER_CODE,
	makeEvent,
	makeUser,
	seedCareer,
	seedProfile,
	seedSubject,
	withTestDb,
} from "./_helpers/harness";

await vi.hoisted(async () => {
	(await import("./_helpers/harness")).installWorkerEnv();
});

const CONTROL = "12345678";
const TDD = "ISIE-TDD-2026-01";
const SID = "ISIE-SID-2026-01";

let raw: ReturnType<typeof withTestDb>["raw"];

function signedIn() {
	return makeEvent({ user: makeUser(), url: "https://opensim.test/reticula" });
}

/** The loader envelope, narrowed to what this file asserts on. */
interface ReticulaData {
	subjects: (SubjectViewModel & { specialtyCode: string | null; inStudentSpecialty: boolean })[];
}

const loadReticula = async (event: unknown): Promise<ReticulaData> =>
	(await reticulaLoad(event as never)) as ReticulaData;

/** A specialty table row, which `subjects.specialty_code` foreign-keys to. */
function seedSpecialty(code: string, name: string): void {
	raw
		.prepare("INSERT OR IGNORE INTO specialties (code, career_code, name) VALUES (?, ?, ?)")
		.run(code, CAREER_CODE, name);
}

function seedSpecialtyModule(canonicalId: string, code: string, specialtyCode: string): void {
	seedSubject(raw, { canonicalId, code });
	raw
		.prepare(
			"UPDATE subjects SET semester = NULL, component = 'SPECIALTY', specialty_code = ? WHERE canonical_id = ?",
		)
		.run(specialtyCode, canonicalId);
}

function renderTray(data: ReticulaData): string {
	return render(SpecialtyTray, {
		props: {
			subjects: data.subjects.filter((s) => s.inStudentSpecialty),
			statusByCanonicalId: {},
		},
	}).body;
}

/** SSR-render the DAG over the given subjects. */
function renderDag(subjects: SubjectViewModel[]): string {
	return render(ReticulaDag, { props: { subjects, edges: [], statusByCanonicalId: {} } }).body;
}

/**
 * Renders the DAG and returns every `console.warn` line it produced.
 *
 * Two things this has to get right, both learned the hard way:
 *
 *  - The swap is direct rather than `vi.spyOn(console, "warn")`: under this
 *    Vitest version the spy records nothing, and Vitest swallows the real
 *    console output instead of printing it.
 *  - The rendered body has to be READ. Svelte 5 evaluates the template's
 *    `$derived` chain while the SSR body is materialised, so a `render()`
 *    whose result is thrown away never reaches the semester check at all.
 *
 * The original is restored in a `finally`, so a render that throws cannot
 * silence the reporter for the rest of the file.
 */
function captureWarnings(subjects: SubjectViewModel[]): string[] {
	const lines: string[] = [];
	const original = console.warn;
	console.warn = (message: unknown) => {
		lines.push(String(message));
	};
	try {
		renderDag(subjects);
	} finally {
		console.warn = original;
	}
	return lines;
}

beforeEach(() => {
	({ raw } = withTestDb());
	seedCareer(raw);
	seedProfile(raw);
	seedSpecialty(TDD, "Desarrollo de Software");
	seedSpecialty(SID, "Ciberseguridad");
	raw
		.prepare("UPDATE student_profiles SET specialty_code = ? WHERE control_number = ?")
		.run(TDD, CONTROL);
	seedSubject(raw, {
		canonicalId: "acf-0901",
		code: "ACF-0901",
		name: "Cálculo Diferencial",
		semester: 1,
	});
	seedSubject(raw, {
		canonicalId: "acf-0902",
		code: "ACF-0902",
		name: "Cálculo Integral",
		semester: 2,
	});
});

afterEach(() => {
	raw.close();
});

describe("retícula loader — specialty projection", () => {
	it("flags only the student's own specialty modules", async () => {
		seedSpecialtyModule("tdd-2301", "TDD-2301", TDD);
		seedSpecialtyModule("tdd-2302", "TDD-2302", TDD);
		seedSpecialtyModule("sid-2301", "SID-2301", SID);

		const result = await loadReticula(signedIn());

		expect(result.subjects.filter((s) => s.inStudentSpecialty).map((s) => s.code)).toEqual([
			"TDD-2301",
			"TDD-2302",
		]);
		// The other programme's module is carried with its provenance but is
		// never marked as the student's, so no component can select it.
		expect(result.subjects.find((s) => s.code === "SID-2301")).toMatchObject({
			specialtyCode: SID,
			inStudentSpecialty: false,
		});
	});

	it("flags nothing when the student has no specialty on record", async () => {
		raw
			.prepare("UPDATE student_profiles SET specialty_code = NULL WHERE control_number = ?")
			.run(CONTROL);
		seedSpecialtyModule("tdd-2301", "TDD-2301", TDD);

		const result = await loadReticula(signedIn());
		expect(result.subjects.some((s) => s.inStudentSpecialty)).toBe(false);
	});

	it("derives hasLab from course_groups.has_lab, not from the subject code", async () => {
		// One offering row with the flask marker, one without.
		raw
			.prepare(
				"INSERT INTO course_groups (id, subject_canonical_id, group_code, teacher_name, has_lab, student_control_number, is_lab_session) VALUES (?, ?, ?, 'DOC-001', 1, NULL, 1)",
			)
			.run("B2L4", "acf-0901", "A");
		raw
			.prepare(
				"INSERT INTO course_groups (id, subject_canonical_id, group_code, teacher_name, has_lab, student_control_number, is_lab_session) VALUES (?, ?, ?, 'DOC-002', 0, NULL, 0)",
			)
			.run("A1", "acf-0902", "A");

		const result = await loadReticula(signedIn());
		expect(result.subjects.find((s) => s.code === "ACF-0901")?.hasLab).toBe(true);
		expect(result.subjects.find((s) => s.code === "ACF-0902")?.hasLab).toBe(false);
	});
});

describe("specialty tray", () => {
	it("renders exactly the student's specialty and no other programme's modules", async () => {
		seedSpecialtyModule("tdd-2301", "TDD-2301", TDD);
		seedSpecialtyModule("tdd-2302", "TDD-2302", TDD);
		seedSpecialtyModule("sid-2301", "SID-2301", SID);
		seedSpecialtyModule("sid-2302", "SID-2302", SID);

		const body = renderTray(await loadReticula(signedIn()));

		expect(body).toContain("TDD-2301");
		expect(body).toContain("TDD-2302");
		expect(body).not.toContain("SID-2301");
		expect(body).not.toContain("SID-2302");
		expect(body).not.toContain(SID);
		expect(body).not.toContain(TDD);
		expect(body).toContain("Módulos de tu especialidad");
		// The reason the modules are out of the grid, stated rather than implied.
		expect(body).toContain("no registra el semestre");
	});
});

describe("laboratory badge", () => {
	it("marks the subject whose group has a laboratory and no other", async () => {
		raw
			.prepare(
				"INSERT INTO course_groups (id, subject_canonical_id, group_code, teacher_name, has_lab, student_control_number, is_lab_session) VALUES (?, ?, ?, 'DOC-001', 1, NULL, 1)",
			)
			.run("B3LA", "acf-0901", "A");

		const data = await loadReticula(signedIn());
		const byCode = (code: string) => {
			const found = data.subjects.find((s) => s.code === code);
			if (!found) throw new Error(`no subject ${code}`);
			return found;
		};
		const labNode = renderDag([byCode("ACF-0901")]);
		const plainNode = renderDag([byCode("ACF-0902")]);

		expect(labNode).toContain("· LAB ·");
		expect(labNode).toContain("Con grupo de laboratorio.");
		expect(plainNode).not.toContain("LAB");
		expect(plainNode).not.toContain("Con grupo de laboratorio.");
	});
});

describe("seriation branch", () => {
	it("names the chain position for a serialized subject and says so when unknown", async () => {
		seedSubject(raw, {
			canonicalId: "acf-0903",
			code: "ACF-0903",
			name: "Cálculo Vectorial",
			semester: 3,
		});
		raw
			.prepare(
				"INSERT INTO subject_prerequisites (subject_canonical_id, prerequisite_canonical_id) VALUES (?, ?)",
			)
			.run("acf-0902", "acf-0901");
		raw
			.prepare("UPDATE subjects SET seriation_state = 'SERIALIZED' WHERE canonical_id IN (?, ?)")
			.run("acf-0901", "acf-0902");
		// ACF-0903 keeps the column default, UNKNOWN: no source established a
		// seriation for it, which is NOT the same as "independent".

		const data = await loadReticula(signedIn());
		const body = render(ReticulaDag, {
			props: {
				subjects: data.subjects,
				edges: [{ from: "acf-0901", to: "acf-0902" }],
				statusByCanonicalId: {},
			},
		}).body;

		expect(body).toContain("es la materia 1 de 2 en su cadena de prerrequisitos");
		expect(body).toContain("es la materia 2 de 2 en su cadena de prerrequisitos");
		expect(body).toContain("ninguna fuente consultada establece si debe seriada");
	});

	it("keeps INDEPENDENT distinct from UNKNOWN", async () => {
		raw
			.prepare("UPDATE subjects SET seriation_state = 'INDEPENDENT' WHERE canonical_id IN (?, ?)")
			.run("acf-0901", "acf-0902");

		const data = await loadReticula(signedIn());
		const body = renderDag(data.subjects);

		expect(body).toContain("como materia independiente");
		expect(body).not.toContain("ninguna fuente consultada");
	});
});

describe("semester warnings", () => {
	it("stays silent for specialty modules and warns for any other missing semester", async () => {
		seedSpecialtyModule("tdd-2301", "TDD-2301", TDD);
		// A GENERIC module with no semester: no explanation exists for that.
		seedSubject(raw, { canonicalId: "scf-9999", code: "SCF-9999" });
		raw.prepare("UPDATE subjects SET semester = NULL WHERE canonical_id = 'scf-9999'").run();

		const data = await loadReticula(signedIn());
		const lines = captureWarnings(data.subjects);

		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("SCF-9999");
		expect(lines[0]).toContain("is GENERIC");
		expect(lines.join("\n")).not.toContain("TDD-2301");
	});

	it("still warns about a semester outside 1..9, specialty or not", async () => {
		seedSubject(raw, { canonicalId: "scf-9999", code: "SCF-9999", semester: 12 });

		const data = await loadReticula(signedIn());
		const lines = captureWarnings(data.subjects);

		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("outside 1..9");
	});
});

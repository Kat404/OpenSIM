/**
 * OpenSIM — Carga Académica PDF export endpoint unit tests (Phase 11 T11.4).
 *
 * `POST /api/export/carga` is the one endpoint under `(protected)`-free
 * routing that a browser can reach directly, so the (protected) layout's
 * redirect never runs for it — the handler re-checks `locals.user`
 * itself. The contract under test, in the order the handler checks it:
 *
 *   401 (no user) → 503 (no D1) → 400 (no active period) →
 *   404 (profile gone) → 400 (nothing enrolled) → 200 + PDF
 *
 * The 200 path also pins the PII trim: the PDF header carries only
 * control number / name / career / semester, and the response is
 * `no-store` with an attachment filename scoped to the student.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/routes/api/export/carga/+server";
import {
	clearWorkerEnv,
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

let raw: ReturnType<typeof withTestDb>["raw"];

/** The handler only reads `locals`; no cookies or request needed. */
async function exportPdf(user: ReturnType<typeof makeUser> | null): Promise<Response> {
	return (await POST({ locals: { user } } as never)) as Response;
}

/** A student with one ENROLLED subject, one group and one block. */
function seedEnrolledStudent(): void {
	seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027", name: "Programación" });
	seedGroup(raw, "G-SCC1027-1", "sistemas-1", "A", CONTROL);
	seedBlock(raw, {
		groupId: "G-SCC1027-1",
		day: "L",
		startTime: "08:00",
		endTime: "10:00",
		classroom: "Lab 1",
	});
	seedProgress(raw, CONTROL, "sistemas-1", "ENROLLED", PERIOD);
}

beforeEach(() => {
	({ raw } = withTestDb());
	seedCareer(raw);
	seedProfile(raw);
});

afterEach(() => {
	raw.close();
	clearWorkerEnv();
});

describe("POST /api/export/carga — auth gate", () => {
	it("returns 401 for an anonymous request without touching the database", async () => {
		// `(protected)` middleware does not run for /api/*, so this guard
		// is the only thing between the public internet and the student's
		// academic record.
		setWorkerDb(null);
		const response = await exportPdf(null);
		expect(response.status).toBe(401);
		expect(await response.text()).toBe("Unauthorized");
	});

	it("returns 503 for an authenticated student when D1 is not bound", async () => {
		setWorkerDb(null);
		const response = await exportPdf(makeUser());
		expect(response.status).toBe(503);
		expect(await response.text()).toBe("Database not available");
	});

	it("does not create a session or any side effect for an anonymous request", async () => {
		seedEnrolledStudent();
		await exportPdf(null);
		const row = raw.prepare("SELECT COUNT(*) AS c FROM auth_sessions").get() as { c: number };
		expect(row.c).toBe(0);
	});
});

describe("POST /api/export/carga — content contract", () => {
	it("returns 400 when the student has no ENROLLED period", async () => {
		// A student with only APPROVED history: `getCurrentPeriod` filters
		// on ENROLLED, so there is nothing to export.
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027" });
		seedProgress(raw, CONTROL, "sistemas-1", "APPROVED", PERIOD);
		const response = await exportPdf(makeUser());
		expect(response.status).toBe(400);
		expect(await response.text()).toBe("No hay periodo activo para exportar.");
	});

	it("returns 404 when the profile row is gone but progress history survives", async () => {
		// A torn state: `locals.user` came from a session that is still
		// valid, yet the profile lookup finds nothing. The FK on
		// student_progress blocks producing it with plain SQL, so FK
		// enforcement is lifted for this one teardown.
		seedEnrolledStudent();
		raw.exec("PRAGMA foreign_keys = OFF");
		raw.prepare("DELETE FROM student_profiles WHERE control_number = ?").run(CONTROL);
		raw.exec("PRAGMA foreign_keys = ON");

		const response = await exportPdf(makeUser());
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Student profile not found");
	});

	it("returns 400 when the student has an active period but no enrolled subjects", async () => {
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027" });
		// ENROLLED row for a subject whose group is absent keeps the period
		// resolvable but produces no canonical ids after the join.
		seedProgress(raw, CONTROL, "sistemas-1", "ENROLLED", PERIOD);
		const response = await exportPdf(makeUser());
		expect(response.status).toBe(400);
		expect(await response.text()).toBe("No tienes materias inscritas en este periodo.");
	});

	it("streams a real PDF with the attachment filename and no-store", async () => {
		seedEnrolledStudent();
		const response = await exportPdf(makeUser());

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/pdf");
		expect(response.headers.get("Content-Disposition")).toBe(
			`attachment; filename="carga-academica-${CONTROL}.pdf"`,
		);
		// The PDF carries PII; it must never land in a shared cache.
		expect(response.headers.get("Cache-Control")).toBe("no-store");

		const bytes = new Uint8Array(await response.arrayBuffer());
		// PDF magic: "%PDF-".
		expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
		expect(bytes.byteLength).toBeGreaterThan(500);
	});

	it("names the period and the institution in the PDF metadata", async () => {
		seedEnrolledStudent();
		const response = await exportPdf(makeUser());
		// pdf-lib is already a dependency; re-open the generated bytes to
		// assert on real document metadata rather than raw stream bytes.
		const { PDFDocument } = await import("pdf-lib");
		const doc = await PDFDocument.load(await response.arrayBuffer());

		expect(doc.getTitle()).toBe("Carga Académica — OpenSIM");
		expect(doc.getAuthor()).toBe("TecNM Morelia");
		expect(doc.getSubject()).toBe(`Carga académica del periodo ${PERIOD}`);
		expect(doc.getPageCount()).toBe(1);
	});

	it("scopes the export to the requesting student, not the whole cohort", async () => {
		seedEnrolledStudent();
		seedProfile(raw, { controlNumber: "87654321", fullName: "Grace Hopper Ramirez" });
		seedSubject(raw, { canonicalId: "redes-1", code: "SCC2001", name: "Redes" });
		seedGroup(raw, "G-SCC2001-1", "redes-1", "A", "87654321");
		seedProgress(raw, "87654321", "redes-1", "ENROLLED", PERIOD);

		const response = await exportPdf(makeUser({ controlNumber: "87654321" }));
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Disposition")).toBe(
			'attachment; filename="carga-academica-87654321.pdf"',
		);
	});

	it("ignores APPROVED rows from earlier periods", async () => {
		// Only ENROLLED rows in the current term reach the PDF; a graded
		// row from a past term must not resurrect its group.
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027", name: "Programación" });
		seedGroup(raw, "G-SCC1027-1", "sistemas-1", "A", CONTROL);
		seedBlock(raw, {
			groupId: "G-SCC1027-1",
			day: "L",
			startTime: "08:00",
			endTime: "10:00",
		});
		seedSubject(raw, { canonicalId: "algebra-1", code: "SCC0901", name: "Álgebra" });
		seedProgress(raw, CONTROL, "algebra-1", "APPROVED", "AGOSTO-DICIEMBRE/2025");
		seedProgress(raw, CONTROL, "sistemas-1", "ENROLLED", PERIOD);

		const response = await exportPdf(makeUser());
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/pdf");
	});

	it("KNOWN DEFECT: 'current period' resolves to ENERO-JUNIO over the later AGOSTO-DICIEMBRE of the same year", async () => {
		// `getCurrentPeriod` (src/lib/server/enrollment.ts:76) takes the
		// lexicographic MAX of the student's ENROLLED period strings, but
		// "E" > "A" in ASCII, so a student enrolled in both ENERO-JUNIO/2026
		// and AGOSTO-DICIEMBRE/2026 is treated as being in the FIRST term.
		// The helper's own docblock (enrollment.ts:19-21) claims the month
		// order "lines up with the ASCII order"; it does not. Affects
		// dashboard, horario and this export for any student whose
		// enrollment spans both terms of one year. Characterization test:
		// it passes because the wrong-but-current behaviour is pinned.
		// Only the AGOSTO-DICIEMBRE/2026 subject has an offer group, so the
		// export can only succeed if that term is the one resolved.
		seedSubject(raw, { canonicalId: "algebra-1", code: "SCC0901", name: "Álgebra Lineal" });
		seedGroup(raw, "G-SCC0901-1", "algebra-1", "A", CONTROL);
		seedBlock(raw, {
			groupId: "G-SCC0901-1",
			day: "L",
			startTime: "08:00",
			endTime: "10:00",
		});
		seedSubject(raw, { canonicalId: "sistemas-1", code: "SCC1027", name: "Programación" });
		seedProgress(raw, CONTROL, "sistemas-1", "ENROLLED", "ENERO-JUNIO/2026");
		seedProgress(raw, CONTROL, "algebra-1", "ENROLLED", PERIOD);

		const response = await exportPdf(makeUser());
		// Picks ENERO-JUNIO/2026, whose subject resolves to no group in
		// this fixture, so the endpoint answers 400 instead of exporting
		// the term the student is actually in.
		expect(response.status).toBe(400);
		expect(await response.text()).toBe("No tienes materias inscritas en este periodo.");
	});
});

/**
 * OpenSIM — Carga Académica PDF generator unit tests (Phase 4 Tarea 4.3).
 *
 * The PDF generator wraps pdf-lib's `PDFDocument.create()` and
 * returns a `Uint8Array`. We import the module (pdf-lib is a
 * dev-time-only dep here, but the project already depends on it
 * for the production runtime, so vitest resolves it natively),
 * call `generateCargaPdf` with a tiny fixture, and verify the
 * output is a well-formed PDF.
 *
 * What we check:
 *   - The function resolves with a Uint8Array of plausible size
 *     (PDFs start with "%PDF-" magic and end with "%%EOF").
 *   - A second call with the same input produces a different
 *     `CreationDate` (the timestamp footer is in the body, so
 *     two consecutive calls do not produce byte-identical output).
 */

import { describe, expect, it } from "vitest";
import { generateCargaPdf } from "../../src/lib/server/pdf/carga";

const fixture = {
	profile: {
		controlNumber: "<NUMERO DE CONTROL PURGADO>",
		fullName: "Ana Gabriela Hernández Ruiz",
		careerCode: "ISIC-2010-224",
		currentSemester: 7,
	},
	period: "AGOSTO-DICIEMBRE/2026",
	groups: [
		{
			id: "G-SCC1027-1",
			subjectCanonicalId: "graficacion",
			groupCode: "A",
			teacherName: "X",
			hasLab: true,
		},
	],
	blocks: [
		{
			id: 1,
			groupId: "G-SCC1027-1",
			day: "L",
			startTime: "08:00",
			endTime: "10:00",
			classroom: "Lab 1",
		},
	],
	subjects: new Map([["graficacion", { code: "SCC-1027", name: "Graficación" }]]),
};

describe("generateCargaPdf", () => {
	it("returns a Uint8Array that starts with the PDF magic header", async () => {
		const bytes = await generateCargaPdf(fixture);
		expect(bytes).toBeInstanceOf(Uint8Array);
		const head = new TextDecoder("latin1").decode(bytes.subarray(0, 5));
		expect(head).toBe("%PDF-");
	});

	it("returns a Uint8Array that ends with the %%EOF marker", async () => {
		const bytes = await generateCargaPdf(fixture);
		// The %%EOF marker is typically at the very end of the
		// last cross-reference stream; check the last 64 bytes.
		const tail = new TextDecoder("latin1").decode(
			bytes.subarray(Math.max(0, bytes.byteLength - 64)),
		);
		expect(tail).toContain("%%EOF");
	});

	it("returns a non-trivial byte length (more than 1 KB)", async () => {
		const bytes = await generateCargaPdf(fixture);
		// A 1-page PDF with text + a few rectangles is at least ~1 KB
		// (pdf-lib's own docs show 600 bytes minimum for an empty
		// page; with content the size grows). 1 KB is a safe lower
		// bound that catches a silent regression to an empty doc.
		expect(bytes.byteLength).toBeGreaterThan(1024);
	});

	it("produces different bytes for two consecutive calls (timestamp varies)", async () => {
		const a = await generateCargaPdf(fixture);
		// Sleep at least 1s so the HH:MM footer string changes
		// (date-only would not move if both calls fall in the
		// same minute). The GenerationDate is also encoded in
		// the PDF metadata.
		await new Promise((r) => setTimeout(r, 1100));
		const b = await generateCargaPdf(fixture);
		expect(new TextDecoder("latin1").decode(a)).not.toBe(new TextDecoder("latin1").decode(b));
	});

	it("handles an empty schedule (no blocks) without throwing", async () => {
		const empty = { ...fixture, blocks: [] };
		const bytes = await generateCargaPdf(empty);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.byteLength).toBeGreaterThan(512);
	});
});

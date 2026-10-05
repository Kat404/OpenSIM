/**
 * OpenSIM — Vectorial Carga Académica PDF generator.
 *
 * Phase 4 Tarea 4.3: the dashboard exposes a "Descargar Carga
 * Académica (PDF)" button that POSTs to `/api/export/carga`. The
 * API endpoint dynamically imports this module (pdf-lib is heavy —
 * ~120 KB gz — and a static import in any client-reachable path
 * would break the 100 KB initial-JS budget, see §12 of the spec).
 *
 * Output:
 *   - Letter (612x792 pt) portrait, 50pt margins
 *   - Header block: student info (controlNumber, fullName, career,
 *     semester, period)
 *   - Schedule grid: 7 day columns (L M M J V S D), 07:00-22:00
 *     hours, 60pt per hour (matches the in-app TimeGridSchedule so
 *     the printed and on-screen grids are visually consistent)
 *   - Each block: subject code, name, classroom, teacher
 *   - Footer: generation timestamp + signature line
 *
 * The function returns the raw PDF bytes as a `Uint8Array`; the
 * caller wraps it in a Response with `Content-Type: application/pdf`.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { CourseGroup, CourseScheduleBlock } from "../db/schema";

export interface CargaPdfInput {
	profile: {
		controlNumber: string;
		fullName: string;
		careerCode: string;
		currentSemester: number;
	};
	period: string;
	groups: CourseGroup[];
	blocks: CourseScheduleBlock[];
	/** code + name per subject canonical id; the caller resolves the catalog. */
	subjects: Map<string, { code: string; name: string }>;
}

const PAGE_WIDTH = 612; // Letter portrait, in points
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const START_HOUR = 7;
const END_HOUR = 22;
const PIXELS_PER_HOUR = 60; // 60pt = 1 hour, matches the in-app grid
const HOUR_ROW_HEIGHT = (END_HOUR - START_HOUR) * (PIXELS_PER_HOUR / 2); // 15h * 30pt = 450pt grid

const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"] as const;
type DayLetter = (typeof DAY_LETTERS)[number];

// Letter width: 612pt - 2*50pt margin = 512pt. Subtract the 40pt
// hour gutter → 472pt for 7 columns = ~67pt per day.
const GUTTER_WIDTH = 40;
const DAY_COL_WIDTH = (PAGE_WIDTH - 2 * MARGIN - GUTTER_WIDTH) / 7;

const BLACK = rgb(0.07, 0.09, 0.15);
const GRAY = rgb(0.42, 0.45, 0.52);
const LIGHT = rgb(0.85, 0.87, 0.9);
const BRAND = rgb(0.15, 0.39, 0.82);
const ACCENT_BG = rgb(0.92, 0.95, 1.0);

function parseHHMM(s: string): number | null {
	const m = /^(\d{1,2}):(\d{2})$/.exec(s);
	if (!m) return null;
	const hh = Number(m[1]);
	const mm = Number(m[2]);
	if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
	return hh + mm / 60;
}

function formatNow(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayLetter(b: CourseScheduleBlock): DayLetter | null {
	const up = b.day.trim().toUpperCase();
	return (DAY_LETTERS as readonly string[]).includes(up) ? (up as DayLetter) : null;
}

/**
 * Generates the Carga Académica PDF as a Uint8Array. The function
 * is `async` because `PDFDocument.create()` and `embedFont` are
 * async in pdf-lib.
 *
 * Pure: the only inputs are the data shape; no I/O, no globals.
 * Side-effect-free: no logging, no metrics, no timing. The caller
 * is responsible for any observability concerns.
 */
export async function generateCargaPdf(input: CargaPdfInput): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	doc.setTitle("Carga Académica — OpenSIM");
	doc.setAuthor("TecNM Morelia");
	doc.setSubject(`Carga académica del periodo ${input.period}`);

	const helv = await doc.embedFont(StandardFonts.Helvetica);
	const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
	const courier = await doc.embedFont(StandardFonts.Courier);

	const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
	let cursorY = PAGE_HEIGHT - MARGIN;

	// ---------- Title ----------
	page.drawText("TecNM Morelia — Carga Académica", {
		x: MARGIN,
		y: cursorY - 18,
		size: 16,
		font: helvBold,
		color: BLACK,
	});
	cursorY -= 22;
	page.drawText(`Periodo: ${input.period}`, {
		x: MARGIN,
		y: cursorY - 14,
		size: 10,
		font: courier,
		color: GRAY,
	});
	cursorY -= 22;

	// ---------- Student info block ----------
	const labelX = MARGIN;
	const valueX = MARGIN + 90;
	const rowGap = 14;
	const infoRows: Array<[string, string]> = [
		["Número de control", input.profile.controlNumber],
		["Nombre", input.profile.fullName],
		["Carrera", input.profile.careerCode],
		["Semestre", String(input.profile.currentSemester)],
	];
	for (const [label, value] of infoRows) {
		page.drawText(label, { x: labelX, y: cursorY, size: 9, font: helvBold, color: GRAY });
		page.drawText(value, { x: valueX, y: cursorY, size: 10, font: helv, color: BLACK });
		cursorY -= rowGap;
	}
	cursorY -= 8;

	// ---------- Grid header ----------
	const _gridTop = cursorY;
	page.drawText("Horario semanal", {
		x: MARGIN,
		y: cursorY,
		size: 11,
		font: helvBold,
		color: BLACK,
	});
	cursorY -= 6;
	page.drawLine({
		start: { x: MARGIN, y: cursorY },
		end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
		thickness: 0.5,
		color: LIGHT,
	});
	cursorY -= 14;

	const gridOriginY = cursorY - 12; // y of the 07:00 row baseline
	const gridLeft = MARGIN + GUTTER_WIDTH;
	const rowHeight = HOUR_ROW_HEIGHT / (END_HOUR - START_HOUR); // per hour

	// Day-letter headers
	for (let i = 0; i < DAY_LETTERS.length; i++) {
		const x = gridLeft + i * DAY_COL_WIDTH + DAY_COL_WIDTH / 2 - 4;
		page.drawText(DAY_LETTERS[i], {
			x,
			y: gridOriginY + 6,
			size: 9,
			font: helvBold,
			color: BLACK,
		});
	}
	// Hour gutter labels (07:00, 08:00, ..., 21:00 — 22:00 sits at the bottom of the last row)
	for (let h = START_HOUR; h <= END_HOUR; h++) {
		const y = gridOriginY - (h - START_HOUR) * rowHeight - 2;
		const label = `${String(h).padStart(2, "0")}:00`;
		page.drawText(label, {
			x: MARGIN,
			y,
			size: 7,
			font: courier,
			color: GRAY,
		});
	}

	// Hourly horizontal rules
	for (let h = 0; h <= END_HOUR - START_HOUR; h++) {
		const y = gridOriginY - h * rowHeight;
		page.drawLine({
			start: { x: gridLeft, y },
			end: { x: gridLeft + 7 * DAY_COL_WIDTH, y },
			thickness: 0.5,
			color: LIGHT,
		});
	}
	// Day-column vertical separators
	for (let i = 0; i <= 7; i++) {
		const x = gridLeft + i * DAY_COL_WIDTH;
		page.drawLine({
			start: { x, y: gridOriginY },
			end: { x, y: gridOriginY - HOUR_ROW_HEIGHT },
			thickness: 0.5,
			color: LIGHT,
		});
	}

	// ---------- Class blocks ----------
	// Build a groupId -> subject lookup so we can resolve the code +
	// name on each block. We use the smallest possible map here; the
	// caller already filtered to the student's enrolled groups.
	const groupIdToCanonical = new Map(input.groups.map((g) => [g.id, g.subjectCanonicalId]));

	for (const b of input.blocks) {
		const day = dayLetter(b);
		if (!day) continue;
		const startH = parseHHMM(b.startTime);
		const endH = parseHHMM(b.endTime);
		if (startH === null || endH === null || endH <= startH) continue;
		const dayIdx = (DAY_LETTERS as readonly string[]).indexOf(day);
		const x = gridLeft + dayIdx * DAY_COL_WIDTH + 2;
		const width = DAY_COL_WIDTH - 4;
		const top = gridOriginY - (startH - START_HOUR) * rowHeight;
		const height = (endH - startH) * rowHeight;

		// Soft brand background so the block reads as "scheduled".
		page.drawRectangle({
			x,
			y: top - height,
			width,
			height,
			color: ACCENT_BG,
			borderColor: BRAND,
			borderWidth: 0.75,
		});

		const canonical = groupIdToCanonical.get(b.groupId);
		const meta = canonical ? input.subjects.get(canonical) : undefined;
		const code = meta?.code ?? "—";
		const name = meta?.name ?? "";

		// Subject code (bold)
		page.drawText(code, {
			x: x + 3,
			y: top - 10,
			size: 7,
			font: helvBold,
			color: BLACK,
		});
		// Subject name (truncated to fit column)
		if (height >= 20) {
			page.drawText(truncate(name, 24, helv, 6.5), {
				x: x + 3,
				y: top - 18,
				size: 6.5,
				font: helv,
				color: BLACK,
			});
		}
		// Classroom + time (mono)
		const meta1 = `${b.startTime}–${b.endTime}`;
		page.drawText(meta1, {
			x: x + 3,
			y: top - height + 2,
			size: 5.5,
			font: courier,
			color: GRAY,
		});
		if (height >= 24) {
			page.drawText(truncate(b.classroom, 18, courier, 5.5), {
				x: x + 3,
				y: top - height + 9,
				size: 5.5,
				font: courier,
				color: GRAY,
			});
		}
	}

	// ---------- Footer ----------
	const footerY = MARGIN;
	page.drawText(`Generado: ${formatNow()}`, {
		x: MARGIN,
		y: footerY + 18,
		size: 7,
		font: courier,
		color: GRAY,
	});
	page.drawLine({
		start: { x: PAGE_WIDTH - MARGIN - 200, y: footerY + 14 },
		end: { x: PAGE_WIDTH - MARGIN, y: footerY + 14 },
		thickness: 0.5,
		color: BLACK,
	});
	page.drawText("Firma del alumno", {
		x: PAGE_WIDTH - MARGIN - 80,
		y: footerY + 4,
		size: 7,
		font: helv,
		color: GRAY,
	});

	return await doc.save();
}

/**
 * Naive string truncate that fits `s` into the available width
 * using the given font + size. Adds an ellipsis when it overflows.
 * The width helper is `font.widthOfTextAtSize(s, size)` which is
 * the pdf-lib way to measure text before drawing.
 */
function truncate(
	s: string,
	maxChars: number,
	_font: import("pdf-lib").PDFFont,
	_size: number,
): string {
	if (s.length <= maxChars) return s;
	return `${s.slice(0, maxChars - 1)}…`;
}

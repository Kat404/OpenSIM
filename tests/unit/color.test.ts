/**
 * OpenSIM — HSL color hash unit tests (theme-aware).
 *
 * The function is pure and deterministic; contracts under test are
 * stability across calls, distribution of hues, the literal shape of
 * the output string in both themes, and the WCAG-AA contrast invariant
 * over all 360 hues (Phase 8 T8.1) at lightness 88% light / 20% dark.
 */

import { describe, expect, it } from "vitest";
import {
	contrastRatio,
	getSubjectColor,
	hashHue,
	hslToHex,
	SUBJECT_LIGHTNESS,
	SUBJECT_SATURATION,
} from "../../src/lib/utils/color";

describe("hashHue", () => {
	it("returns the same hue for the same input across calls (determinism)", () => {
		const a = hashHue("ACF-0901");
		const b = hashHue("ACF-0901");
		const c = hashHue("ACF-0901");
		expect(a).toBe(b);
		expect(b).toBe(c);
	});

	it("keeps the hue in the [0, 360) range for arbitrary inputs", () => {
		const samples = [
			"ACF-0901",
			"SCD-1020",
			"AEF-1040",
			"BDP-1203",
			"ACA-0907",
			"SHF-1016",
			"SCG-1009",
			"PFC-1018",
		];
		for (const code of samples) {
			const hue = hashHue(code);
			expect(hue).toBeGreaterThanOrEqual(0);
			expect(hue).toBeLessThan(360);
		}
	});

	it("handles the empty string without throwing", () => {
		const hue = hashHue("");
		expect(Number.isFinite(hue)).toBe(true);
		expect(hue).toBeGreaterThanOrEqual(0);
		expect(hue).toBeLessThan(360);
	});
});

describe("getSubjectColor — light theme", () => {
	it("returns the same output for the same input across calls (determinism)", () => {
		const a = getSubjectColor("ACF-0901", "light");
		const b = getSubjectColor("ACF-0901", "light");
		const c = getSubjectColor("ACF-0901", "light");
		expect(a).toBe(b);
		expect(b).toBe(c);
	});

	it("matches the canonical hsl(H, 60%, 88%) output shape", () => {
		const out = getSubjectColor("SCC-1019", "light");
		expect(out).toMatch(/^hsl\(\d{1,3}, 60%, 88%\)$/);
	});

	it("selects lightness 88% for the WCAG-AA pastels on light surfaces", () => {
		// Dark fg-primary (#0b0f17) on the saturated pastel must stay
		// above 4.5:1; 88% L is the tuned value, do not regress it.
		expect(getSubjectColor("ACF-0901", "light")).toMatch(/88%/);
	});

	it("produces different outputs for distinct inputs (high probability)", () => {
		const a = getSubjectColor("ACF-0901", "light");
		const b = getSubjectColor("SCD-1020", "light");
		const c = getSubjectColor("BDP-1203", "light");
		expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(2);
	});
});

describe("getSubjectColor — dark theme", () => {
	it("matches the inverted hsl(H, 60%, 20%) output shape", () => {
		const out = getSubjectColor("SCC-1019", "dark");
		expect(out).toMatch(/^hsl\(\d{1,3}, 60%, 20%\)$/);
	});

	it("selects lightness 20% for the WCAG-AA dark inversions", () => {
		// Phase 8 T8.2: 28% only cleared AA against fg-primary (min
		// 4.77:1) and failed against fg-secondary (min 3.42:1 @ hue 60),
		// which paints the time/classroom line in every block. 20% is
		// the AA-safe value for both; the sweep at the bottom of this
		// file is what actually guards it, not this literal.
		expect(getSubjectColor("ACF-0901", "dark")).toMatch(/20%/);
	});

	it("keeps the same hue across themes (only lightness differs)", () => {
		const light = getSubjectColor("SCD-1020", "light");
		const dark = getSubjectColor("SCD-1020", "dark");
		const lightHue = Number(light.match(/^hsl\((\d+),/)?.[1]);
		const darkHue = Number(dark.match(/^hsl\((\d+),/)?.[1]);
		expect(lightHue).toBe(darkHue);
	});

	it("keeps the hue in the [0, 360) range for arbitrary inputs in dark", () => {
		const samples = ["ACF-0901", "SCD-1020", "AEF-1040", "BDP-1203"];
		for (const code of samples) {
			const out = getSubjectColor(code, "dark");
			const match = out.match(/^hsl\((\d{1,3}), 60%, 20%\)$/);
			expect(match).not.toBeNull();
			const hue = Number(match?.[1]);
			expect(hue).toBeGreaterThanOrEqual(0);
			expect(hue).toBeLessThan(360);
		}
	});

	it("handles the empty string without throwing", () => {
		expect(getSubjectColor("", "dark")).toMatch(/^hsl\(\d{1,3}, 60%, 20%\)$/);
	});
});

/**
 * Phase 8 — the invariant the header block of `color.ts` used to assert
 * and did not deliver. At a fixed saturation, relative luminance is NOT
 * constant across hue (the yellow-green band is far lighter than the
 * blue band), so "one lightness clears 4.5:1 for every hue" is only true
 * for a lightness chosen by measurement over the whole domain — which is
 * what this sweep is: all 360 hues, every foreground token that is
 * actually painted on top of a subject block.
 *
 * The tokens below are read from `src/lib/styles/tokens.css`; if a
 * foreground token changes there, this file must change with it.
 */
const FOREGROUNDS = {
	light: { primary: "#0b0f17", secondary: "#3d4654" },
	dark: { primary: "#f7f8fa", secondary: "#cbd5e1" },
} as const;

/** Sweeps every hue and returns the worst ratio together with the hue that produced it. */
function worstHue(lightness: number, fgHex: string) {
	let worst = { hue: 0, ratio: Number.POSITIVE_INFINITY };
	for (let hue = 0; hue < 360; hue++) {
		const bg = hslToHex(hue, SUBJECT_SATURATION, lightness);
		const ratio = contrastRatio(fgHex, bg);
		if (ratio < worst.ratio) worst = { hue, ratio };
	}
	return worst;
}

describe.each(["light", "dark"] as const)("subject block contrast — %s theme", (theme) => {
	const lightness = SUBJECT_LIGHTNESS[theme];

	it.each(Object.entries(FOREGROUNDS[theme]))(
		"clears WCAG 2.1 AA (4.5:1) against --fg-%s at every hue",
		(_label, fgHex) => {
			const worst = worstHue(lightness, fgHex);
			expect(
				worst.ratio,
				`lightness ${lightness}% at ${SUBJECT_SATURATION}% saturation drops below AA against ` +
					`${fgHex} at hue ${worst.hue} (background ${hslToHex(worst.hue, SUBJECT_SATURATION, lightness)})`,
			).toBeGreaterThanOrEqual(4.5);
		},
	);
});

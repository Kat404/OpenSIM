/**
 * OpenSIM — Deterministic HSL color hash (theme-aware).
 *
 * Maps a subject code (e.g. "ACF-0901", "SCD-1020") to a stable
 * `hsl(h, 60%, L%)` color string. The same input always produces the
 * same hue; the lightness is selected by the active theme so the
 * retícula and the weekly schedule stay legible on both backgrounds:
 *
 *   - `light` theme → L=88%  (pastel, dark `var(--fg-primary)` on top)
 *   - `dark`  theme → L=20%  (deep, light `var(--fg-primary)` on top)
 *
 * A single lightness cannot be "obviously safe" at a fixed saturation:
 * relative luminance is not constant across hue, so the yellow-green band
 * is much lighter than the blue band at the same L. The old 88/28 pair
 * claimed 4.5:1 for every hue and was only measured against
 * `fg-primary`; against `fg-secondary` (which paints the time/classroom
 * line inside every block) dark L=28% bottoms out at **3.42:1** at hue
 * 60. Measured worst case over all 360 hues at S=60%, against both
 * foreground tokens that sit on a block:
 *
 *   | theme | L   | vs --fg-primary | vs --fg-secondary |
 *   | ----- | --- | --------------- | ----------------- |
 *   | light | 88% | 12.56:1 @h0     | 6.24:1 @h0        |
 *   | dark  | 20% | 7.67:1 @h60     | 5.49:1 @h60       |
 *
 * So 88/20 does clear AA (4.5:1) everywhere, with ~22% headroom on the
 * tightest pair — headroom on purpose, so a later tweak to a foreground
 * token or to the saturation cannot silently drop back under AA. Any
 * change to these numbers must keep `tests/unit/color.test.ts` green:
 * that test sweeps all 360 hues for both themes and both foregrounds.
 *
 * NOT guaranteed: `--fg-tertiary` (mid-grey) painted on a generated
 * background bottoms out at 3.17:1 in light and 3.18:1 in dark, and no
 * lightness fixes that — a mid-grey only clears AA against a near-white
 * or near-black background, never against S=60% at any L. The places it
 * is currently safe (hour labels, list headers, the swatch-less rows in
 * `TodayClasses.svelte`) sit on `--surface-1`, not on this color.
 * `SubjectNode.svelte:118` is the exception: it fills `.node__meta` with
 * `--fg-tertiary` on top of this exact background, on `/reticula`. It is
 * not reported by the axe specs today, and it is not fixable from this
 * file — it needs the token or the component, not the lightness.
 *
 * The hue is derived from a FNV-1a-style 32-bit hash on the UTF-16 char
 * codes of the input, then mapped into [0, 360) via `Math.abs(hash)
 * % 360`.
 *
 * See: odd/tasks/opensim.md §7.2; audit H1 (Round 4); Phase 8 T8.2.
 */

const HUE_MAX = 360;
const FNV_OFFSET_BASIS = 2166136261;

export type Theme = "light" | "dark";

/** Saturation of every generated subject color, in percent. */
export const SUBJECT_SATURATION = 60;

/**
 * Lightness per theme, in percent. Dark is the *largest* value that keeps
 * all 360 hues above AA against the light foreground tokens (24% fails at
 * hue 60, so there is no room to go lighter); light is well clear of AA
 * already and stays pastel. The header block above carries the measured
 * worst case and `tests/unit/color.test.ts` is the proof that it holds.
 */
export const SUBJECT_LIGHTNESS: Record<Theme, number> = {
	light: 88,
	dark: 20,
};

/**
 * FNV-1a-style 32-bit hash of `subjectCode`, mapped into [0, 360).
 * Pure and deterministic; same input always returns the same hue.
 */
export function hashHue(subjectCode: string): number {
	let hash = FNV_OFFSET_BASIS;
	for (let i = 0; i < subjectCode.length; i++) {
		hash ^= subjectCode.charCodeAt(i);
		hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
	}
	return Math.abs(hash) % HUE_MAX;
}

/**
 * Returns the hsl(H, 60%, L%) string for the given subject code, with
 * lightness selected by `theme`. Callers that need to render the same
 * subject in both themes at once (e.g. a CSS variable holding both
 * variants) should use `getSubjectColorTokens` instead.
 */
export function getSubjectColor(subjectCode: string, theme: Theme): string {
	const hue = hashHue(subjectCode);
	return `hsl(${hue}, ${SUBJECT_SATURATION}%, ${SUBJECT_LIGHTNESS[theme]}%)`;
}

/**
 * Resolves an `hsl(H, S%, L%)` triple to the `#rrggbb` string a browser
 * would actually paint. Needed because the contrast math below has to
 * compare the *rendered* color, not the CSS notation: WCAG luminance is
 * defined on gamma-encoded sRGB channels, so the HSL → RGB step cannot
 * be skipped or approximated.
 */
export function hslToHex(hue: number, saturation: number, lightness: number): string {
	const s = saturation / 100;
	const l = lightness / 100;
	const chroma = (1 - Math.abs(2 * l - 1)) * s;
	const sector = (((hue % 360) + 360) % 360) / 60;
	const mid = chroma * (1 - Math.abs((sector % 2) - 1));
	const [r, g, b] = [
		[l - chroma / 2, l - chroma / 2 + mid, l + chroma / 2],
		[l + chroma / 2, l - chroma / 2 + mid, l - chroma / 2],
		[l - chroma / 2 + mid, l + chroma / 2, l - chroma / 2],
		[l - chroma / 2 + mid, l - chroma / 2, l + chroma / 2],
		[l + chroma / 2, l - chroma / 2, l - chroma / 2 + mid],
		[l + chroma / 2, l - chroma / 2 + mid, l - chroma / 2],
	][Math.floor(sector) % 6];
	const hex = (channel: number) =>
		Math.round(Math.min(1, Math.max(0, channel)) * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * WCAG 2.1 relative contrast ratio between two `#rrggbb` colors:
 * `(L_lighter + 0.05) / (L_darker + 0.05)`, where each `L` is the
 * relative luminance — the sRGB channels linearized with the piecewise
 * `c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4` curve, weighted
 * 0.2126 R / 0.7152 G / 0.0722 B. Range is 1:1 (identical) to 21:1
 * (black on white); AA for body text is 4.5:1.
 */
export function contrastRatio(fgHex: string, bgHex: string): number {
	const luminance = (hex: string) => {
		const channels = [1, 3, 5].map((offset) => {
			const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
			return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
	};
	const a = luminance(fgHex);
	const b = luminance(bgHex);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

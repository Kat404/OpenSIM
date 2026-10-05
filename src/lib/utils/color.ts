/**
 * OpenSIM — Deterministic HSL color hash (theme-aware).
 *
 * Maps a subject code (e.g. "ACF-0901", "SCD-1020") to a stable
 * `hsl(h, 60%, L%)` color string. The same input always produces the
 * same hue; the lightness is selected by the active theme so the
 * retícula and the weekly schedule stay legible on both backgrounds:
 *
 *   - `light` theme → L=88%  (pastel, dark `var(--fg-primary)` on top)
 *   - `dark`  theme → L=28%  (saturated, light `var(--fg-primary)` on top)
 *
 * Lightness 88/28 keeps the contrast against the theme's `fg-primary`
 * token at or above WCAG 2.1 AA (4.5:1) for every hue in [0, 360). The
 * hue is derived from a FNV-1a-style 32-bit hash on the UTF-16 char
 * codes of the input, then mapped into [0, 360) via `Math.abs(hash)
 * % 360`.
 *
 * See: odd/tasks/opensim.md §7.2; audit H1 (Round 4).
 */

const HUE_MAX = 360;
const FNV_OFFSET_BASIS = 2166136261;
const LIGHT_LIGHTNESS = 88;
const DARK_LIGHTNESS = 28;

export type Theme = "light" | "dark";

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
	const lightness = theme === "dark" ? DARK_LIGHTNESS : LIGHT_LIGHTNESS;
	return `hsl(${hue}, 60%, ${lightness}%)`;
}

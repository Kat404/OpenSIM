/**
 * OpenSIM — Deterministic HSL color hash.
 *
 * Maps a subject code (e.g. "ACF-0901", "SCD-1020") to a stable
 * `hsl(h, 60%, 88%)` color string. The same input always produces the
 * same output, so the retícula view (Phase 3 Tarea 3.4) can color each
 * subject block once at module load without persisting the choice to
 * the database.
 *
 * Algorithm: FNV-1a-style 32-bit hash on the UTF-16 char codes of the
 * input. The hash is mapped to a hue in the [0, 360) range via
 * `Math.abs(hash) % 360`. Saturation/lightness are fixed (60% / 88%) for
 * a pastel palette that passes WCAG 2.1 AA contrast against the
 * --surface-0 background used by tokens.css.
 *
 * See: odd/tasks/opensim.md §7.2
 */

const HUE_MAX = 360;
const FNV_OFFSET_BASIS = 2166136261;

/**
 * Returns an `hsl(<hue>, 60%, 88%)` CSS color string for the given subject
 * code. The same input always returns the same output.
 *
 * @param subjectCode - Subject identifier (canonical id or legacy code).
 * @returns An HSL color string matching the regex
 *   `^hsl\(\d{1,3}, 60%, 88%\)$`.
 */
export function getSubjectColorHSL(subjectCode: string): string {
	let hash = FNV_OFFSET_BASIS;
	for (let i = 0; i < subjectCode.length; i++) {
		hash ^= subjectCode.charCodeAt(i);
		hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
	}
	const hue = Math.abs(hash) % HUE_MAX;
	return `hsl(${hue}, 60%, 88%)`;
}

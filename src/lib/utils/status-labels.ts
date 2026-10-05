/**
 * OpenSIM — Student-progress status labels and colours.
 *
 * Single source of truth for the four student-progress statuses
 * (`APPROVED` / `ENROLLED` / `AVAILABLE` / `LOCKED`) used by the
 * retícula, the kardex, and any future academic surface. The audit
 * (L3, Round 4) caught the map being triplicated across
 * `SubjectNode.svelte`, `reticula/+page.svelte`, and
 * `KardexTable.svelte`; this module is the only place to add or
 * rename a status from now on.
 *
 * `STATUS_COLOR_VAR` mirrors the CSS custom properties on
 * `tokens.css` so the retícula legend swatches can be rendered
 * with `var(...)` lookups instead of hard-coded hex.
 *
 * The audit (L3, Round 6) additionally required that evaluation-type
 * labels (Ordinario / Repetición / Especial) live next to
 * `STATUS_LABEL` so the kardex's cell renderer and filter pills can
 * never drift apart.
 */

import type { EvaluationType, StudentProgressStatus } from "#lib/server/db/schema";

export const STATUS_LABEL: Record<StudentProgressStatus, string> = {
	APPROVED: "Aprobada",
	ENROLLED: "Cursando",
	AVAILABLE: "Disponible",
	LOCKED: "Bloqueada",
};

/**
 * CSS custom property names for the surface + border colours of
 * each status. Values match the `--success-50/500`, `--brand-50/500`,
 * `--surface-3/--border-default`, and `--danger-50/500` tokens.
 */
export const STATUS_COLOR_VAR: Record<StudentProgressStatus, { surface: string; border: string }> =
	{
		APPROVED: { surface: "--success-50", border: "--success-500" },
		ENROLLED: { surface: "--brand-50", border: "--brand-500" },
		AVAILABLE: { surface: "--surface-3", border: "--border-default" },
		LOCKED: { surface: "--danger-50", border: "--danger-500" },
	};

/**
 * Single source of truth for the three evaluation types. Used by
 * `KardexTable.svelte` both for the cell renderer and the filter
 * pill labels so the two never drift (audit L3, Round 6).
 */
export const EVALUATION_LABEL: Record<EvaluationType, string> = {
	ORDINARIO: "Ordinario",
	REPETICION: "Repetición",
	ESPECIAL: "Especial",
};

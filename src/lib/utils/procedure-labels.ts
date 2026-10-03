/**
 * OpenSIM — Procedure unlock-state labels.
 *
 * Single source of truth for the two procedure unlock states
 * (Disponible / Bloqueado) used by `ProcedureStepper` and the four
 * `TramiteForm*` components. The audit (N8, Round 6) caught the
 * pairs being hard-coded in each form, with copy that could drift
 * out of sync; this module is the only place to rename either.
 *
 * Procedure-state is intentionally separate from `STATUS_LABEL`
 * (student-progress status) — they model different concepts and
 * share no overlap, so a single enum would conflate them.
 */

export const PROCEDURE_STATE_LABEL = {
	AVAILABLE: 'Disponible',
	LOCKED: 'Bloqueado'
} as const;

export type ProcedureState = keyof typeof PROCEDURE_STATE_LABEL;

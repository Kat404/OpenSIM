/**
 * OpenSIM — Academic constants and helpers.
 *
 * Single source of truth for the TecNM grading scale used by the
 * kardex, the retícula, and any future academic surface that needs
 * to label a grade. Centralising the threshold lets the badge
 * colours, the passing predicate, and the unit tests share the same
 * number — there is no \`70\` or \`>= 6\` literal in component code
 * (audit H3, Round 4).
 *
 * Scale: 0..10, minimum 6.0 to pass (TecNM ISIC-2010-224 academic
 * regulations; Instituto Tecnológico de Morelia, Departamento
 * Académico de Sistemas Computacionales).
 */

/** Minimum grade that counts as a pass on the TecNM 0-10 scale. */
export const MIN_PASSING_GRADE = 6.0;

/** Maximum grade achievable on the TecNM 0-10 scale. */
export const MAX_GRADE = 10.0;

/** Minimum grade achievable (failing floor) on the TecNM 0-10 scale. */
export const MIN_GRADE = 0.0;

/**
 * Returns true when `grade` meets or exceeds the TecNM passing
 * threshold. `null` grades (course in progress, no recorded
 * mark) are NOT considered passing — callers that need to treat
 * \"in progress\" as a separate case should branch on the status
 * enum first.
 */
export function isPassing(grade: number | null): boolean {
	return grade !== null && grade >= MIN_PASSING_GRADE;
}

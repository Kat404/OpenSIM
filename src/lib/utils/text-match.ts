/**
 * OpenSIM — accent-insensitive text matching.
 *
 * A TecNM Morelia student types "algebra" and the catalogue holds
 * "Álgebra Lineal". `toLowerCase()` alone does not bridge that: the accented
 * and unaccented forms are different code points. It matters here because
 * every subject name, group and route in this app is Spanish, and Spanish
 * text is almost entirely accented — so the unaccented guess is the normal
 * input, not the edge case.
 *
 * `NFD` splits each character into its base letter plus a combining mark, the
 * marks are dropped, and the string is folded back to lower case. "Álgebra"
 * and "algebra" both become "algebra"; "ñ" is handled because NFD decomposes it
 * into "n" + combining tilde, so "Cañón" and "canon" match too.
 */

/**
 * Folds a string for comparison: decomposed, marks removed, lower-cased.
 * Call this on both sides of a comparison, never on stored data.
 */
export function foldText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

/**
 * True when `haystack` contains `needle`, ignoring case and accents in both.
 * An empty or whitespace-only needle matches everything, so a cleared input
 * never hides the list.
 */
export function matchesText(haystack: string, needle: string): boolean {
	const query = foldText(needle.trim());
	if (query === "") return true;
	return foldText(haystack).includes(query);
}

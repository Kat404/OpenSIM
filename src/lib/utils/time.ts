/**
 * OpenSIM — Timezone-aware "today" helpers.
 *
 * Cloudflare Workers run in UTC; the Instituto Tecnológico de
 * Morelia is in UTC-6. Between 18:00 and 24:00 local time, the UTC
 * day-of-week is already the next day, so a naive
 * `new Date().getDay()` returns the wrong weekday for the student.
 * The audit (H4, Round 4) caught the bug: the dashboard's "clases
 * de hoy" widget showed Saturday's classes on a Friday evening.
 *
 * These helpers use `Intl.DateTimeFormat` with a configurable
 * `timeZone` so the value is computed in the student's locale. The
 * `now` parameter is injectable so the same code can be unit-tested
 * against fixed instants.
 *
 * Default timezone is `America/Mexico_City` (Morelia). The default
 * is used in production paths; tests pass a UTC instant and the
 * same default to assert the conversion.
 */

export type DayLetter = 'D' | 'L' | 'M' | 'X' | 'J' | 'V' | 'S';

const WEEKDAY_TO_LETTER: Record<string, DayLetter> = {
	Sun: 'D',
	Mon: 'L',
	Tue: 'M',
	Wed: 'X',
	Thu: 'J',
	Fri: 'V',
	Sat: 'S'
};

const DEFAULT_TIMEZONE = 'America/Mexico_City';

/**
 * Returns the Spanish single-letter day abbreviation for the given
 * instant in the given timezone. Defaults to America/Mexico_City.
 * Uses `Intl.DateTimeFormat` with `weekday: 'short'` (locale pinned
 * to `en-US` so the short names are the canonical three-letter
 * English ones) and maps to the TecNM schedule grid letters.
 */
export function getTodayDayLetter(
	now: Date = new Date(),
	timeZone: string = DEFAULT_TIMEZONE
): DayLetter {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		weekday: 'short'
	});
	const weekday = formatter.format(now);
	return WEEKDAY_TO_LETTER[weekday] ?? 'D';
}

/**
 * Returns the calendar date in `YYYY-MM-DD` form for the given
 * instant in the given timezone. The `en-CA` locale is the stable,
 * locale-independent way to get ISO-shaped dates from
 * `Intl.DateTimeFormat` without the `sv-SE` or hand-rolled formatter
 * fallbacks other projects reach for.
 */
export function getTodayDate(
	now: Date = new Date(),
	timeZone: string = DEFAULT_TIMEZONE
): string {
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	return formatter.format(now);
}

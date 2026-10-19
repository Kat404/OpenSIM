/**
 * OpenSIM — the term /reinscripcion offers, judged by an agent.
 *
 * T10.1. The enrolment period used to be the student's most recent progress
 * row, ordered by `desc(period)` on the term NAME as text, so
 * "ENERO-JUNIO/2099" outranked "AGOSTO-DICIEMBRE/2026" and the page offered a
 * term that had not opened. Nothing on the screen was wrong-looking: it was
 * the wrong term, and only the data says so.
 *
 * WHY AN AGENT AND NOT A LOCATOR: a locator can check that *a* period is
 * rendered; it cannot know which period should be there. The test computes the
 * expected term with the same pure function the server uses and asks the agent
 * whether the screen agrees — the expensive part buying a claim about data.
 *
 * WHAT IT USED NOT TO PROVE, measured rather than assumed: this test was run
 * against the PRE-FIX code and it PASSED. The `alumno` session was `99999999`,
 * who has zero `student_progress` rows, so `getLatestProgressPeriod` returned
 * null and the chain fell through to `currentAcademicPeriod()` — the very value
 * the test compares against. The ordering bug is only reachable for a student
 * who HAS rows.
 *
 * Since 2026-10-19 the session student is `12345678`, who has 49 rows and a
 * newest one in `ENERO-JUNIO/2027` — the exact shape that made
 * "ENERO-JUNIO/2027" outrank "AGOSTO-DICIEMBRE/2026". So the test now
 * reaches the bug it was written for: the page must offer the calendar term
 * even though the student's most recent row belongs to a later one. The bite
 * is verified by running this file against the pre-fix code.
 *
 * The unit-level bite stays where it is, in
 * `tests/unit/reinscripcion.test.ts` ("enrols into the calendar term even when
 * the newest row belongs to a later term").
 *
 * Read-only on purpose. Enrolling from a test would mutate the local D1 and the
 * next run would see a different page, so the lane would stop being repeatable.
 * The happy path through the form stays where a repeatable gate belongs:
 * Playwright.
 */
import { test } from "@e2e-dev/web";
import { currentAcademicPeriod } from "../src/lib/server/enrollment";

test("the enrolment period on screen is the term the calendar says", {
	session: "alumno",
	timeout: 300_000,
}, async ({ app, agent }) => {
	await app.open("/reinscripcion");

	const expected = currentAcademicPeriod();

	await agent.assert(
		`the page states that the period being enrolled is "${expected}" — read the "Periodo:" line at the top of the offer and say the exact term it names, and say whether it matches "${expected}". If the page instead says there is no active period, that is the answer and it is wrong.`,
	);
});

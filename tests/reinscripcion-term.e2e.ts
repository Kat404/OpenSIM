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
 * WHAT IT DOES NOT PROVE, measured rather than assumed: this test was run
 * against the PRE-FIX code and it PASSED. The `alumno` session is `99999999`,
 * who has zero `student_progress` rows, so `getLatestProgressPeriod` returned
 * null and the chain fell through to `currentAcademicPeriod()` — the very value
 * the test compares against. The ordering bug is only reachable for a student
 * who HAS rows.
 *
 * So this is a guard on the term rendering and resolving at all, not a bite on
 * the lexicographic bug. The bite is in
 * `tests/unit/reinscripcion.test.ts` ("enrols into the calendar term even when
 * the newest row belongs to a later term"), which seeds a student who has rows.
 * Widening what the agentic lane can reach means giving the e2e credential a
 * realistic history, and that is a decision with consequences, not a quiet
 * change here.
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

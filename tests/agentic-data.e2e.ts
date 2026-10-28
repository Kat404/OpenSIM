/**
 * OpenSIM — data assertions judged by an agent.
 *
 * The agentic lane buys one thing a locator cannot: a claim about DATA.
 * A locator can check that a number is on the screen; it cannot check that
 * three numbers on the screen agree with each other, that every cell of a
 * record holds a real value, or that a grid shows the rows it is
 * supposed to show.
 *
 * These four tests are that claim, on the four routes where the data is
 * rich enough to assert something:
 *
 *   /dashboard          the advance percentage is the quotient of the two
 *                       numbers the same card shows, and the averages stay
 *                       inside the TecNM 0–10 scale
 *   /tramites           the gap the page names is the difference between
 *                       what the student has and what the gate demands
 *   /academico/kardex   the record has no holes: every row carries a real
 *                       grade, credits, a term and an evaluation type
 *   /horario            the grid shows exactly the subjects this student
 *                       is enrolled in, with day, time and classroom
 *
 * THE STUDENT HAS A HISTORY NOW. Since 2026-10-19 the runner signs in as
 * `12345678`, who has 49 rows in `student_progress` (175 approved credits,
 * 3 complementary ones). With the previous empty student every screen
 * rendered an empty state and the tests could only assert things that
 * could not fail — the enrolment-term test even passed against the code
 * it was written to catch, because the bug it hunted was only reachable
 * for a student who has rows.
 *
 * The numbers below are the fixture's truth, measured on the local D1:
 * 175 approved of 260 (67.3 %), 3 complementary of 5, a 7-credit gap to
 * the Servicio Social gate, and five enrolled subjects.
 *
 * A green here is evidence, not proof: the judgment is a model reading a
 * screen. vitest and Playwright remain the gate, and `just qa-fast` does
 * not depend on any of this passing.
 */
import { describe, test } from "@e2e-dev/web";
import { expect } from "e2e";
import { z } from "zod";

/** The enrolled subjects of the fixture student, in the grid's own codes. */
const ENROLLED_CODES = ["ACA-0909", "SCC-1023", "SCD-1004", "SCD-1015", "SCG-1009"];

describe("dashboard — the KPIs agree with each other", { tags: ["datos"] }, () => {
	test(
		"the advance percentage is the quotient of the credits the card shows",
		{
			session: "alumno",
			timeout: 300_000,
		},
		async ({ app, agent, screen }) => {
			await app.open("/dashboard");

			// Three keys, and the prompt says where each number lives: the
			// card that shows "175 / 260" is ONE number pair, and the model
			// has to split it. A schema with more keys than the model
			// reliably fills is a schema the repair cannot fit, and the
			// answer is a failure that has nothing to do with the page.
			const kpis = await agent.extract(
				'the dashboard KPI cards: the approved credits (the FIRST number of the card that shows two, like "175 / 260"), the total credits (the SECOND number of that same card), and the advance percentage (the card labelled "% Avance")',
				{
					schema: z.object({
						approvedCredits: z.number().int(),
						totalCredits: z.number().int(),
						advancePercent: z.number(),
					}),
				},
			);

			expect(kpis.approvedCredits).toBe(175);
			expect(kpis.totalCredits).toBe(260);

			// The relation: the percentage is the quotient of the two numbers
			// the same screen shows. A card that divides by something else
			// breaks here, and no locator can see that.
			expect(kpis.advancePercent).toBeCloseTo((kpis.approvedCredits / kpis.totalCredits) * 100, 1);

			// The TecNM scale is 0–10. An average outside it is a broken
			// datum, whatever it is a percentage of. This one is a judgment
			// and not a schema field: asking for two more numbers the model
			// has to split is asking for the failure mode again.
			await agent.assert(
				"the two averages on the dashboard — the certified one and the arithmetic one — are both numbers between 0 and 10",
			);

			await expect(screen.getByRole("heading", { name: /Bienvenido/ })).toBeVisible();
		},
	);
});

describe("tramites — the gate numbers add up", { tags: ["datos"] }, () => {
	test(
		"the missing credits are the difference between what the student has and what is demanded",
		{
			session: "alumno",
			timeout: 300_000,
		},
		async ({ app, agent, screen }) => {
			await app.open("/tramites");

			// Two keys. The complementary pair is extracted by the other
			// spec (same file family, `tests/phase10-pages.e2e.ts`), which
			// already pins "3 de 5"; this one is about the reticular gap.
			const gates = await agent.extract(
				"the Trámites page: the approved reticular credits the student has (the line that says how many credits the student has approved) and the reticular credits the Servicio Social procedure requires (the number in the requirements of the Servicio Social step)",
				{
					schema: z.object({
						reticularHave: z.number().int(),
						reticularRequired: z.number().int(),
					}),
				},
			);

			expect(gates.reticularHave).toBe(175);
			expect(gates.reticularRequired).toBe(182);

			// The gap the page names must be the difference between what the
			// student has and what the gate demands: 175 + 7 = 182. The number
			// comes from the page itself, not from this file.
			const reason = await screen.getByText(/Necesitas \d+ créditos reticulares más/).textContent();
			const missing = Number(/Necesitas (\d+) créditos/.exec(reason ?? "")?.[1]);
			expect(Number.isNaN(missing)).toBe(false);
			expect(gates.reticularHave + missing).toBe(gates.reticularRequired);

			// The complementary gate is a second door, and this student has
			// not opened it: the page says "3 de 5" and the other spec pins
			// those two numbers.
			await expect(screen.getByText(/3 de 5 créditos\s+complementarios/)).toBeVisible();
		},
	);
});

describe("kardex — the record has no holes", { tags: ["datos"] }, () => {
	test(
		"every row carries a real grade, credits, a term and an evaluation type",
		{
			session: "alumno",
			timeout: 300_000,
		},
		async ({ app, agent, screen }) => {
			await app.open("/academico/kardex");

			// The empty state is no longer possible for this student, and a
			// page that still shows it would be lying about the record.
			await expect(screen.getByText(/Aún no tienes/)).toHaveCount(0);
			await expect(screen.getByText("Clave")).toBeVisible();

			// The rule the table must obey, as the lane found it: the grade
			// column holds a number or a hole, never a state. A row that said
			// "En curso" in the Calificación column while its Estado column
			// said "Aprobado" or "Bloqueado" contradicted itself.
			await agent.assert(
				"every row of the academic record table that has a grade shows it as a number between 0 and 10, every row without a grade shows a dash, and no row states a status such as 'En curso' in the Calificación column",
			);
		},
	);
});

describe("horario — the grid shows the enrolled subjects", { tags: ["datos"] }, () => {
	test(
		"the weekly grid holds exactly this student's classes, with day, time and classroom",
		{
			session: "alumno",
			timeout: 300_000,
		},
		async ({ app, agent, screen }) => {
			await app.open("/horario");

			// The five subjects this student is enrolled in are on the grid.
			// The locator pins them; the model judges the rest ("and no
			// others", and that every block names its day, time and
			// classroom). Asking the model for the list as structured data
			// was the fragile version: a one-key schema gives the repair
			// nothing to anchor on, and the model names the field whatever it
			// likes.
			for (const code of ENROLLED_CODES) {
				await expect(screen.getByText(code).first()).toBeVisible();
			}

			await agent.assert(
				`the weekly grid shows classes for exactly these five subjects and no others: ${ENROLLED_CODES.join(", ")}; every class names the day it is on, its time range and its classroom, and no entry is a placeholder or an empty slot`,
			);

			await expect(screen.getByRole("heading", { name: "Horario Semanal" })).toBeVisible();
		},
	);
});

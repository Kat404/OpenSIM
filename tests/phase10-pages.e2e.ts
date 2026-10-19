/**
 * OpenSIM — e2e agentic coverage for the pages that had none.
 *
 * Phase 10, S7. The agentic runner is the most expensive QA layer in the
 * project — a real browser against a real model gateway — and until this file
 * it covered exactly one flow. These tests close the gap where correctness is a
 * claim about DATA rather than a click path.
 *
 * These read, they do not click. `agent.act` is for driving the app, and the
 * route links plus `app.open` already do that deterministically, so every step
 * here is an `agent.assert` or `agent.extract` over a screen the runner reached
 * without a model. That is deliberate: the expensive part should buy judgment
 * ("do these three numbers actually add up?"), not navigation a locator does
 * for free.
 *
 * What this layer is NOT: a replacement for vitest or Playwright. Those are
 * deterministic and stay the gate. An agent is probabilistic, so a green run
 * here is evidence, not proof, and nothing in `just qa-fast` depends on any of
 * these passing.
 *
 * STATUS: they run. `agent.assert` and `agent.extract` need valid structured
 * output, and this gateway does not produce it as requested: the JSON comes
 * back valid and its values are right, but the model paraphrases the key names
 * it was given and sometimes answers with several candidate objects at once.
 * That is a provider property, not a test defect, so
 * `e2e-structured-output-shim.ts` repairs the response at the model boundary
 * and these assertions stay as they were written. Retries were tried and
 * removed earlier: they multiply cost without moving the rate, which was
 * measured, not assumed.
 *
 * Session note: since 2026-10-19 the `alumno` credential is `12345678`, the
 * student with a history (175 approved credits, 3 complementary ones, 49 rows
 * in `student_progress`). Before that it was `99999999`, who has none, and
 * every assertion about per-student data had to be written as a shape rather
 * than a value — a test that quietly depended on the empty student would pass
 * or fail for the wrong reason. The data assertions now live in
 * `tests/agentic-data.e2e.ts`; the ones here are about MEANING (what the page
 * claims), and those about VALUES (what the numbers are) are there.
 */
import { describe, test } from "@e2e-dev/web";
import { expect } from "e2e";
import { z } from "zod";

describe("temario — explicit coverage", { tags: ["temario"] }, () => {
	test("the coverage numbers on screen are internally consistent", {
		session: "alumno",
		timeout: 300_000,
	}, async ({ app, agent, screen, browser }) => {
		await app.open("/temario");

		// The point of Phase 10 S6 is that the ratio is stated, not hidden. An
		// extraction is the right tool: it forces the model to read the number
		// as a number, so a page that rendered "7 de 68" while listing a
		// different count of subjects fails here instead of passing on a
		// substring match.
		const coverage = await agent.extract(
			"the coverage summary at the top of the page: how many subjects have a published syllabus, how many subjects the plan has in total, and the subtopic count if one is shown",
			{
				schema: z.object({
					withTemario: z.number().int(),
					total: z.number().int(),
					subtopics: z.number().int().nullable(),
				}),
			},
		);

		expect(coverage.withTemario).toBeGreaterThan(0);
		expect(coverage.withTemario).toBeLessThanOrEqual(coverage.total);
		expect(coverage.total).toBeGreaterThan(coverage.withTemario);

		await expect(screen.getByRole("heading", { name: "Temario por materia" })).toBeVisible();
		await expect(screen.getByText(/de \d+ materias tienen temario publicado/)).toBeVisible();
		await expect(browser).toHaveURL("/temario");
	});

	test("a missing syllabus reads as a portal gap, not an institutional one", {
		session: "alumno",
		timeout: 300_000,
	}, async ({ app, agent, screen }) => {
		await app.open("/temario");

		await agent.assert(
			"the page explains why most subjects have no syllabus, and that the cause is the portal not publishing them rather than the institution not having them",
		);

		// Both groups must exist. A subject the portal never published is a
		// different fact from a subject with an empty syllabus, and collapsing
		// them would blame the institution for a limitation of the source.
		await expect(screen.getByRole("heading", { name: /Con temario publicado/ })).toBeVisible();
		await expect(screen.getByRole("heading", { name: /Sin temario publicado/ })).toBeVisible();
		await expect(
			screen.getByText("El portal no publica el temario de esta materia").first(),
		).toBeVisible();
	});
});

describe("horario — real schedule vs pending groups", { tags: ["horario"] }, () => {
	test("shows a grid, an explicit empty state, or a pending list that says why", {
		session: "alumno",
		timeout: 300_000,
	}, async ({ app, agent, screen }) => {
		await app.open("/horario");

		// Whichever state this student is in, the page must not leave a reader
		// guessing: an empty grid with no explanation reads as "you have no
		// classes", which is a different and false statement.
		// This student has classes, so the grid is not optional any more.
		await agent.assert(
			"the schedule page shows a weekly grid of classes with day, time and classroom",
		);

		await expect(screen.getByRole("heading", { name: "Horario Semanal" })).toBeVisible();
	});
});

describe("tramites — the double credit gate", { tags: ["tramites"] }, () => {
	test("names both gates and never implies they substitute each other", {
		session: "alumno",
		timeout: 300_000,
	}, async ({ app, agent, screen }) => {
		await app.open("/tramites");

		await agent.assert(
			"the page states how many complementary credits the student has, out of how many are required, and explains that Servicio Social needs the reticular credits AND the complementary credits together",
		);

		const credits = await agent.extract(
			"the credit counts shown on the page: the reticular approved credits and the complementary credits",
			{
				schema: z.object({
					reticular: z.number().int(),
					complementary: z.number().int(),
					complementaryRequired: z.number().int(),
				}),
			},
		);

		// This student has three complementary activities worth one credit
		// each, so the page must report 3 of 5. Before Phase 10 the loader
		// counted activity ROWS, and a page reporting "3 de 5" from three
		// rows was indistinguishable from one reporting the real sum — with
		// this fixture both are 3, which is why the sum is pinned in
		// `tests/unit/migration-0016.test.ts` and not here.
		expect(credits.complementary).toBe(3);
		expect(credits.complementaryRequired).toBe(5);

		await expect(screen.getByText(/de \d+ créditos\s+complementarios/)).toBeVisible();
		await expect(
			screen.getByText(/no aportan créditos reticulares y no los sustituyen/),
		).toBeVisible();
	});

	test("every locked procedure states which gate is unmet", {
		session: "alumno",
		timeout: 300_000,
	}, async ({ app, agent, screen }) => {
		await app.open("/tramites");

		// `/tramites` is a stepper: only the selected procedure shows its lock
		// state and its reason, the other two are navigation buttons. So "every
		// locked procedure says why" is not one question, it is three — asking
		// it once makes the model answer `ASSERTION_INCONCLUSIVE` for the right
		// reason, which is the runner working, not the runner failing.
		for (const procedure of ["Servicio Social", "Residencia Profesional", "Titulación"]) {
			await screen.getByRole("button", { name: new RegExp(procedure) }).tap();
			await agent.assert(
				`the ${procedure} panel shows whether it is blocked, and if it is blocked it states the reason, naming a credit gap`,
			);
		}

		// And the concrete gap this student is actually missing, which is the
		// number the page owes them.
		await expect(screen.getByText(/Necesitas \d+ créditos/).first()).toBeVisible();
	});
});

describe("kardex — academic record", { tags: ["kardex"] }, () => {
	test("renders the record or an explicit empty state", {
		session: "alumno",
		timeout: 300_000,
	}, async ({ app, agent, screen }) => {
		await app.open("/academico/kardex");

		await agent.assert("the Kardex page shows a table of graded subjects, not an empty state");

		// The empty state is no longer possible for this student: every
		// `student_progress` row is his. Demanding the table used to fail for
		// a reason that had nothing to do with the page — the session student
		// was `99999999` — so the test accepted both. The record is what the
		// page owes now.
		await expect(screen.getByRole("heading", { name: "Kardex Académico" })).toBeVisible();
		await expect(screen.getByText(/Clave/)).toBeVisible();
		await expect(screen.getByText(/Aún no tienes/)).toHaveCount(0);
	});
});

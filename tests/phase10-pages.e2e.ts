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
 * STATUS: these tests do not pass against the current gateway, and they are
 * committed anyway rather than deleted or weakened. `agent.assert` and
 * `agent.extract` need valid structured output; this gateway emits it for a
 * simple synthetic question about 60% of the time, and 0% of the time against
 * the real screens of this app (6 tests, 36 model calls, every one
 * MODEL_OUTPUT_INVALID). Retries were tried and removed: they multiply cost
 * without moving the rate, which was measured, not assumed.
 *
 * They become meaningful the moment `E2E_MODEL` names a model that answers
 * tool-calling reliably. Keep the assertions; change the gateway, not the
 * questions.
 *
 * Session note: the `alumno` credential belongs to `99999999`, the placeholder
 * student, not to the 175-credit fixture (`12345678`). The pages still render
 * the fixture's catalogue, temario and credit rules because those are global
 * catalog data; only the per-student rows belong to `12345678`. The credit
 * tests below therefore assert the SHAPE of the rule, never that this student
 * passes it — the placeholder has zero complementary credits, and a test that
 * quietly depended on the other student would pass or fail for the wrong
 * reason.
 */
import { describe, test } from "@e2e-dev/web";
import { expect } from "e2e";
import { z } from "zod";

describe("temario — explicit coverage", { tags: ["temario"] }, () => {
	test("the coverage numbers on screen are internally consistent", {
		session: "alumno",
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
	}, async ({ app, agent, screen }) => {
		await app.open("/horario");

		// Whichever state this student is in, the page must not leave a reader
		// guessing: an empty grid with no explanation reads as "you have no
		// classes", which is a different and false statement.
		await agent.assert(
			"the schedule page either shows a weekly grid of classes with day, time and classroom, or states why there are none",
		);

		await expect(screen.getByRole("heading", { name: "Horario Semanal" })).toBeVisible();
	});
});

describe("tramites — the double credit gate", { tags: ["tramites"] }, () => {
	test("names both gates and never implies they substitute each other", {
		session: "alumno",
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

		// The placeholder student has no history, so 0/0. What matters is that
		// the page reports a complementary count at all: before Phase 10 the
		// loader counted activity ROWS, and a page reporting "3 de 5" from
		// three rows was indistinguishable from one reporting the real sum.
		expect(credits.complementary).toBeGreaterThanOrEqual(0);
		expect(credits.complementaryRequired).toBe(5);

		await expect(screen.getByText(/de \d+ créditos\s+complementarios/)).toBeVisible();
		await expect(
			screen.getByText(/no aportan créditos reticulares y no los sustituyen/),
		).toBeVisible();
	});

	test("a locked procedure states which gate is unmet", { session: "alumno" }, async ({
		app,
		agent,
		screen,
	}) => {
		await app.open("/tramites");

		await agent.assert(
			"every procedure that is locked gives the student a reason, naming a credit gap",
		);

		await expect(screen.getByText(/Servicio Social/)).toBeVisible();
		await expect(screen.getByText(/Necesitas \d+ créditos/).first()).toBeVisible();
	});
});

describe("kardex — academic record", { tags: ["kardex"] }, () => {
	test("renders the record or an explicit empty state", { session: "alumno" }, async ({
		app,
		agent,
		screen,
	}) => {
		await app.open("/academico/kardex");

		await agent.assert(
			"the Kardex page shows either a table of graded subjects or an empty state saying there is no academic record",
		);

		// Both branches are covered: this student has one ENROLLED row, so the
		// table is the expected shape, and a heading-only page that silently
		// dropped the record would fail the judgment above.
		await expect(screen.getByRole("heading", { name: "Kardex Académico" })).toBeVisible();
		await expect(screen.getByRole("columnheader", { name: "Clave" })).toBeVisible();
	});
});

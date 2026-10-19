/**
 * OpenSIM — the Kardex grade column holds grades, not states.
 *
 * Found by the agentic lane on 2026-10-19, and pinned here because the
 * deterministic gate is where a regression belongs: the grade column used
 * to say "En curso" for every row without a grade, so the three approved
 * complementary subjects (evaluated without a 0–10 grade) and the two locked
 * ones contradicted their own Estado column, which said "Aprobado" or
 * "Bloqueado" right beside it.
 *
 * The rule: the Calificación column holds a number or a hole. The Estado
 * column holds the state.
 *
 * This spec signs in as `12345678`, the catalogue student, because the
 * placeholder student the shared setup uses has no `student_progress` rows
 * and therefore no table to check. The credential comes from the same
 * `.env` the rest of the suite reads, and `just test-e2e` provisions it
 * (`db-set-password-alumno`).
 */
import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";

if (process.env.OPENSIM_TEST_PASSWORD === undefined && existsSync(".env")) {
	process.loadEnvFile();
}

const CONTROL_NUMBER = "12345678";
const PASSWORD = process.env.OPENSIM_TEST_PASSWORD ?? "opensim-dev-2026";

test.describe("kardex — the catalogue student", () => {
	// No shared session: this spec signs in as the student with a record.
	test.use({ storageState: { cookies: [], origins: [] } });

	test("the grade column never states a status", async ({ page }) => {
		await page.goto("/login");
		await page.fill('input[name="controlNumber"]', CONTROL_NUMBER);
		await page.fill('input[name="password"]', PASSWORD);
		await Promise.all([
			page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
			page.click('button[type="submit"]'),
		]);

		await page.goto("/academico/kardex");

		const rows = page.locator("table tbody tr");
		const count = await rows.count();
		expect(count).toBeGreaterThan(0);

		for (let i = 0; i < count; i++) {
			const cells = rows.nth(i).locator("td");
			// Clave, Asignatura, Cr, Periodo, Calificación, Evaluación, Estado.
			const grade = (await cells.nth(4).innerText()).trim();
			expect(grade, `row ${i + 1} grade cell`).toMatch(/^(\d+\.\d|—)$/);
		}
	});

	test("a row with no grade shows a hole, and its state says why", async ({ page }) => {
		await page.goto("/login");
		await page.fill('input[name="controlNumber"]', CONTROL_NUMBER);
		await page.fill('input[name="password"]', PASSWORD);
		await Promise.all([
			page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
			page.click('button[type="submit"]'),
		]);

		await page.goto("/academico/kardex");

		// The locked subjects (ENERO-JUNIO/2027) have no grade and are not
		// in course: the row must show the hole in the grade column and
		// the state in the Estado column.
		const row = page.locator("table tbody tr", { hasText: "SCA-1002" });
		await expect(row).toHaveCount(1);
		await expect(row.locator("td").nth(4)).toHaveText("—");
		await expect(row.locator("td").nth(6)).toHaveText("Bloqueada");
	});
});

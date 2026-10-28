/**
 * OpenSIM — the "Carga actual" grid names the subject of every block.
 *
 * The grid used to show a dash where the subject belongs: the loader
 * returned the schedule blocks without their subject, and the simulator
 * looked the subject up in the offer page it renders — where an
 * ENROLLED group never appears. So the student saw their own week as a
 * grid of anonymous blocks: a time, a classroom, and a dash.
 *
 * This spec signs in as `12345678`, the catalogue student, because the
 * placeholder student the shared setup uses has no schedule blocks at
 * all (and therefore no grid to check).
 */
import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";

if (process.env.OPENSIM_TEST_PASSWORD === undefined && existsSync(".env")) {
	process.loadEnvFile();
}

const CONTROL_NUMBER = "12345678";
const PASSWORD = process.env.OPENSIM_TEST_PASSWORD ?? "opensim-dev-2026";

test.describe("reinscripcion — the Carga actual grid", () => {
	// No shared session: this spec signs in as the student with blocks.
	test.use({ storageState: { cookies: [], origins: [] } });

	test("every enrolled block names its subject", async ({ page }) => {
		await page.goto("/login");
		await page.fill('input[name="controlNumber"]', CONTROL_NUMBER);
		await page.fill('input[name="password"]', PASSWORD);
		await Promise.all([
			page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
			page.click('button[type="submit"]'),
		]);

		await page.goto("/reinscripcion");

		const grid = page.locator(".preview__grid");
		await expect(grid).toBeVisible();

		const codes = grid.locator(".preview__block-code");
		await expect(codes.first()).toBeVisible();

		// The subject code, not the dash the grid used to show.
		const texts = await codes.allInnerTexts();
		expect(texts.length).toBeGreaterThan(0);
		for (const text of texts) {
			expect(text.trim(), "a block must name its subject").not.toBe("—");
			expect(text.trim(), "a block must name its subject").toMatch(/^[A-Z]{3}-\d{4}$/);
		}
	});
});

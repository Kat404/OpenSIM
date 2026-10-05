/**
 * OpenSIM — Playwright auth setup (Phase 5 Tarea 5.1.2).
 *
 * Logs in once with the dev student credential and writes the session
 * cookies to `playwright/.auth/storage.json` so every protected spec
 * reuses the same session. The storage file is gitignored (session
 * cookies are not artefacts).
 *
 * Requires D1 to be seeded beforehand:
 *   just db-reset && just db-set-password
 *
 * Default dev credential per the OpenSIM spec §3 / §7:
 *   controlNumber: <NUMERO DE CONTROL PURGADO>
 *   password:      opensim-dev-2026
 */
import { expect, test as setup } from "@playwright/test";

const AUTH_FILE = "playwright/.auth/storage.json";

setup("authenticate as test student <NUMERO DE CONTROL PURGADO>", async ({ page }) => {
	await page.goto("/login");

	await page.fill('input[name="controlNumber"]', "<NUMERO DE CONTROL PURGADO>");
	await page.fill('input[name="password"]', "opensim-dev-2026");

	await Promise.all([
		page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
		page.click('button[type="submit"]'),
	]);

	// The (protected) layout bounces to /dashboard on success.
	await expect(page).toHaveURL(/\/dashboard$/);

	await page.context().storageState({ path: AUTH_FILE });
});

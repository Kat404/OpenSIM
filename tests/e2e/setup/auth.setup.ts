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
 *   controlNumber: 12345678
 *   password:      opensim-dev-2026
 *
 * The seeder (src/lib/server/db/seed-password.ts) resolves the credential as
 * positional arg → OPENSIM_TEST_* env → default. This mirrors that chain
 * instead of hardcoding, so the login always matches whatever
 * `just db-set-password` actually wrote. Hardcoding desynced silently the
 * moment .env set a different password: D1 got one credential and this
 * posted another, the login bounced back to /login, and every protected
 * spec failed on a 15 s waitForURL timeout.
 */
import { expect, test as setup } from "@playwright/test";

const AUTH_FILE = "playwright/.auth/storage.json";

const CONTROL_NUMBER = process.env.OPENSIM_TEST_CONTROL_NUMBER ?? "12345678";
const PASSWORD = process.env.OPENSIM_TEST_PASSWORD ?? "opensim-dev-2026";

setup(`authenticate as test student ${CONTROL_NUMBER}`, async ({ page }) => {
	await page.goto("/login");

	await page.fill('input[name="controlNumber"]', CONTROL_NUMBER);
	await page.fill('input[name="password"]', PASSWORD);

	await Promise.all([
		page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
		page.click('button[type="submit"]'),
	]);

	// The (protected) layout bounces to /dashboard on success.
	await expect(page).toHaveURL(/\/dashboard$/);

	await page.context().storageState({ path: AUTH_FILE });
});

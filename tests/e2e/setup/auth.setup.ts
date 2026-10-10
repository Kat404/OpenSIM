/**
 * OpenSIM — Playwright auth setup (Phase 5 Tarea 5.1.2).
 *
 * Logs in once with the dev student credential and writes the session
 * cookies to `playwright/.auth/storage.json` so every protected spec
 * reuses the same session. The storage file is gitignored (session
 * cookies are not artefacts).
 *
 * Requires a migrated D1 with the credential provisioned beforehand:
 *   just db-migrate && just db-set-password
 * (that is what `just test-e2e` does for you, non-destructively; use
 * `just test-e2e-fresh` only when the local database must be rebuilt)
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
 *
 * `.env` is loaded here because Playwright does not load it for the test
 * process — only Vite loads it, for the dev server it spawns. Without this the
 * lookup above always fell through to the default while D1 held the real
 * password, and the failure looked like a broken app rather than a missing
 * variable. `.env` is gitignored, so nothing here is committed.
 */
import { expect, test as setup } from "@playwright/test";

if (process.env.OPENSIM_TEST_PASSWORD === undefined) {
	process.loadEnvFile();
}

const AUTH_FILE = "playwright/.auth/storage.json";

// Must match seed-password.ts's DEFAULT_CONTROL_NUMBER. The credential's
// control number is deliberately distinct from the catalog student's
// (12345678 in seed.sql): seed.sql never names this control number, and the
// profile write it does emit is an ON CONFLICT ... DO UPDATE upsert, so no
// DELETE — and therefore no ON DELETE CASCADE into student_credentials —
// can reach it. It does own a student_profiles row, created by seed-password.ts
// itself — see seed-password.ts.
// Defaulting to the old shared key made every test-e2e run fail auth with
// a 15 s waitForURL timeout.
const CONTROL_NUMBER = process.env.OPENSIM_TEST_CONTROL_NUMBER ?? "99999999";
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

/**
 * OpenSIM — axe-core WCAG 2.1 AA scan: /perfil.
 *
 * The profile page is a new protected route: every protected route has
 * its own sweep file, because the gate is per route, not per app.
 */
import { test } from "@playwright/test";

import { scanForA11y } from "./_helpers";

test.use({ storageState: "playwright/.auth/storage.json" });

test("perfil has no serious/critical WCAG 2.1 AA violations", async ({ page }, testInfo) => {
	await page.goto("/perfil");
	await scanForA11y(page, testInfo);
});

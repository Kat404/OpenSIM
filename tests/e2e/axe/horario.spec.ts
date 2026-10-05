/**
 * OpenSIM — axe-core WCAG 2.1 AA scan: /horario (Phase 5 Tarea 5.1.3).
 */
import { test } from "@playwright/test";
import { scanForA11y } from "./_helpers";

test.use({ storageState: "playwright/.auth/storage.json" });

test("horario has no serious/critical WCAG 2.1 AA violations", async ({ page }, testInfo) => {
	await page.goto("/horario");
	await scanForA11y(page, testInfo);
});

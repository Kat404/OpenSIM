/**
 * OpenSIM — axe-core WCAG 2.1 AA scan: /academico/kardex (Phase 5 Tarea 5.1.3).
 *
 * Two scans: the unfiltered table and the table with the
 * "Repetición" filter pill active, so the filter chip's expanded
 * aria state is exercised (the L3/N8 refactor keeps the labels in
 * a single source but the filter row's accessibility still needs
 * axe validation).
 */
import { test } from "@playwright/test";
import { scanForA11y } from "./_helpers";

test.use({ storageState: "playwright/.auth/storage.json" });

test("kardex base view has no serious/critical WCAG 2.1 AA violations", async ({
	page,
}, testInfo) => {
	await page.goto("/academico/kardex");
	await scanForA11y(page, testInfo);
});

test("kardex with filter pill active has no serious/critical WCAG 2.1 AA violations", async ({
	page,
}, testInfo) => {
	await page.goto("/academico/kardex");
	// Click the Repetición filter pill (label comes from EVALUATION_LABEL).
	await page.getByRole("button", { name: "Repetición" }).click();
	await scanForA11y(page, testInfo);
});

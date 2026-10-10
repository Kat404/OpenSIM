/**
 * OpenSIM — axe-core WCAG 2.1 AA scan: /reticula (Phase 5 Tarea 5.1.3).
 *
 * Three tests: the bare route, the Cmd+K deep-link variant (URL hash),
 * since the round-6 audit (M6) flagged the deep-link path as a separate
 * flow, and the specialty-leak guard added by T9.10. The first two should
 * pass on accessibility; the third on data scoping.
 */
import { expect, test } from "@playwright/test";
import { scanForA11y } from "./_helpers";

test.use({ storageState: "playwright/.auth/storage.json" });

test("reticula base route has no serious/critical WCAG 2.1 AA violations", async ({
	page,
}, testInfo) => {
	await page.goto("/reticula");
	await scanForA11y(page, testInfo);
});

test("reticula with deep-link hash has no serious/critical WCAG 2.1 AA violations", async ({
	page,
}, testInfo) => {
	// canonicalId for Cálculo Diferencial per the curriculum fixture.
	await page.goto("/reticula#acf-0901");
	// Assert the deep-link actually focused the target node before
	// scanning — otherwise a hash-routing regression would scan the
	// same page as the base case and pass silently (audit N22, Round 7).
	// SubjectNode.svelte applies `class:node--highlighted={isHighlighted}`
	// when the deep-link lands; we assert that class is present.
	await expect(page.locator('[data-canonical-id="acf-0901"]')).toHaveClass(/node--highlighted/, {
		timeout: 5_000,
	});
	await scanForA11y(page, testInfo);
});

test("retícula never renders a specialty module of another programme", async ({ page }) => {
	// The catalogue carries three specialties (TDD / SID / TND). The page may
	// only ever show the signed-in student's own — T9.10's operator decision.
	// The demo student the suite signs in as is seeded without a specialty, so
	// the tray legitimately renders nothing; the assertion below is written to
	// hold in both cases: nothing from another programme, ever, on this route.
	await page.goto("/reticula");
	const text = await page.locator("body").innerText();
	expect(text).not.toContain("SID-2301");
	expect(text).not.toContain("SID-2302");
	expect(text).not.toContain("TND-2301");
	expect(text).not.toContain("TND-2302");
});

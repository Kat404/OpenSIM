/**
 * OpenSIM — axe-core WCAG 2.1 AA scan: /temario (T9.12).
 *
 * The page ships 68 subject rows plus a collapsed syllabus per published
 * subject, so this is also the regression gate on its node budget: an
 * expanded `<details>` per subject would put the page back at the size
 * T9.14 removed from /reinscripcion.
 */
import { expect, test } from "@playwright/test";

import { scanForA11y } from "./_helpers";

test.use({ storageState: "playwright/.auth/storage.json" });

test("temario has no serious/critical WCAG 2.1 AA violations", async ({ page }, testInfo) => {
	await page.goto("/temario");
	await scanForA11y(page, testInfo);
});

test("temario names the real coverage and separates published from unpublished", async ({
	page,
}) => {
	await page.goto("/temario");

	// The coverage figure is read off the rows, so the two counts it shows
	// must equal what the list actually renders.
	const coverage = page.getByText(/de\s+\d+\s+materias tienen temario publicado/);
	await expect(coverage).toBeVisible();

	const withTemario = page.getByRole("heading", { name: /Con temario publicado/ });
	const withoutTemario = page.getByRole("heading", { name: /Sin temario publicado/ });
	await expect(withTemario).toBeVisible();
	await expect(withoutTemario).toBeVisible();

	// A subject the portal never published must say so on its own row — it
	// is not the same fact as a subject with an empty syllabus.
	await expect(
		page.getByText("El portal no publica el temario de esta materia").first(),
	).toBeVisible();
});

test("temario keeps its collapsed syllabus out of the initial DOM budget", async ({ page }) => {
	await page.goto("/temario");
	await page.waitForLoadState("networkidle");

	// The regression gate on T9.14's shape: /reinscripcion died at 2 450
	// accessibility nodes. This page has 68 subjects, 32 units and 223
	// subtopics, so it only stays small because the syllabus lives inside a
	// collapsed <details>. That claim is only worth anything if it is
	// measured, so measure it.
	const nodes = await page.evaluate(() => {
		// `checkVisibility()` is the DOM's own answer to "would a screen
		// reader see this", and it accounts for a closed <details> the same
		// way axe does. An earlier version filtered on `offsetParent`, which
		// is null for <body> itself and so rejected the whole tree — a
		// counter reading 0 satisfies any upper bound while measuring
		// nothing, which is what the lower bound below exists to catch.
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
		let count = 0;
		while (walker.nextNode()) {
			const node = walker.currentNode;
			if (node instanceof HTMLElement && node.checkVisibility()) count++;
		}
		return count;
	});

	// Budget, not an exact number: the point is that it is nowhere near the
	// ~2 000 a fully expanded syllabus would cost. The lower bound matters as
	// much as the upper one — a counter that returned 0 would satisfy
	// `toBeLessThan` forever while measuring nothing.
	expect(nodes).toBeGreaterThan(100);
	expect(nodes).toBeLessThan(700);
});

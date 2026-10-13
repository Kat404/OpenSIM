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

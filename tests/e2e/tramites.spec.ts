/**
 * OpenSIM — /tramites functional spec (Phase 12 T12.1).
 *
 * The three procedure forms collect ten fields each, and OpenSIM
 * stores no procedure request: the action reads the FormData and
 * discards it. The forms are therefore disabled, and the page says so
 * BEFORE the student types anything.
 *
 * This is the public-interface proof of that contract — a student must
 * not be able to fill in a form whose data goes nowhere, and the
 * reason must be on screen, not only in the code.
 */
import { expect, test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/storage.json" });

test("the procedure forms are disabled and the page says why", async ({ page }) => {
	await page.goto("/tramites");

	// The reason is on screen, not buried in a response.
	await expect(page.getByText("OpenSIM todavía no guarda solicitudes de trámite.")).toBeVisible();

	// Every control of the visible procedure form is disabled — the
	// fieldset carries the attribute, so the inputs inside inherit it.
	const fields = page.locator("fieldset input, fieldset select, fieldset textarea");
	await expect(fields.first()).toBeVisible();
	const count = await fields.count();
	expect(count).toBeGreaterThan(0);
	for (let i = 0; i < count; i++) {
		await expect(fields.nth(i)).toBeDisabled();
	}

	// And there is no way to submit it. Scoped to the fieldset: the
	// layout header also renders a `button[type="submit"]` (the logout
	// form), and that one is very much enabled.
	await expect(page.locator("fieldset button[type=submit]")).toBeDisabled();
});

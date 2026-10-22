/**
 * All THREE procedure forms are disabled (S2 / T2).
 *
 * The branch's own e2e spec only walks the form that is visible by
 * default (`servicio-social`). The other two live behind the stepper,
 * so a regression in `TramiteFormResidencia.svelte` or
 * `TramiteFormTitulacion.svelte` would ship a fillable form whose
 * data goes nowhere, and the existing spec would still be green.
 */
import { expect, test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/storage.json" });

const FORMS = ["Servicio social", "Residencia", "Titulación"];

test("every control of every procedure form is disabled", async ({ page }) => {
	await page.goto("/tramites");

	await expect(page.getByText("OpenSIM todavía no guarda solicitudes de trámite.")).toBeVisible();

	for (const form of FORMS) {
		const step = page.getByRole("button", { name: form });
		const heading = page.getByRole("heading", { name: new RegExp(form, "i") }).first();
		// A click that lands before SvelteKit hydrates the page does
		// nothing: the stepper stays where it was and the heading never
		// appears. Retry until the step actually switched.
		await expect(async () => {
			await step.first().click();
			await expect(heading).toBeVisible({ timeout: 1000 });
		}).toPass({ timeout: 20_000 });

		const fields = page.locator("fieldset input, fieldset select, fieldset textarea");
		const count = await fields.count();
		expect(count, `${form} renders fields`).toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			await expect(fields.nth(i), `${form} field ${i}`).toBeDisabled();
		}
		await expect(page.locator("fieldset button[type=submit]")).toBeDisabled();
	}
});

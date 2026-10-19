/**
 * OpenSIM — Public landing spec (Phase 12 T12.2).
 *
 * The front door used to be the UI component inventory: a gallery of
 * atoms with hardcoded demo fixtures, open to anyone. The inventory
 * still exists, at /design-system; what this spec pins is that the
 * front door describes the project instead of displaying its parts —
 * and that the gallery's demo fixtures do not leak onto it.
 */
import { expect, test } from "@playwright/test";

test("the front door is the landing, not the component inventory", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByRole("heading", { level: 1 })).toHaveText("OpenSIM");
	await expect(page.getByRole("link", { name: "Entrar con tu número de control" })).toHaveAttribute(
		"href",
		"/login",
	);

	// The inventory's own sections stay on the inventory. ("Ada
	// Lovelace" would not do: the Avatar atom renders her initials.)
	await expect(page.getByRole("heading", { name: "Botones y entradas" })).toHaveCount(0);
});

test("the component inventory lives at /design-system", async ({ page }) => {
	await page.goto("/design-system");

	await expect(page.getByRole("heading", { level: 1 })).toContainText(
		"Inventario de componentes UI",
	);
	await expect(page.getByRole("heading", { name: "Botones y entradas" })).toBeVisible();
});

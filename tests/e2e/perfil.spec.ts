/**
 * OpenSIM — /perfil functional spec (S6).
 *
 * The profile page is the one protected page that loads the student's
 * OWN row — CURP and birth state included — instead of the
 * session-trimmed payload the shared layout carries. These assertions
 * pin that the page renders the row it is supposed to render, as
 * cards, and that it is reachable from both places the nav lives.
 *
 * The spec signs in as `12345678`, the fixture student: its profile
 * row is the one the catalogue seed writes, so every expected value
 * below is pinned by `src/lib/server/db/data/enrollment-fixture.json`
 * and not by a test double. `just test-e2e` provisions that credential
 * (`db-set-password-alumno`).
 */
import { existsSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

if (process.env.OPENSIM_TEST_PASSWORD === undefined && existsSync(".env")) {
	process.loadEnvFile();
}

const CONTROL_NUMBER = "12345678";
const FULL_NAME = "Sofía Ramírez Aguirre";
const PASSWORD = process.env.OPENSIM_TEST_PASSWORD ?? "opensim-dev-2026";

async function signIn(page: Page) {
	await page.goto("/login");
	await page.fill('input[name="controlNumber"]', CONTROL_NUMBER);
	await page.fill('input[name="password"]', PASSWORD);
	await Promise.all([
		page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
		page.click('button[type="submit"]'),
	]);
}

test.describe("perfil — the student's own general data", () => {
	// No shared session: this spec signs in as the student whose row
	// the page renders.
	test.use({ storageState: { cookies: [], origins: [] } });

	test("the page shows the student's own name and control number", async ({ page }) => {
		await signIn(page);
		await page.goto("/perfil");

		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Perfil del estudiante");

		const identity = page
			.locator("section.perfil section.card")
			.filter({ hasText: "Número de control" });
		await expect(identity.getByText(FULL_NAME)).toBeVisible();
		await expect(identity.getByText(CONTROL_NUMBER)).toBeVisible();
	});

	test("the general data is presented as cards", async ({ page }) => {
		await signIn(page);
		await page.goto("/perfil");

		const cards = page.locator("section.perfil section.card");
		await expect(cards).toHaveCount(5);

		for (const title of [
			"Datos generales",
			"Créditos",
			"Promedios",
			"Registro y servicios",
			"Datos de identificación",
		]) {
			await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
		}

		// The cards carry the row, not a row of zeroes.
		const credits = cards.filter({ hasText: "Aprobados" });
		await expect(credits.getByText("175")).toBeVisible();
		await expect(credits.getByText("67.3%")).toBeVisible();

		// The identification data lives on THIS page: the shared
		// layout payload deliberately carries no PII.
		const identification = cards.filter({ hasText: "CURP" });
		await expect(identification.getByText("RAGA000615MMZNRX3")).toBeVisible();
	});

	test("the page is reachable from the sidebar and the palette", async ({ page }) => {
		await signIn(page);
		// The palette opens from a client-side handler: a click that
		// lands before hydration leaves it closed.
		await page.waitForLoadState("networkidle");

		await expect(page.getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/perfil");

		await expect(async () => {
			await page.getByRole("button", { name: "Abrir buscador (Ctrl + K)" }).click();
			await expect(page.getByRole("combobox", { name: "Buscar" })).toBeVisible({ timeout: 1_000 });
		}).toPass({ timeout: 15_000 });

		await page.getByRole("combobox", { name: "Buscar" }).fill("Perfil");
		await expect(page.getByRole("option")).toHaveCount(1);
		await expect(page.getByRole("option")).toContainText("Perfil");
	});
});

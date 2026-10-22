/**
 * `/login?reason=<anything>` shows a notice only for the reasons the
 * app itself produces (S1 / S3).
 *
 * The notice map is looked up with a plain object index, so a reason
 * that names an `Object.prototype` member (`constructor`,
 * `__proto__`, `toString`, ...) resolves to a prototype member and the
 * page renders it as a green "success" message. A query string is
 * user input, so the lookup must be own-property only.
 */
import { expect, test } from "@playwright/test";

test("an unknown reason renders no notice", async ({ page }) => {
	await page.goto("/login?reason=bogus");
	await expect(page.locator(".login__notice")).toHaveCount(0);
});

test("a reason that names a prototype member renders no notice", async ({ page }) => {
	for (const reason of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
		await page.goto(`/login?reason=${encodeURIComponent(reason)}`);
		await expect(
			page.locator(".login__notice"),
			`reason=${reason} must not render a notice`,
		).toHaveCount(0);
	}
});

test("the reasons the app produces still render their notice", async ({ page }) => {
	await page.goto("/login?reason=logged-out");
	await expect(page.getByText("Sesión cerrada correctamente.")).toBeVisible();

	await page.goto("/login?reason=sessions-revoked");
	await expect(page.getByText("Se cerraron todas las sesiones de tu cuenta.")).toBeVisible();
});

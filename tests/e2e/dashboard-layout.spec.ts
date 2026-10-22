/**
 * OpenSIM — the dashboard's cards must contain their own buttons.
 *
 * Two defects, one cause. The "Seguridad" card holds a button labelled
 * "Cerrar sesión en todos los dispositivos", and that button used to
 * push past the card's right border: the card footer is a flex row,
 * the button's label is `nowrap`, and a flex row cannot shrink a
 * nowrap label. With the sidebar expanded the button overflowed
 * visibly; with the sidebar collapsed it sat flush against the card's
 * border, pushed to the right instead of centred in the card.
 *
 * The same spec pins the third rule the dashboard now follows: the
 * "Aún no tienes inscripción activa" empty state belongs in the same
 * column as the "Clases de hoy" widget (it talks about the student's
 * classes), instead of hanging under the CTA cards on the right.
 *
 * The spec signs in with the shared setup's student (the placeholder
 * one), because that student has no active enrolment — which is the
 * state this spec is about.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

/** The card whose header says "Seguridad". */
function securityCard(page: Page): Locator {
	return page.locator("section.card").filter({ hasText: "Seguridad" }).first();
}

/** The button inside that card. */
function logoutAllButton(page: Page): Locator {
	return securityCard(page).getByRole("button", {
		name: /Cerrar sesión en todos los dispositivos/,
	});
}

/**
 * Measures the card's content box (its border box minus its padding)
 * and the button's box, and returns both plus whether the card
 * overflows horizontally.
 */
async function measure(card: Locator, button: Locator) {
	const cardBox = await card.boundingBox();
	const buttonBox = await button.boundingBox();
	if (!cardBox || !buttonBox) {
		throw new Error("the card and its button must both be visible");
	}
	const padding = await card.evaluate((el) => {
		const style = getComputedStyle(el);
		return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
	});
	return {
		contentLeft: cardBox.x + padding.left,
		contentRight: cardBox.x + cardBox.width - padding.right,
		buttonLeft: buttonBox.x,
		buttonRight: buttonBox.x + buttonBox.width,
		overflows: await card.evaluate((el) => el.scrollWidth > el.clientWidth + 1),
	};
}

/**
 * Waits for the running CSS transitions to finish (the sidebar's width
 * animates), so the measured boxes are the final ones and not a frame
 * of a moving layout.
 */
async function settle(page: Page) {
	await page.evaluate(async () => {
		await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
	});
}

test.describe("dashboard — the cards hold their own content", () => {
	test.use({ storageState: "playwright/.auth/storage.json" });

	test("the security button stays inside its card with the sidebar expanded", async ({ page }) => {
		await page.goto("/dashboard");

		const card = securityCard(page);
		await expect(card).toBeVisible();
		const button = logoutAllButton(page);
		await expect(button).toBeVisible();

		const m = await measure(card, button);
		expect(
			m.buttonRight,
			"the button must not cross the card's right padding edge",
		).toBeLessThanOrEqual(m.contentRight + 1);
		expect(
			m.buttonLeft,
			"the button must not cross the card's left padding edge",
		).toBeGreaterThanOrEqual(m.contentLeft - 1);
		expect(m.overflows, "the card must not overflow horizontally").toBe(false);
	});

	test("the security button stays inside its card with the sidebar collapsed", async ({ page }) => {
		await page.goto("/dashboard");

		const toggle = page.getByRole("button", { name: "Colapsar menú" });
		await expect(toggle).toBeVisible();
		// The toggle sits at the bottom of the sidebar, which is as tall
		// as the document: on a page that scrolls, it is below the fold.
		await toggle.scrollIntoViewIfNeeded();
		// The click can land before hydration attaches the handler, so
		// retry until the sidebar actually collapses.
		await expect(async () => {
			await toggle.click();
			await expect(page.getByRole("button", { name: "Expandir menú" })).toBeVisible({
				timeout: 1_000,
			});
		}).toPass({ timeout: 15_000 });

		const card = securityCard(page);
		const button = logoutAllButton(page);
		await expect(button).toBeVisible();
		await settle(page);

		const m = await measure(card, button);
		expect(
			m.buttonRight,
			"the button must not cross the card's right padding edge",
		).toBeLessThanOrEqual(m.contentRight + 1);
		expect(
			m.buttonLeft,
			"the button must not cross the card's left padding edge",
		).toBeGreaterThanOrEqual(m.contentLeft - 1);
		expect(m.overflows, "the card must not overflow horizontally").toBe(false);
	});

	test("the enrollment empty state sits with the classes widget, not under the CTAs", async ({
		page,
	}) => {
		await page.goto("/dashboard");

		const emptyState = page.getByText("Aún no tienes inscripción activa");
		await expect(emptyState).toBeVisible();

		// Both the empty state and the "Clases de hoy" widget live in the
		// same column: the empty state talks about the student's classes.
		const sameColumn = await page.evaluate(() => {
			const empty = [...document.querySelectorAll("*")].find(
				(el) =>
					el.textContent?.trim().startsWith("Aún no tienes inscripción activa") &&
					el.children.length === 0,
			);
			const today = [...document.querySelectorAll("*")].find(
				(el) => el.textContent?.trim() === "Clases de hoy" && el.children.length === 0,
			);
			if (!empty || !today) return false;
			return empty.closest(".dashboard__today") === today.closest(".dashboard__today");
		});
		expect(sameColumn, "the empty state must live in the classes column").toBe(true);
	});
});

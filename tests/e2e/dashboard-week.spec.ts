/**
 * OpenSIM — the dashboard's classes widget shows the WHOLE week.
 *
 * The dashboard's left column used to hold only TODAY's classes: for a
 * student with an active enrolment it measured 238px against a 599px
 * right column, so ~360px of the page was empty (visual QA finding
 * Q3). The widget now lists the student's whole week and marks today,
 * so both columns carry a similar amount of information.
 *
 * The spec signs in as `12345678`, the catalogue student, because the
 * placeholder student the shared setup uses owns no `student_progress`
 * rows and therefore has no week to show. The credential comes from
 * the same `.env` the rest of the suite reads, and `just test-e2e`
 * provisions it (`db-set-password-alumno`).
 *
 * The "today" letter comes from the app's own helper
 * (`src/lib/utils/time`), so the spec does not carry a second copy of
 * the calendar rule.
 */
import { existsSync } from "node:fs";

import { expect, type Locator, type Page, test } from "@playwright/test";

import { getTodayDayLetter } from "../../src/lib/utils/time";

if (process.env.OPENSIM_TEST_PASSWORD === undefined && existsSync(".env")) {
	process.loadEnvFile();
}

const CONTROL_NUMBER = "12345678";
const PASSWORD = process.env.OPENSIM_TEST_PASSWORD ?? "opensim-dev-2026";

/** The day letters the TecNM grid uses, in the order the week runs. */
const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

/** The full name of each letter — what a screen reader hears. */
const DAY_NAME: Record<string, string> = {
	L: "Lunes",
	M: "Martes",
	X: "Miércoles",
	J: "Jueves",
	V: "Viernes",
	S: "Sábado",
	D: "Domingo",
};

/** The week widget. */
function widget(page: Page): Locator {
	return page.locator("section.week");
}

/** One row per class block of the week. */
function rows(page: Page): Locator {
	return widget(page).locator(".week__item");
}

/** The day letter of every row, in the order the rows are rendered. */
async function rowDays(page: Page): Promise<string[]> {
	return (await rows(page).locator(".week__day-letter").allTextContents()).map((d) => d.trim());
}

async function signIn(page: Page): Promise<void> {
	await page.goto("/login");
	await page.fill('input[name="controlNumber"]', CONTROL_NUMBER);
	await page.fill('input[name="password"]', PASSWORD);
	await Promise.all([
		page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
		page.click('button[type="submit"]'),
	]);
}

test.describe("dashboard — the classes widget shows the whole week", () => {
	// No shared session: this spec signs in as the student with a week.
	test.use({ storageState: { cookies: [], origins: [] } });

	test("the widget lists every block of the week, not only today's", async ({ page }) => {
		await signIn(page);
		await page.goto("/dashboard");

		await expect(widget(page)).toBeVisible();

		const count = await rows(page).count();
		expect(count, "the week must list more than one block").toBeGreaterThan(1);

		// The header count and the rendered rows must agree.
		const declared = (await widget(page).locator(".week__count").innerText()).replace(/\s+/g, " ");
		expect(declared.trim()).toBe(`${count} ${count === 1 ? "bloque" : "bloques"}`);

		// The assertion the old "today only" widget could not pass: a
		// class on a day other than today is rendered.
		const days = await rowDays(page);
		expect(new Set(days).size, "the week must show more than one day").toBeGreaterThan(1);
		expect(
			days.some((day) => day !== getTodayDayLetter()),
			"the week must show classes that are not today's",
		).toBe(true);
	});

	test("today's rows carry the 'hoy' badge and no other row does", async ({ page }) => {
		await signIn(page);
		await page.goto("/dashboard");

		const today = getTodayDayLetter();
		const days = await rowDays(page);
		const todayRows = days.filter((day) => day === today).length;

		// The badge marks today's rows, so the badge count is the number
		// of today's rows (and only those).
		const badged = await rows(page)
			.filter({ has: page.getByText("hoy", { exact: true }) })
			.count();
		expect(badged, "only today's rows carry the badge").toBe(todayRows);

		const labels = await widget(page).locator(".badge").allInnerTexts();
		for (const label of labels) {
			expect(label.trim()).toBe("hoy");
		}
	});

	test("the rows come in day order and name the day", async ({ page }) => {
		await signIn(page);
		await page.goto("/dashboard");

		const days = await rowDays(page);
		const order = days.map((day) => DAY_LETTERS.indexOf(day));
		expect(order, "the rows must come in day order").toEqual([...order].sort((a, b) => a - b));

		// The day is in the accessibility tree, not only in the chip's
		// letter: the chip carries the full name next to the letter.
		const chip = widget(page).locator(".week__day").first();
		await expect(chip).toContainText(DAY_NAME[days[0]]);
	});
});

test.describe("dashboard — the classes widget with no week to show", () => {
	// The shared session is the placeholder student: no enrolment, no
	// blocks, so the widget says so instead of inventing classes.
	test.use({ storageState: "playwright/.auth/storage.json" });

	test("an empty week says so", async ({ page }) => {
		await page.goto("/dashboard");

		await expect(widget(page).getByText("Sin clases esta semana")).toBeVisible();
		await expect(
			widget(page).getByText("No tienes clases programadas en el periodo actual."),
		).toBeVisible();
	});
});

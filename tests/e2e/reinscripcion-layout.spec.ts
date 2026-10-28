/**
 * OpenSIM — /reinscripcion layout acceptance (S3).
 *
 * The simulator used to hand the whole page of ~50 groups to the
 * document: the offer list (~3400px) and the 07:00-22:00 grid (900px)
 * each stretched the page, so reading the simulator meant scrolling
 * several screens. The fix keeps every row and every hour and bounds the
 * two tall blocks instead:
 *
 *   S3.1  the offer list is a scroll box of its own — it is traversed
 *         inside its column instead of pushing the document down;
 *   S3.2  the "Carga actual" grid is bounded in height and scrolls
 *         internally (nothing is folded away, no hour is dropped);
 *   S3.3  at 1440x900 the document is at most ~2x the viewport height;
 *   S3.4  the client-side selection survives the internal scroll;
 *   S3.5  the filter panel stays reachable (sticky) next to the list.
 *
 * Read-only on purpose: nothing here enrolls, so the local D1 keeps the
 * state the next run expects.
 */
import { expect, type Locator, test } from "@playwright/test";

const VIEWPORT = { width: 1440, height: 900 } as const;

test.use({ storageState: "playwright/.auth/storage.json", viewport: VIEWPORT });

interface ScrollMetrics {
	overflowY: string;
	clientHeight: number;
	scrollHeight: number;
}

async function scrollMetrics(locator: Locator): Promise<ScrollMetrics> {
	return locator.evaluate((el) => ({
		overflowY: getComputedStyle(el).overflowY,
		clientHeight: el.clientHeight,
		scrollHeight: el.scrollHeight,
	}));
}

test("the filter panel stays reachable while the page scrolls", async ({ page }) => {
	await page.goto("/reinscripcion");

	const filter = page.getByTestId("filter-panel");
	await expect(filter).toBeVisible();
	await expect(filter).toHaveCSS("position", "sticky");
});

test("the offer list scrolls inside its own column", async ({ page }) => {
	await page.goto("/reinscripcion");

	// The offer region still states the period on the line the agentic
	// runner reads — this spec must not move it.
	await expect(page.getByText(/^Periodo:/)).toBeVisible();

	const list = page.getByTestId("offer-list");
	await expect(list).toBeVisible();

	const metrics = await scrollMetrics(list);
	expect(["auto", "scroll"], "the offer list must be a scroll box").toContain(metrics.overflowY);
	expect(
		metrics.scrollHeight,
		"the offer list must overflow its own box and scroll inside it",
	).toBeGreaterThan(metrics.clientHeight);
	expect(
		metrics.clientHeight,
		"the offer list must stay inside one viewport height",
	).toBeLessThanOrEqual(VIEWPORT.height);
});

test("the Carga actual grid is bounded in height and scrolls internally", async ({ page }) => {
	await page.goto("/reinscripcion");

	const grid = page.getByTestId("schedule-grid");
	await expect(grid).toBeVisible();

	const metrics = await scrollMetrics(grid);
	expect(["auto", "scroll"], "the schedule grid must be a scroll box").toContain(metrics.overflowY);
	expect(
		metrics.scrollHeight,
		"the 07:00-22:00 grid must keep every hour and scroll inside its box",
	).toBeGreaterThan(metrics.clientHeight);
	expect(
		metrics.clientHeight,
		"the schedule grid must stay inside one viewport height",
	).toBeLessThanOrEqual(VIEWPORT.height);
});

test("the document height stays within ~2 viewports at 1440x900", async ({ page }) => {
	await page.goto("/reinscripcion");

	const metrics = await page.evaluate(() => ({
		scrollHeight: document.documentElement.scrollHeight,
		innerHeight: window.innerHeight,
	}));

	expect(
		metrics.scrollHeight,
		`document height ${metrics.scrollHeight}px exceeds ~2x the viewport (${metrics.innerHeight}px)`,
	).toBeLessThanOrEqual(metrics.innerHeight * 2);
});

test("the selection survives the internal scroll of the offer list", async ({ page }) => {
	await page.goto("/reinscripcion");
	// The checkbox only reacts once the page is hydrated: a click that
	// lands before that ticks the box without reaching the app's state.
	await page.waitForLoadState("networkidle");

	const list = page.getByTestId("offer-list");
	const first = list.getByRole("checkbox").first();
	await first.check();
	await expect(page.getByTestId("selection-summary")).toContainText("1 grupo");

	// Scroll the list to its end: the ticked row must stay ticked and
	// the credit total must survive the scroll.
	await list.evaluate((el) => {
		el.scrollTop = el.scrollHeight;
	});
	await expect(first).toBeChecked();
	await expect(page.getByTestId("selection-summary")).toContainText("1 grupo");
});

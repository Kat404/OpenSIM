/**
 * OpenSIM — the sidebar navigation animates the content (S4).
 *
 * The animation is browser-side: the page content is its own view
 * transition group and the shell drives `document.startViewTransition`
 * from SvelteKit's `onNavigate`. Two rules have to hold:
 *
 *   1. a navigation from the sidebar runs a view transition, and
 *   2. a student whose OS asks for reduced motion gets none — the
 *      navigation still happens, just without the animation.
 *
 * The spec spies on `document.startViewTransition` before any page
 * script runs, so it counts what the app really asked the browser to
 * do instead of guessing from the pixels.
 */
import { expect, test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/storage.json" });

/** Installed before the app's own scripts: counts the transitions asked for. */
function countViewTransitions() {
	const counter = { calls: 0 };
	(window as unknown as { __vt: typeof counter }).__vt = counter;
	const original = document.startViewTransition?.bind(document);
	if (!original) return;
	document.startViewTransition = ((callback: Parameters<typeof original>[0]) => {
		counter.calls += 1;
		return original(callback);
	}) as typeof document.startViewTransition;
}

async function transitionsAskedFor(page: import("@playwright/test").Page): Promise<number> {
	return page.evaluate(() => (window as unknown as { __vt: { calls: number } }).__vt.calls);
}

test("a navigation from the sidebar animates the content", async ({ page }) => {
	await page.addInitScript(countViewTransitions);
	await page.goto("/dashboard");
	await page.waitForLoadState("networkidle");

	await page.getByRole("link", { name: "Horario" }).click();
	await page.waitForURL("**/horario");

	expect(await transitionsAskedFor(page)).toBeGreaterThan(0);
});

test("with reduced motion the navigation happens without an animation", async ({ page }) => {
	await page.addInitScript(countViewTransitions);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/dashboard");
	await page.waitForLoadState("networkidle");

	await page.getByRole("link", { name: "Horario" }).click();
	await page.waitForURL("**/horario");

	expect(await transitionsAskedFor(page)).toBe(0);
});

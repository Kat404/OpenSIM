/**
 * OpenSIM — axe-core WCAG 2.1 AA scan: `/` (component gallery) and
 * 404 (`+error.svelte`) (Phase 5 Tarea 5.1.3).
 *
 * mcode round-7 N17/N19: the component gallery at `/` is the only
 * route that renders the danger Button + Modal + Dropdown + Skeleton
 * + Tabs + Stepper + Tooltip atoms, so a scan here exercises the
 * variants that the protected route scan misses. The 404/error
 * boundary also needs a sweep so an unstyled SvelteKit fallback
 * can never ship.
 *
 * The `/` route is public; the 404 spec doesn't need auth.
 */
import { test, expect } from '@playwright/test';
import { scanForA11y } from './_helpers';

test('component gallery at / has no serious/critical WCAG 2.1 AA violations', async ({
	page
}, testInfo) => {
	await page.goto('/');
	await scanForA11y(page, testInfo);
});

test('404 error boundary has no serious/critical WCAG 2.1 AA violations', async ({
	page
}, testInfo) => {
	const response = await page.goto('/this-route-does-not-exist-and-never-will');
	// 404 (or 200 if the dev server catches it as a soft route). Either
	// way, +error.svelte should have rendered.
	expect(response?.status() ?? 0).toBeGreaterThanOrEqual(400);
	await scanForA11y(page, testInfo);
});

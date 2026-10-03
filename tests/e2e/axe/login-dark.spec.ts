/**
 * OpenSIM — axe-core WCAG 2.1 AA scan: /login in dark color scheme
 * (Phase 5 Tarea 5.1.3 follow-up).
 *
 * mcode round-7 N16 noted that the previous sweep ran only in light.
 * The chromium-dark project re-runs every spec against a dark
 * colorScheme, but the login page is public and doesn't depend on
 * the auth setup, so it gets a dedicated spec for visibility in the
 * Playwright HTML report. The other 6 routes inherit the dark sweep
 * via the project.
 */
import { test } from '@playwright/test';
import { scanForA11y } from './_helpers';

test('login page in dark theme has no serious/critical WCAG 2.1 AA violations', async ({
	page
}, testInfo) => {
	await page.goto('/login');
	await scanForA11y(page, testInfo);
});

/**
 * OpenSIM — axe-core WCAG 2.1 AA scan: /reticula (Phase 5 Tarea 5.1.3).
 *
 * Two scans: the bare route and the Cmd+K deep-link variant
 * (URL hash), since the round-6 audit (M6) flagged the deep-link
 * path as a separate flow. Both should pass.
 */
import { test } from '@playwright/test';
import { scanForA11y } from './_helpers';

test.use({ storageState: 'playwright/.auth/storage.json' });

test('reticula base route has no serious/critical WCAG 2.1 AA violations', async ({ page }, testInfo) => {
	await page.goto('/reticula');
	await scanForA11y(page, testInfo);
});

test('reticula with deep-link hash has no serious/critical WCAG 2.1 AA violations', async ({
	page
}, testInfo) => {
	// canonicalId for Cálculo Diferencial per the curriculum fixture.
	await page.goto('/reticula#calculo-diferencial');
	await page.waitForTimeout(250); // let the DAG's hover/focus settle on the target
	await scanForA11y(page, testInfo);
});

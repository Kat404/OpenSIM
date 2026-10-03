/**
 * OpenSIM — axe-core scan helper (Phase 5 Tarea 5.1.3).
 *
 * Runs a WCAG 2.1 AA scan on the current page using
 * `@axe-core/playwright`. Fails the test when any `serious` or
 * `critical` violation is present. `moderate` and `minor` are logged
 * but do not fail the test (per the audit policy: blocking severities
 * only — moderate/minor are follow-ups documented in the audit).
 *
 * Reused by every per-route spec to keep the threshold and tag set
 * in one place. If we ever need to expand the ruleset (e.g. best
 * practices, experimental), this is the only file to touch.
 *
 * Each run also writes the consolidated findings to
 * `tests/e2e/reports/axe-findings.json` (audit N15, Round 7): the
 * per-test `testInfo.attach` only persists inside Playwright's own
 * blob store, not in the working tree, so a follow-up audit
 * couldn't read the moderate/minor findings without re-running.
 */
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'] as const;
const FAILING_IMPACTS = new Set(['serious', 'critical']);

const FINDINGS_PATH = 'tests/e2e/reports/axe-findings.json';

interface PersistedFinding {
	testTitle: string;
	url: string;
	timestamp: string;
	violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'];
}

export interface AxeScanResult {
	url: string;
	violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'];
}

export async function scanForA11y(page: Page, testInfo: TestInfo): Promise<AxeScanResult> {
	// `chromium-data-theme-dark` exercises the `[data-theme='dark']`
	// path (audit R8-4 / R9 NUEVO-1). Inject the attribute synchronously
	// before navigation so it lands before tokens.css paints, then reload
	// to re-run the document so axe observes the themed DOM.
	if (testInfo.project.name === 'chromium-data-theme-dark') {
		await page.addInitScript(() => {
			document.documentElement.setAttribute('data-theme', 'dark');
		});
		await page.reload();
	}

	// Wait for SvelteKit hydration so JS-applied attributes (e.g.
	// `data-theme` from src/lib/utils/theme.svelte.ts:61 and the
	// preload-data attributes from app.html) are present before axe
	// scans. Without this, the dark theme project scans the
	// pre-hydration CSS state — `[data-theme='dark']` never matches
	// even when the project is `chromium-data-theme-dark`, and the
	// OS-colorScheme path is dead code on 5 of 8 routes (audit R9
	// NUEVO-1).
	//
	// The preload attributes are on `<body>` (per app.html L37:
	// `<body data-sveltekit-preload-data="hover">`), not `<html>`, so
	// we probe the body. The 200 ms fallback covers pages where the
	// preload-data attribute never lands.
	await page
		.waitForFunction(
			() =>
				document.body.hasAttribute('data-sveltekit-preload-code') ||
				document.body.hasAttribute('data-sveltekit-preload-data'),
			{ timeout: 5_000 }
		)
		.catch(() => {
			/* preload attributes absent — rely on the timeout fallback below */
		});
	await page.waitForTimeout(200);

	const results = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();

	await testInfo.attach('axe-report.json', {
		body: JSON.stringify(results, null, 2),
		contentType: 'application/json'
	});

	const blocking = results.violations.filter((v) => v.impact && FAILING_IMPACTS.has(v.impact));
	const nonBlocking = results.violations.filter((v) => !v.impact || !FAILING_IMPACTS.has(v.impact));

	if (nonBlocking.length > 0) {
		// eslint-disable-next-line no-console
		console.warn(
			`[axe] ${nonBlocking.length} non-blocking finding(s) at ${page.url()}:`,
			nonBlocking.map((v) => `${v.id} (${v.impact ?? 'unknown'})`)
		);
	}

	// Persist the full findings (blocking + non-blocking) so a future
	// audit can review the moderate/minor backlog without rerunning.
	const existing: PersistedFinding[] = existsSync(FINDINGS_PATH)
		? (JSON.parse(readFileSync(FINDINGS_PATH, 'utf-8')) as PersistedFinding[])
		: [];
	existing.push({
		testTitle: testInfo.title,
		url: page.url(),
		timestamp: new Date().toISOString(),
		violations: results.violations
	});
	writeFileSync(join(process.cwd(), FINDINGS_PATH), JSON.stringify(existing, null, 2));

	expect(
		blocking,
		`Found ${blocking.length} serious/critical WCAG 2.1 AA violation(s) at ${page.url()}. ` +
			'See test attachment axe-report.json for the full report.'
	).toEqual([]);

	return { url: page.url(), violations: results.violations };
}

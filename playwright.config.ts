/**
 * OpenSIM — Playwright + axe-core audit configuration (Phase 5 Tarea 5.1).
 *
 * Deliberately uses the system Chromium at `/usr/bin/chromium` instead
 * of Playwright's bundled browser. The host already has Chromium
 * 153.x installed; downloading Playwright's patched build would be
 * ~150 MB of duplicated disk for no test benefit (axe-core only needs
 * a standards-compliant browser, not Playwright's patches).
 *
 * To regenerate the browser binary on a fresh host, run:
 *   pnpm exec playwright install chromium
 * (skipped here via the system-Chromium shortcut; see Tarea 5.1.1).
 *
 * The dev server is auto-managed via `webServer` — Playwright spawns
 * `pnpm dev` for the suite and tears it down at the end. The
 * `reuseExistingServer: !process.env.CI` line keeps iterative dev
 * fast: if a dev server is already on :5173 the test reuses it.
 *
 * D1 is a local Miniflare binding driven by wrangler; tests assume
 * `just db-reset && just db-set-password` ran beforehand. The
 * `just test-e2e` recipe wires that up.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	workers: 1, // D1 local is single-writer; serial avoids flake
	retries: 0,
	reporter: [
		['list'],
		['json', { outputFile: 'tests/e2e/reports/results.json' }],
		['html', { outputFolder: 'tests/e2e/reports/html', open: 'never' }]
	],
	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
		headless: true,
		launchOptions: {
			// System Chromium — no Playwright bundled browser.
			executablePath: '/usr/bin/chromium',
			args: ['--no-sandbox', '--disable-dev-shm-usage']
		}
	},
	projects: [
		{
			name: 'setup',
			testMatch: /.*\.setup\.ts/,
			use: {
				launchOptions: {
					executablePath: '/usr/bin/chromium',
					args: ['--no-sandbox', '--disable-dev-shm-usage']
				}
			}
		},
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['setup']
		}
	],
	webServer: {
		command: 'pnpm dev',
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		stdout: 'pipe',
		stderr: 'pipe'
	}
});

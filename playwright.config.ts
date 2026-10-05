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
 * fast on the developer machine: if a dev server is already on
 * :5173 the test reuses it. There is no cloud-CI consumer setting
 * `CI=true` anymore — the only consumer is local Podman via
 * `just ci-shell` (interactive debugging), which sets `CI=true`
 * for the e2e spec's retry behaviour, not the webServer block.
 *
 * D1 is a local Miniflare binding driven by wrangler; tests assume
 * `just db-reset && just db-set-password` ran beforehand. The
 * `just test-e2e` recipe wires that up locally. NOTE: `just ci`
 * (the pre-push container gate) does NOT run this e2e suite — it
 * runs `just qa-fast` (check + biome-check + test). For axe-core
 * e2e coverage, run `just test-e2e` on the host.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	workers: 1, // D1 local is single-writer; serial avoids flake
	// CI gets one retry to absorb transient network/timing flake; local
	// dev is single-shot for fast feedback. `trace: 'retain-on-failure'`
	// (Task 5 fix) records the trace on every failure, not only on the
	// retry — the previous `on-first-retry` was contradictory with
	// `retries: 0` and never produced traces.
	retries: process.env.CI ? 1 : 0,
	reporter: [
		["list"],
		["json", { outputFile: "tests/e2e/reports/results.json" }],
		["html", { outputFolder: "tests/e2e/reports/html", open: "never" }],
	],
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
		headless: true,
		launchOptions: {
			// System Chromium — no Playwright bundled browser.
			executablePath: "/usr/bin/chromium",
			args: ["--no-sandbox", "--disable-dev-shm-usage"],
		},
	},
	projects: [
		{
			name: "setup",
			testMatch: /.*\.setup\.ts/,
			use: {
				launchOptions: {
					executablePath: "/usr/bin/chromium",
					args: ["--no-sandbox", "--disable-dev-shm-usage"],
				},
			},
		},
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				colorScheme: "light",
			},
			dependencies: ["setup"],
		},
		{
			// mcode round-7 N16: the previous sweep only ran in light.
			// Dark mode inverts the brand scale (--brand-700 becomes
			// #67e8f9 in dark) and the previous "10/10 verde" was
			// lucky. Re-run every spec against a dark color scheme to
			// catch the cases that only fail in dark.
			name: "chromium-dark",
			use: {
				...devices["Desktop Chrome"],
				colorScheme: "dark",
			},
			dependencies: ["setup"],
		},
		{
			// Audit R8-4 + R9 NUEVO-1: `chromium-dark` only sets the
			// OS colorScheme — `[data-theme='dark']` (the path the
			// toggle button actually takes) is structurally unreachable
			// in tests. This project exercises that path by injecting
			// `data-theme="dark"` synchronously before any module runs,
			// on top of a LIGHT OS so the script alone sets the theme.
			// Without it, every token added only to the
			// `[data-theme='dark']` block is invisible to CI.
			name: "chromium-data-theme-dark",
			use: {
				...devices["Desktop Chrome"],
				colorScheme: "light",
			},
			dependencies: ["setup"],
		},
	],
	webServer: {
		command: "pnpm dev",
		url: BASE_URL,
		// Dev-machine UX: if a dev server is already on :5173, reuse
		// it. `just test-e2e` is the only path that spawns a fresh
		// webServer every run and tears it down — the `just ci`
		// pre-push container gate does NOT run e2e. No consumer sets
		// CI=true to get a fresh start anymore, but the flag stays
		// for cross-environment robustness (e.g. CI runners in the
		// future that may opt in).
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
	},
});

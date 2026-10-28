import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
	fmt: {
		// The repo's house style, carried over from biome.json verbatim:
		// tabs, two-space tab stops, 100 columns, double quotes, semicolons
		// and trailing commas everywhere.
		useTabs: true,
		tabWidth: 2,
		printWidth: 100,
		singleQuote: false,
		semi: true,
		trailingComma: "all",
		// Biome's `assist.source.organizeImports` had one job: keep the
		// imports in order. Oxfmt does the same thing with its own
		// algorithm, so the discipline survives the migration.
		sortImports: true,
		// biome never sorted the manifest; keep the key order the
		// maintainer chose.
		sortPackageJson: false,
		// What the formatter must NOT touch:
		//  - markdown: the prose and the tables are hand-written (biome
		//    never formatted markdown, and oxfmt's table re-padding would
		//    fight every manual edit)
		//  - drizzle/meta/**: drizzle-kit generates the snapshots
		//  - docs/data/**: the captured SIM data, vendored as it arrived
		//  - src/lib/server/db/data/**: the seed's INPUT; its bytes feed
		//    the generated seed.sql, so reformatting it would move the
		//    generated file away from its generator
		//  - skills-lock.json, ruff.toml: generated / owned by other tools
		ignorePatterns: [
			"**/*.md",
			"drizzle/meta/**",
			"docs/data/**",
			"src/lib/server/db/data/**",
			"skills-lock.json",
			"ruff.toml",
		],
	},
	lint: {
		jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
		rules: { "vite-plus/prefer-vite-plus-imports": "error" },
		// The same files the formatter leaves alone: the vendored data,
		// the generated drizzle snapshots and the test reports. Biome
		// excluded them from the linter too.
		ignorePatterns: [
			"drizzle/meta/**",
			"docs/data/**",
			"src/lib/server/db/data/**",
			"playwright-report/**",
			"tests/e2e/reports/**",
			"test-results/**",
		],
		options: {
			// Type-aware RULES: yes. Reporting type ERRORS: no — that is
			// `svelte-check`'s job (it is in the `check` recipe), and
			// oxlint's TypeScript program does not understand Svelte's
			// type exports, so it would report "Module '*.svelte' has no
			// exported member" for code that compiles.
			typeAware: true,
			typeCheck: false,
		},
	},
	plugins: lazyPlugins(async () => [
		// Exclude the dev-only avatar overlap fixture from production
		// bundles. `src/routes/.dev/avatars/` exists for the AC6-AC11
		// Playwright suite (just test-e2e-avatar) but should not ship
		// to users. The `+page.server.ts` returns 404 in non-dev
		// regardless, but a leaked compiled node IS still in the
		// production manifest and chunks; this plugin strips the
		// route entry from SvelteKit's generated client/server app
		// bundles in build mode (dev mode is left untouched, so the
		// route remains reachable for `pnpm dev` + Playwright).
		// (Phase 7 F2 v2 — Gemini R20 caught the fixture leak.
		// SvelteKit's `kit.files.routes` filter would also work but
		// requires a svelte.config.js which the repo doesn't have,
		// and applies to dev too. The transform hook is scoped to
		// `.svelte-kit/generated/build/` so dev is untouched.)
		{
			name: "exclude-dev-fixtures",
			enforce: "pre",
			transform(code: string, id: string) {
				// Build path is .svelte-kit/generated/build/; dev is
				// .svelte-kit/generated/dev/. The transform only fires
				// on build files, leaving the dev server alone.
				if (!id.includes(".svelte-kit/generated/build/")) return;
				// Match the dictionary entry for /.dev/avatars.
				// Format: "/.dev/avatars": [~10],
				const stripped = code.replace(/\s*"\/\.dev\/avatars":\s*\[[^\]]*\],?/g, "");
				if (stripped !== code) {
					return { code: stripped, map: null };
				}
			},
			// The client node chunks are emitted by SvelteKit to
			// .svelte-kit/output/client/_app/immutable/nodes/*.js and
			// are NOT routed through the transform hook. The transform
			// above strips the route entry from the manifest
			// dictionary, but the compiled page chunk is still on
			// disk (and discoverable by anyone scraping the bundle).
			// `closeBundle` fires after every chunk is written; we
			// walk the output directory and delete any node chunk
			// whose body still references the fixture (a defensive
			// marker; the file names contain content hashes so we
			// can't predict them at config time).
			async closeBundle() {
				const fs = await import("node:fs/promises");
				const path = await import("node:path");
				const outDir = path.resolve(".svelte-kit/output/client/_app/immutable/nodes");
				const entries = await fs.readdir(outDir).catch(() => [] as string[]);
				for (const entry of entries) {
					if (!entry.endsWith(".js")) continue;
					const full = path.join(outDir, entry);
					const body = await fs.readFile(full, "utf8");
					// The fixture's compiled output contains the
					// class name "fixture" (from the page's
					// `.fixture` CSS class) AND the testid
					// "avatar-fixture-root". Either marker is
					// unique to this route in the project.
					if (body.includes("avatar-fixture-root") || body.includes("Avatar fixture")) {
						await fs.unlink(full);
					}
				}
			},
		},
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
			},
			adapter: adapter(),
			// CSP — SvelteKit 3 native. kit.csp.mode: 'nonce' generates a
			// fresh per-request nonce, emits it in the inline scripts that
			// ship with the document, and adds `script-src 'self'
			// 'nonce-...'` to the response header automatically. Zero
			// SHA-256 hashes to maintain; immune to formatter reformat.
			// (Phase 7 F1 v2 — replaces the manual hash middleware in
			// src/hooks.server.ts that the Gemini R20 audit caught stale.)
			csp: {
				mode: "nonce",
				directives: {
					"script-src": ["self"],
					// Svelte 5 injects inline <style data-sveltekit> blocks
					// during hydration; 'unsafe-inline' is required here.
					"style-src": ["self", "unsafe-inline"],
				},
			},
		}),
	]),
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: "./vite.config.ts",
				test: {
					name: "server",
					environment: "node",
					include: ["src/**/*.{test,spec}.{js,ts}", "tests/unit/**/*.{test,spec}.{js,ts}"],
					exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
				},
			},
		],
	},
});

import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
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
	],
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

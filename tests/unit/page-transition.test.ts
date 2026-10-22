/**
 * OpenSIM — page transition unit tests (feature S4).
 *
 * The animation itself lives in the browser: CSS `::view-transition-*`
 * pseudo-elements driven by `document.startViewTransition`. There is no
 * unit-level seam for "does the content fade in", so what IS unit-tested
 * is the decision that gates the animation — the pure function that
 * decides whether a given navigation is animated at all.
 *
 * Contracts under test:
 *   1. View Transition API available + motion allowed  -> animate.
 *   2. Browser without the View Transition API          -> skip (the
 *      navigation still happens, just without animation).
 *   3. The OS asks for reduced motion                   -> skip (no
 *      animation under `prefers-reduced-motion: reduce`).
 *   4. Both at once                                     -> skip.
 *
 * The wiring that the browser cannot be asked about in a unit test
 * (the sidebar navigation reaching the transition, and the reduced-motion
 * token reaching the CSS duration) is pinned by the structural checks at
 * the bottom of this file.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveTransitionMode } from "../../src/lib/components/layout/page-transition";

const read = (relative: string): string =>
	readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

describe("resolveTransitionMode", () => {
	it("animates when the View Transition API exists and motion is allowed", () => {
		expect(resolveTransitionMode({ supportsViewTransition: true, reducedMotion: false })).toBe(
			"animate",
		);
	});

	it("skips the animation when the browser has no View Transition API", () => {
		expect(resolveTransitionMode({ supportsViewTransition: false, reducedMotion: false })).toBe(
			"skip",
		);
	});

	it("skips the animation when the user asked for reduced motion", () => {
		expect(resolveTransitionMode({ supportsViewTransition: true, reducedMotion: true })).toBe(
			"skip",
		);
	});

	it("skips the animation when reduced motion is asked for and the API is missing", () => {
		expect(resolveTransitionMode({ supportsViewTransition: false, reducedMotion: true })).toBe(
			"skip",
		);
	});
});

describe("page transition wiring", () => {
	it("wraps the protected page content in the transition component", () => {
		const shell = read("../../src/lib/components/layout/LayoutShell.svelte");
		expect(shell).toContain("<PageTransition");
		expect(shell).toContain("</PageTransition>");
	});

	it("names the content region so it animates as its own transition group", () => {
		const transition = read("../../src/lib/components/layout/PageTransition.svelte");
		expect(transition).toContain("view-transition-name: page-content");
	});

	it("drives the content animation from the motion token, not a hard-coded duration", () => {
		const tokens = read("../../src/lib/styles/tokens.css");
		expect(tokens).toContain("::view-transition-old(page-content)");
		expect(tokens).toContain("::view-transition-new(page-content)");
		expect(tokens).toMatch(
			/::view-transition-old\(page-content\)\s*\{[^}]*var\(--motion-duration-base\)/,
		);
	});
});

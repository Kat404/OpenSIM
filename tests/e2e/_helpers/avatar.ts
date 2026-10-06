/**
 * OpenSIM — Avatar overlap test helpers (Phase 6.1, U3 acceptance criteria
 * AC6–AC11). Geometry + color + WCAG contrast primitives used by
 * `tests/e2e/avatar-overlap.spec.ts`.
 *
 * These helpers are zero-dependency (only `@playwright/test` types) so the
 * suite stays runnable without extra Playwright extensions. Each helper
 * isolates one specific concern so the test bodies read as plain English
 * assertions, not Playwright boilerplate.
 *
 *  - `getDotBox`         : positions + dimensions of the .avatar__status
 *                          dot AND the parent .avatar-frame (AC6/AC7).
 *  - `getRgbFromVar`     : resolves a CSS custom property (e.g.
 *                          `--avatar-ring`, `--success-700`) to a numeric
 *                          [r, g, b] triple. Accepts an optional scope
 *                          locator because `--avatar-ring` is declared on
 *                          .avatar-frame, not on :root (Avatar.svelte:72).
 *  - `getRgbFromComputed`: reads a single computed style color
 *                          (`backgroundColor`).
 *  - `getBoxShadowRaw`   : returns the literal `box-shadow` string for
 *                          parsing. AC9 asserts the resolved ring color
 *                          appears as a substring.
 *  - `parseRgbString`    : `rgb(r, g, b)` and `rgba(r, g, b, a)` (alpha
 *                          ignored) → numeric triple.
 *  - `contrast`          : WCAG 2.1 relative luminance contrast ratio.
 *  - `probeElementFromPoint`: document.elementFromPoint at (x, y) for
 *                          the AC8 hit-test.
 *  - `getRingColor`      : convenience wrapper for the `--avatar-ring`
 *                          scoped lookup used by AC9 and AC10.
 */

import type { Locator, Page } from "@playwright/test";

export type Rgb = [number, number, number];

export interface DotBox {
	x: number;
	y: number;
	width: number;
	height: number;
	right: number;
	bottom: number;
}

export interface AvatarOverlapBoxes {
	dotBox: DotBox;
	avatarBox: { right: number; bottom: number };
}

/**
 * Returns the dot's box and the avatar frame's right/bottom edges. The
 * frame is the locator the caller already has (e.g. `getByTestId(...)`);
 * we evaluate a small `getBoundingClientRect` snippet so the call is one
 * round-trip instead of two `boundingBox()` awaits.
 *
 * The dot extends 50% of its own size past the avatar's lower-right
 * corner (the `transform: translate(50%, 50%)` paints it on the diagonal
 * overlap). For the largest avatar (xl, 80×80 with a 20×20 dot) the
 * dot's CENTER sits exactly at the avatar's lower-right corner, so a
 * raw `frame.scrollIntoViewIfNeeded()` leaves the dot's centre — and
 * therefore the AC8 probe point — at the viewport edge where
 * `elementFromPoint` returns null. We scroll the dot itself into view
 * instead, which guarantees the entire dot (and its centre) is fully
 * inside the viewport.
 */
export async function getDotBox(avatar: Locator): Promise<AvatarOverlapBoxes> {
	const dot = avatar.locator(".avatar__status");
	await dot.scrollIntoViewIfNeeded();
	return avatar.evaluate((frame) => {
		const frameRect = frame.getBoundingClientRect();
		const dotEl = frame.querySelector<HTMLElement>(".avatar__status");
		if (!dotEl) throw new Error("Avatar frame has no .avatar__status child");
		const dotRect = dotEl.getBoundingClientRect();
		return {
			dotBox: {
				x: dotRect.x,
				y: dotRect.y,
				width: dotRect.width,
				height: dotRect.height,
				right: dotRect.right,
				bottom: dotRect.bottom,
			},
			avatarBox: {
				right: frameRect.right,
				bottom: frameRect.bottom,
			},
		};
	});
}

/**
 * Resolves a CSS custom property to [r, g, b]. The returned string is
 * the raw, UNNORMALISED value as declared in the source — Chrome does
 * NOT canonicalise custom-property declarations, so a token declared
 * `--surface-0: #ffffff` resolves to the literal string `#ffffff`, not
 * `rgb(255, 255, 255)`. `parseRgbString` accepts both forms (and 3-digit
 * hex) and does the normalisation; see its docblock for the accepted
 * shapes.
 *
 * When `scope` is provided, the variable is read on that element so
 * cascaded custom properties (e.g. `--avatar-ring` declared on
 * .avatar-frame per Avatar.svelte:72) are observable. Without scope we
 * read from `documentElement` which catches `:root` declarations.
 */
export async function getRgbFromVar(
	page: Page,
	varName: `--${string}`,
	scope?: Locator,
): Promise<Rgb> {
	const raw = await (scope
		? scope.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), varName)
		: page.evaluate(
				(name) => getComputedStyle(document.documentElement).getPropertyValue(name),
				varName,
			));

	const value = raw.trim();
	if (!value) {
		throw new Error(
			`CSS var ${varName} resolved to empty (scope=${scope ? "locator" : "documentElement"})`,
		);
	}
	return parseRgbString(value);
}

/**
 * Reads a computed style color property and returns [r, g, b]. The
 * caller passes a CSS property name in its hyphenated form (the form
 * `getPropertyValue` accepts); the only property the overlap suite
 * needs is `background-color` for the dot's fill.
 */
export async function getRgbFromComputed(
	page: Page,
	selector: string,
	prop: "background-color",
): Promise<Rgb> {
	const raw = await page
		.locator(selector)
		.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
	const value = raw.trim();
	if (!value) {
		throw new Error(`getComputedStyle(${selector}).${prop} is empty`);
	}
	return parseRgbString(value);
}

/**
 * Returns the raw `box-shadow` string for the matched element. AC9
 * asserts the resolved ring color is a substring; we don't try to
 * parse the offset/spread components here because a substring match is
 * the spec contract and parsing would be brittle (browsers normalise
 * differently across versions).
 */
export async function getBoxShadowRaw(page: Page, selector: string): Promise<string> {
	return page
		.locator(selector)
		.evaluate((el) => getComputedStyle(el).getPropertyValue("box-shadow"));
}

/**
 * Parses a CSS color value to a numeric triple. Supports the three
 * shapes Playwright / Chrome can return via `getComputedStyle`:
 *  - `rgb(r, g, b)` and `rgba(r, g, b, a)` (alpha dropped)
 *  - 3- and 6-digit hex (`#fff`, `#ffffff`, with or without alpha)
 *  - bare hex values produced by `getPropertyValue('--*')` when the
 *    custom property is declared as a literal hex (e.g. `--surface-0:
 *    #ffffff` in tokens.css). The browser does NOT normalise custom
 *    property values — `getComputedStyle(...).getPropertyValue('--x')`
 *    returns the raw string from the source.
 *
 * Throws on unrecognised input — the spec contract depends on a
 * successful parse, so failing loud is correct.
 */
export function parseRgbString(s: string): Rgb {
	const trimmed = s.trim();

	// rgb()/rgba() — long form
	const rgb = trimmed.match(
		/^rgba?\(\s*(-?\d+(?:\.\d+)?)\s*,?\s*(-?\d+(?:\.\d+)?)\s*,?\s*(-?\d+(?:\.\d+)?)/i,
	);
	if (rgb) {
		return [roundByte(rgb[1] ?? "0"), roundByte(rgb[2] ?? "0"), roundByte(rgb[3] ?? "0")];
	}

	// 6-digit hex
	const hex6 = trimmed.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i);
	if (hex6) {
		return [
			parseInt(hex6[1] ?? "00", 16),
			parseInt(hex6[2] ?? "00", 16),
			parseInt(hex6[3] ?? "00", 16),
		];
	}

	// 3-digit hex
	const hex3 = trimmed.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
	if (hex3) {
		return [
			parseInt((hex3[1] ?? "0") + (hex3[1] ?? "0"), 16),
			parseInt((hex3[2] ?? "0") + (hex3[2] ?? "0"), 16),
			parseInt((hex3[3] ?? "0") + (hex3[3] ?? "0"), 16),
		];
	}

	throw new Error(`parseRgbString: cannot parse "${s}"`);
}

function roundByte(n: string): number {
	return Math.max(0, Math.min(255, Math.round(Number(n))));
}

/**
 * WCAG 2.1 relative luminance. Inputs are sRGB channel values in
 * [0..255]; the output is the linearised luminance in [0..1].
 */
function relLum(r: number, g: number, b: number): number {
	const f = (c: number) => {
		const cs = c / 255;
		return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * WCAG 2.1 contrast ratio between two colours. The order of arguments
 * does not matter — the ratio is symmetric. Returns a value in [1..21].
 */
export function contrast(fg: Rgb, bg: Rgb): number {
	const l1 = relLum(fg[0], fg[1], fg[2]);
	const l2 = relLum(bg[0], bg[1], bg[2]);
	const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * Returns the element at viewport coordinates (x, y) per
 * `document.elementFromPoint`, or `null` if the probe lands outside the
 * document (e.g. on a scrollbar or outside the viewport). The AC8
 * relaxed assertion accepts either the dot itself or any descendant
 * of the avatar frame because the 2px box-shadow halo is not
 * hit-testable.
 */
export async function probeElementFromPoint(
	page: Page,
	x: number,
	y: number,
): Promise<{ tagName: string; classes: string } | null> {
	return page.evaluate(
		([px, py]) => {
			const el = document.elementFromPoint(px, py);
			if (!el) return null;
			return {
				tagName: el.tagName,
				classes: el.className && typeof el.className === "string" ? el.className : "",
			};
		},
		[x, y] as const,
	);
}

/**
 * Resolves the dot's ring colour (the `--avatar-ring` value as set on
 * the .avatar-frame). This is the colour used by both the AC9 substring
 * check (inside the box-shadow) and the AC10 contrast ratio
 * (ring-as-background vs dot-fill-as-foreground).
 */
export async function getRingColor(page: Page, frame: Locator): Promise<Rgb> {
	return getRgbFromVar(page, "--avatar-ring", frame);
}

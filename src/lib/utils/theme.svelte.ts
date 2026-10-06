/**
 * OpenSIM — Reactive theme tracking.
 *
 * The user-facing theme toggle in `LayoutHeader` writes to
 * `document.documentElement[data-theme]`; this module is the
 * read-side mirror. It holds the current value in a module-level
 * `$state` rune and keeps it in sync with the DOM attribute via a
 * `MutationObserver` so components that import `getTheme()` re-render
 * automatically when the user toggles the theme.
 *
 * During SSR the rune stays at the default `'light'`. The companion
 * inline script in `app.html` sets `data-theme` synchronously from
 * `localStorage` before the first paint (only when a stored override
 * exists — otherwise tokens.css's `@media (prefers-color-scheme)`
 * block owns the first frame; audit N2, Round 6), so on hydration
 * the observer picks up the right value before any component
 * re-renders.
 *
 * When the user has NO stored override we also follow the OS theme
 * at runtime via `matchMedia` (audit N4, Round 6). As soon as the
 * user clicks the toggle we write to `localStorage`, which makes
 * the next OS-change a no-op.
 *
 * See: odd/tasks/opensim.md §7.2; audit M8 (Round 4) + N2/N4 (Round 6).
 */

import type { Theme } from "./color";

const state = $state<{ value: Theme }>({ value: "light" });

// Detect browser without `$app/environment` so this module can be
// imported from `*.svelte` and unit-tested under node. The DOM
// check is sufficient: the rune module is only ever executed on the
// server (SSR) or in the browser, never in pure node tests.
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
	/** The user's explicit choice, or null when they have not chosen. */
	const storedOverride = (): Theme | null => {
		try {
			const v = localStorage.getItem("opensim-theme");
			return v === "dark" ? "dark" : v === "light" ? "light" : null;
		} catch {
			return null; // private mode / storage disabled
		}
	};

	const prefersDark = (): boolean =>
		typeof window !== "undefined" && typeof window.matchMedia === "function"
			? window.matchMedia("(prefers-color-scheme: dark)").matches
			: false;

	/**
	 * Resolve the effective theme from the SAME inputs the DOM does, in
	 * the same precedence: explicit override, then the `data-theme`
	 * attribute, then the OS preference.
	 *
	 * The previous version read only `data-theme` and defaulted to
	 * "light" when it was absent. That made `state.value` a
	 * half-initialised value for the whole window between boot and the
	 * first `data-theme` mutation: `followOs` below sets the attribute,
	 * but the MutationObserver delivers on a microtask, so a caller
	 * could observe "light" while the CSS already painted dark.
	 *
	 * That divergence is observable, not theoretical — components that
	 * pick a colour from `getTheme()` (the schedule blocks, which use
	 * `getSubjectColor`) rendered light-theme backgrounds under dark
	 * tokens, and the axe suite caught the resulting contrast failure
	 * intermittently on the `chromium-dark` project. Reading
	 * `matchMedia` directly closes the race by construction: the rune
	 * is correct on the very first call, without waiting for an
	 * observer callback.
	 */
	const resolve = (): Theme => {
		const attr = document.documentElement.getAttribute("data-theme");
		if (attr === "dark") return "dark";
		if (attr === "light") return "light";
		return storedOverride() ?? (prefersDark() ? "dark" : "light");
	};

	const sync = () => {
		state.value = resolve();
	};
	// Boot: resolve synchronously, before any component reads the rune.
	sync();

	const observer = new MutationObserver(sync);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});

	// OS theme reactivity (audit N4, Round 6). Only mirrors the OS
	// preference to <html data-theme> when the user has NOT stored an
	// explicit choice. The MutationObserver above then propagates the
	// change into the rune.
	if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const followOs = (e: MediaQueryListEvent | MediaQueryList) => {
			if (storedOverride() !== null) return; // user override wins
			document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
			// setAttribute queues the observer callback on a microtask.
			// Apply now so `getTheme()` is never briefly stale.
			sync();
		};
		followOs(mq); // sync on boot in case app.html didn't set the attribute
		mq.addEventListener("change", followOs);
	}
}

/**
 * Returns the current theme. Read this inside a reactive context
 * (`$derived`, template, `$effect`) so the call site re-evaluates
 * when the user toggles the theme.
 */
export function getTheme(): Theme {
	return state.value;
}

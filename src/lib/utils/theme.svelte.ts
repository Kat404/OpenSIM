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
 * During SSR `browser` is false, so the rune stays at the default
 * `'light'`. The companion inline script in `app.html` sets
 * `data-theme` synchronously from `localStorage` before the first
 * paint, so on hydration the observer picks up the user's choice
 * before any component re-renders.
 *
 * See: odd/tasks/opensim.md §7.2; audit M8 (Round 4).
 */

import type { Theme } from './color';

const state = $state<{ value: Theme }>({ value: 'light' });

// Detect browser without `$app/environment` so this module can be
// imported from `*.svelte` and unit-tested under node. The DOM
// check is sufficient: the rune module is only ever executed on the
// server (SSR) or in the browser, never in pure node tests.
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
	const sync = () => {
		const next = document.documentElement.getAttribute('data-theme');
		state.value = next === 'dark' ? 'dark' : 'light';
	};
	sync();
	const observer = new MutationObserver(sync);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme']
	});
}

/**
 * Returns the current theme. Read this inside a reactive context
 * (`$derived`, template, `$effect`) so the call site re-evaluates
 * when the user toggles the theme.
 */
export function getTheme(): Theme {
	return state.value;
}

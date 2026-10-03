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

	// OS theme reactivity (audit N4, Round 6). Only mirrors the OS
	// preference to <html data-theme> when the user has NOT stored an
	// explicit choice. The MutationObserver above then propagates the
	// change into the rune.
	if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const followOs = (e: MediaQueryListEvent | MediaQueryList) => {
			let stored: string | null = null;
			try {
				stored = localStorage.getItem('opensim-theme');
			} catch {
				// localStorage unavailable; fall through and follow the OS.
			}
			if (stored === 'light' || stored === 'dark') return; // user override wins
			document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
		};
		followOs(mq); // sync on boot in case app.html didn't set the attribute
		mq.addEventListener('change', followOs);
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

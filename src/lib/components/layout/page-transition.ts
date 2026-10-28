/**
 * OpenSIM — page transition decisions (feature S4).
 *
 * The animation itself is browser-side: CSS `::view-transition-*`
 * pseudo-elements driven by `document.startViewTransition`. What lives
 * here is the part that can be reasoned about without a DOM — whether a
 * navigation should be animated at all — plus the thin reader that
 * collects the two facts it needs from the browser.
 */

/** What a navigation does with the view transition. */
export type TransitionMode = "animate" | "skip";

export interface TransitionEnvironment {
	/** The browser implements `document.startViewTransition`. */
	supportsViewTransition: boolean;
	/** The operating system asks for reduced motion. */
	reducedMotion: boolean;
}

/**
 * Animate only when the browser can run a view transition AND the user has
 * not asked for reduced motion. Every other combination navigates exactly
 * as before: no animation, no error.
 */
export function resolveTransitionMode(environment: TransitionEnvironment): TransitionMode {
	return environment.supportsViewTransition && !environment.reducedMotion ? "animate" : "skip";
}

/**
 * Reads the two facts `resolveTransitionMode` needs. Called per navigation,
 * so a user who flips the OS reduced-motion setting mid-session is honoured
 * on the very next click.
 */
export function readTransitionEnvironment(): TransitionEnvironment {
	if (typeof document === "undefined" || typeof window === "undefined") {
		return { supportsViewTransition: false, reducedMotion: false };
	}
	return {
		// Older browsers have no View Transition API at all.
		supportsViewTransition: typeof document.startViewTransition === "function",
		reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	};
}

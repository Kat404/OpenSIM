<!--
  OpenSIM — Animated page transition for the protected layout.

  Wraps the page content in its own view-transition group so the content
  fades and rises between routes while the chrome (sidebar + header)
  stays put — the motion belongs to the transition, not to the cards.

  The decision to animate is taken per navigation, so:
    - a browser without the View Transition API navigates as before,
    - a student who asked the OS for reduced motion gets no animation.
  In both cases the navigation still happens; nothing is blocked.
-->
<script lang="ts">
import type { Snippet } from "svelte";
import { onNavigate } from "$app/navigation";
import { readTransitionEnvironment, resolveTransitionMode } from "./page-transition";

interface Props {
	children: Snippet;
}

let { children }: Props = $props();

onNavigate((navigation) => {
	if (resolveTransitionMode(readTransitionEnvironment()) === "skip") return;

	return new Promise<void>((resolve) => {
		document.startViewTransition(() => {
			// Releasing SvelteKit first lets the navigation run; the
			// transition then animates once the DOM is updated.
			resolve();
			// A failed navigation must not leave the transition hanging.
			return navigation.complete.catch(() => {});
		});
	});
});
</script>

<div class="page-transition">
	{@render children()}
</div>

<style>
.page-transition {
	/* Names the content region so it animates as its own transition group,
	   apart from the page chrome. The matching ::view-transition-* rules
	   live in src/lib/styles/tokens.css — those pseudo-elements cannot be
	   scoped to a component. */
	view-transition-name: page-content;
}
</style>

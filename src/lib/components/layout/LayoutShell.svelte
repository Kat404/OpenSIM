<!--
  OpenSIM — Shell for the (protected) route group.

  Composes the sidebar + header + main slot. Builds the Cmd+K palette
  index from the same source data the route loaders already returned
  (subjects + route paths), so the global search has a fixed,
  in-memory list to filter — no D1 traffic per character.

  The sidebar collapses on narrow viewports (< 1024px) and can be
  toggled manually on any viewport. The state lives here so the
  sidebar and a future top-bar hamburger stay in sync.
-->
<script lang="ts">
import type { Snippet } from "svelte";
import CmdKPalette, { type PaletteRoute, type PaletteSubject } from "./CmdKPalette.svelte";
import LayoutHeader from "./LayoutHeader.svelte";
import LayoutSidebar from "./LayoutSidebar.svelte";

interface UserSummary {
	controlNumber: string;
	fullName: string;
}

interface Props {
	user: UserSummary;
	paletteRoutes: PaletteRoute[];
	paletteSubjects: PaletteSubject[];
	children: Snippet;
}

let { user, paletteRoutes, paletteSubjects, children }: Props = $props();

// Default expanded on >= 1024px (audit axe-core, Round 7): when
// collapsed on first paint the sidebar nav links have no visible
// label and the lucide icons are aria-hidden, so screen readers
// (and axe-core) see them as focusable-without-name. Starting
// expanded means the SSR/initial-hydration state is correct for
// the common case; the matchMedia callback collapses on narrow
// viewports, and the sidebar itself adds aria-label on its links
// when collapsed so the focusable-name is preserved.
let collapsed = $state(false);
let paletteOpen = $state(false);

$effect(() => {
	if (typeof window === "undefined") return;
	const mql = window.matchMedia("(min-width: 1024px)");
	collapsed = !mql.matches;
	const onChange = (e: MediaQueryListEvent) => {
		collapsed = !e.matches;
	};
	mql.addEventListener("change", onChange);
	return () => mql.removeEventListener("change", onChange);
});

function toggleSidebar() {
	collapsed = !collapsed;
}
</script>

<div class="shell">
	<LayoutSidebar {collapsed} onToggle={toggleSidebar} />

	<div class="shell__body">
		<LayoutHeader {user} onOpenPalette={() => (paletteOpen = true)} />
		<main class="shell__main" id="main">
			{@render children()}
		</main>
	</div>

	<CmdKPalette
		bind:open={paletteOpen}
		onClose={() => (paletteOpen = false)}
		routes={paletteRoutes}
		subjects={paletteSubjects}
	/>
</div>

<style>
.shell {
	display: flex;
	min-height: 100dvh;
	background-color: var(--surface-0);
	font-family: var(--font-sans);
	color: var(--fg-secondary);
}

.shell__body {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.shell__main {
	flex: 1;
	padding: var(--space-6) var(--space-5);
	max-width: 1280px;
	width: 100%;
	margin: 0 auto;
}

@media (max-width: 720px) {
	.shell__main {
		padding: var(--space-4) var(--space-3);
	}
}
</style>

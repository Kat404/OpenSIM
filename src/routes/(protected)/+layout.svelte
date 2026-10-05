<!--
  OpenSIM — (protected) layout host.

  The auth gate itself lives in `+layout.server.ts` (it throws a 303
  redirect to /login when `locals.user` is null). Here we render the
  full chrome introduced in Phase 3 Tarea 3.1: sidebar + header +
  Cmd+K palette. The palette index is built from the protected nav
  routes plus the curriculum subjects catalog so the search modal can
  stay entirely client-side.

  Pages that need additional server data (e.g. /dashboard, /horario,
  /reticula, /academico/kardex) keep their own `+page.server.ts` —
  this layout never carries more than the session-trimmed user.
-->
<script lang="ts">
import type { PaletteRoute } from "#lib/components/layout/CmdKPalette.svelte";
import LayoutShell from "#lib/components/layout/LayoutShell.svelte";
import type { LayoutData } from "./$types";

let { data, children }: { data: LayoutData; children: import("svelte").Snippet } = $props();

const paletteRoutes: PaletteRoute[] = [
	{ label: "Panel", href: "/dashboard", group: "Navegación" },
	{ label: "Horario", href: "/horario", group: "Navegación" },
	{ label: "Retícula", href: "/reticula", group: "Navegación" },
	{ label: "Kardex", href: "/academico/kardex", group: "Navegación" },
];
</script>

{#if data.user}
	{@const subjects = (data.paletteSubjects ?? []).map((s) => ({
		label: `${s.code} — ${s.name}`,
		canonicalId: s.canonicalId,
		group: "Asignatura",
	}))}
	<LayoutShell
		user={{
			controlNumber: data.user.controlNumber,
			fullName: data.user.fullName,
		}}
		{paletteRoutes}
		paletteSubjects={subjects}
	>
		{@render children()}
	</LayoutShell>
{:else}
	{@render children()}
{/if}

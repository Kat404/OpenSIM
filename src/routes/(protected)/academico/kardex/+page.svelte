<!--
  OpenSIM — Kardex académico page.

  Hosts the KardexTable component with a Spanish header.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import KardexTable from '#lib/components/kardex/KardexTable.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Kardex — OpenSIM</title>
	<meta name="description" content="Historial académico unificado del estudiante OpenSIM." />
</svelte:head>

<section class="kardex-page">
	<header class="kardex-page__header">
		<p class="kardex-page__eyebrow">Académico</p>
		<h1 class="kardex-page__title">Kardex Académico</h1>
		<p class="kardex-page__sub">
			Historial unificado de asignaturas cursadas. Ordena por cualquier columna o filtra por tipo de evaluación.
		</p>
	</header>

	<KardexTable entries={data.entries} />
</section>

<style>
	.kardex-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.kardex-page__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.kardex-page__eyebrow {
		margin: 0;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-tertiary);
	}

	.kardex-page__title {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.kardex-page__sub {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
	}
</style>
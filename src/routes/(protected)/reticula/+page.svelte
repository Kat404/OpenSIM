<!--
  OpenSIM — Retícula Académica page.

  Hosts the ReticulaDag SVG component. The status legend is rendered
  here so the DAG itself stays focused on the layout + hover logic.
  Reads `#subject-canonical-id` from the URL and hands it to the DAG
  as `focusedCanonicalId` (audit M6, Round 4) so Cmd+K palette
  deep-links scroll into view.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import ReticulaDag from '#lib/components/curriculum/ReticulaDag.svelte';
	import { STATUS_COLOR_VAR, STATUS_LABEL } from '#lib/utils/status-labels';
	import type { StudentProgressStatus } from '#lib/server/db/schema';

	let { data }: { data: PageData } = $props();

	let focusedCanonicalId = $state<string | null>(null);

	// Deep-link from Cmd+K palette: `#calculo-diferencial` etc.
	// The DAG handles the actual scroll; we just pipe the hash into
	// a reactive prop so it works under client-side navigation.
	$effect(() => {
		const hash = page.url.hash;
		focusedCanonicalId = hash ? hash.slice(1) : null;
	});

	const legend: StudentProgressStatus[] = ['APPROVED', 'ENROLLED', 'AVAILABLE', 'LOCKED'];
</script>

<svelte:head>
	<title>Retícula — OpenSIM</title>
	<meta name="description" content="Retícula académica en grafo DAG interactivo." />
</svelte:head>

<section class="reticula">
	<header class="reticula__header">
		<p class="reticula__eyebrow">Retícula</p>
		<h1 class="reticula__title">Retícula Académica</h1>
		<p class="reticula__sub">
			Pasa el cursor sobre una asignatura para resaltar el grafo de prerrequisitos y las que dependen de ella.
		</p>
	</header>

	<div class="reticula__legend" role="list">
		{#each legend as status (status)}
			<span class="reticula__legend-item" role="listitem">
				<span
					class="reticula__legend-swatch reticula__legend-swatch--{status.toLowerCase()}"
					style:background-color="var({STATUS_COLOR_VAR[status].surface})"
					style:border-color="var({STATUS_COLOR_VAR[status].border})"
					aria-hidden="true"
				></span>
				{STATUS_LABEL[status]}
			</span>
		{/each}
	</div>

	<ReticulaDag
		subjects={data.subjects}
		edges={data.edges}
		statusByCanonicalId={data.statusByCanonicalId}
		{focusedCanonicalId}
	/>
</section>

<style>
	.reticula {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.reticula__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.reticula__eyebrow {
		margin: 0;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-tertiary);
	}

	.reticula__title {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.reticula__sub {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
	}

	.reticula__legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		padding: var(--space-3);
		background-color: var(--surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-3);
	}

	.reticula__legend-item {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}

	.reticula__legend-swatch {
		display: inline-block;
		width: 14px;
		height: 14px;
		border-radius: var(--radius-2);
		border: 1px solid var(--border-default);
	}
</style>

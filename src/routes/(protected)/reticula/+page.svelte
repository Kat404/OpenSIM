<!--
  OpenSIM — Retícula Académica page.

  Hosts the ReticulaDag SVG component. The status legend is rendered
  here so the DAG itself stays focused on the layout + hover logic.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import ReticulaDag from '#lib/components/curriculum/ReticulaDag.svelte';
	import type { StudentProgressStatus } from '#lib/server/db/schema';

	let { data }: { data: PageData } = $props();

	const LEGEND: { status: StudentProgressStatus; label: string }[] = [
		{ status: 'APPROVED', label: 'Aprobada' },
		{ status: 'ENROLLED', label: 'Cursando' },
		{ status: 'AVAILABLE', label: 'Disponible' },
		{ status: 'LOCKED', label: 'Bloqueada' }
	];
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
		{#each LEGEND as item (item.status)}
			<span class="reticula__legend-item" role="listitem">
				<span
					class="reticula__legend-swatch reticula__legend-swatch--{item.status.toLowerCase()}"
					aria-hidden="true"
				></span>
				{item.label}
			</span>
		{/each}
	</div>

	<ReticulaDag
		subjects={data.subjects}
		edges={data.edges}
		statusByCanonicalId={data.statusByCanonicalId}
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

	.reticula__legend-swatch--approved {
		background-color: var(--success-50);
		border-color: var(--success-500);
	}
	.reticula__legend-swatch--enrolled {
		background-color: var(--brand-50);
		border-color: var(--brand-500);
	}
	.reticula__legend-swatch--available {
		background-color: var(--surface-3);
		border-color: var(--border-default);
	}
	.reticula__legend-swatch--locked {
		background-color: var(--danger-50);
		border-color: var(--danger-500);
	}
</style>
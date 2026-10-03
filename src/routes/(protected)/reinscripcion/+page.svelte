<!--
  OpenSIM — Simulador de Reinscripción page (Phase 4 Tarea 4.1).

  The page composes the EnrollmentSimulator with a header and
  surfaces the period + the form error returned by the action (if
  any). All the interactive state lives in the simulator
  component; this page just lays out the chrome.
-->
<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import EnrollmentSimulator from '#lib/components/simulador/EnrollmentSimulator.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const formError = $derived(form && 'error' in form ? form.error : null);
</script>

<svelte:head>
	<title>Reinscripción — OpenSIM</title>
	<meta name="description" content="Simulador de reinscripción con detección de conflictos de horario." />
</svelte:head>

<section class="reinscripcion">
	<header class="reinscripcion__header">
		<p class="reinscripcion__eyebrow">Reinscripción</p>
		<h1 class="reinscripcion__title">Simulador de Reinscripción</h1>
		<p class="reinscripcion__sub">
			Selecciona los grupos que deseas cursar este periodo. La firma se aplica a todos en un solo paso.
		</p>
	</header>

	<EnrollmentSimulator
		period={data.period}
		groups={data.groups}
		allBlocks={data.blocks}
		enrolledCanonicalIds={data.enrolledCanonicalIds}
		enrolledBlocks={data.enrolledBlocks}
		{formError}
	/>
</section>

<style>
	.reinscripcion {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.reinscripcion__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.reinscripcion__eyebrow {
		margin: 0;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-tertiary);
	}

	.reinscripcion__title {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.reinscripcion__sub {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
		max-width: 720px;
	}
</style>

<!--
  OpenSIM — Horario semanal page.

  Header plus either the TimeGridSchedule or an EmptyState when the
  student has no real enrollment. No synthetic data is ever served
  (audit H2): the page renders empty when the enrollment is empty.
  Phase 4 N6: the page surfaces the current period string returned
  by the loader so the user can see "Periodo actual: ..." in the
  header.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import TimeGridSchedule from '#lib/components/schedule/TimeGridSchedule.svelte';
	import { EmptyState } from '#lib/components/ui';
	import { CalendarX } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Horario — OpenSIM</title>
	<meta name="description" content="Horario semanal con bloques proporcionales al tiempo real." />
</svelte:head>

<section class="horario">
	<header class="horario__header">
		<p class="horario__eyebrow">Horario</p>
		<h1 class="horario__title">Horario Semanal</h1>
		{#if data.period}
			<p class="horario__period">Periodo actual: <strong>{data.period}</strong></p>
		{/if}
		<p class="horario__sub">
			Cada bloque representa una clase con duración proporcional al tiempo real (60px por hora).
		</p>
	</header>

	<div class="horario__grid">
		{#if data.schedule.length === 0}
			<EmptyState
				title="No tienes horario activo"
				description="No tienes horario activo este periodo. La reinscripción está disponible en /reinscripcion (próximamente)."
				icon={CalendarX}
			/>
		{:else}
			<TimeGridSchedule schedule={data.schedule} />
		{/if}
	</div>
</section>

<style>
	.horario {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.horario__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.horario__eyebrow {
		margin: 0;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-tertiary);
	}

	.horario__title {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.horario__period {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}

	.horario__period strong {
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.horario__sub {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
	}

	.horario__grid {
		min-width: 0;
	}
</style>

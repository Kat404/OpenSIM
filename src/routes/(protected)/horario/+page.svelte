<!--
  OpenSIM — Horario semanal page.

  Header + a synthetic-data notice when the student has no real
  enrollment yet, followed by the TimeGridSchedule component.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import TimeGridSchedule from '#lib/components/schedule/TimeGridSchedule.svelte';

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
		<p class="horario__sub">
			Cada bloque representa una clase con duración proporcional al tiempo real (60px por hora).
		</p>
		{#if data.synthetic}
			<p class="horario__notice" role="status">
				Mostrando datos de muestra — tu horario se mostrará aquí cuando completes la reinscripción.
			</p>
		{/if}
	</header>

	<div class="horario__grid">
		<TimeGridSchedule schedule={data.schedule} />
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

	.horario__sub {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
	}

	.horario__notice {
		margin: var(--space-2) 0 0;
		padding: var(--space-2) var(--space-3);
		background-color: var(--info-50);
		border: 1px solid color-mix(in srgb, var(--info-500) 20%, transparent);
		border-radius: var(--radius-2);
		color: var(--info-700);
		font-size: var(--text-sm);
	}

	.horario__grid {
		min-width: 0;
	}
</style>
<!--
  OpenSIM — Trámites page (Phase 4 Tarea 4.2).

  Page-level header + the procedure stepper. The stepper owns the
  step state and renders the matching form. Form submissions go to
  the page's default action, which is a Phase 4 stub returning
  'Trámite en desarrollo'.
-->
<script lang="ts">
import ProcedureStepper from "#lib/components/tramites/ProcedureStepper.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
const formNotice = $derived(form && "notice" in form ? (form.notice as string) : null);
</script>

<svelte:head>
	<title>Trámites — OpenSIM</title>
	<meta name="description" content="Servicio Social, Residencia Profesional y Titulación.">
</svelte:head>

<section class="tramites">
	<header class="tramites__header">
		<p class="tramites__eyebrow">Trámites</p>
		<h1 class="tramites__title">Trámites académicos</h1>
		<p class="tramites__sub">
			Sigue los procedimientos de Servicio Social, Residencia Profesional y Titulación. Los
			requisitos se evalúan en función de tus créditos aprobados (de {data.totalCredits} totales).
		</p>
		<p class="tramites__progress">
			Tienes <strong>{data.approvedCredits}</strong> créditos aprobados ({Math.round(
				(data.approvedCredits / data.totalCredits) * 100,
			)}% de la carrera).
			{#if data.socialServiceDone}
				<span class="tramites__badge">Servicio Social: completado</span>
			{/if}
		</p>
	</header>

	<ProcedureStepper procedures={data.procedures} {formNotice} />
</section>

<style>
.tramites {
	display: flex;
	flex-direction: column;
	gap: var(--space-5);
}

.tramites__header {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}

.tramites__eyebrow {
	margin: 0;
	font-size: var(--text-xs);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--fg-tertiary);
}

.tramites__title {
	margin: 0;
	font-size: var(--text-2xl);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.tramites__sub {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
	max-width: 720px;
}

.tramites__progress {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-secondary);
}

.tramites__badge {
	display: inline-block;
	margin-left: var(--space-2);
	padding: 2px 8px;
	background-color: var(--success-50);
	color: var(--success-700);
	border: 1px solid color-mix(in srgb, var(--success-500) 20%, transparent);
	border-radius: var(--radius-1);
	font-size: var(--text-xs);
}
</style>

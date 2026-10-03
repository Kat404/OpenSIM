<!--
  OpenSIM — Procedure stepper (Phase 4 Tarea 4.2).

  Wraps the existing `Stepper` atom (read-only) and pairs each
  step with a procedure form. The stepper's `current` index is the
  selected step; clicking a step header switches it.

  Each step shows the procedure's unlock state at a glance:
    - Unlocked: green badge "Disponible" + the form is enabled
    - Locked:   neutral badge "Bloqueado" + the form is disabled
                and an inline message explains what is missing

  The component is a *thin wrapper* — the unlock logic lives in
  the page loader so the thresholds stay in one place
  (`evaluateCreditThresholds`).
-->
<script lang="ts">
	import { Badge, Card, ProgressBar, Stepper, type Step } from '#lib/components/ui';
	import TramiteFormServicioSocial from './TramiteFormServicioSocial.svelte';
	import TramiteFormResidencia from './TramiteFormResidencia.svelte';
	import TramiteFormTitulacion from './TramiteFormTitulacion.svelte';
	import { CheckCircle2, Lock } from 'lucide-svelte';
	import type { ProcedureStatus } from './types';
	import { PROCEDURE_STATE_LABEL } from '#lib/utils/procedure-labels';

	interface Props {
		procedures: ProcedureStatus[];
		formNotice?: string | null;
	}

	let { procedures, formNotice = null }: Props = $props();

	const steps: Step[] = $derived(
		procedures.map((p) => ({
			id: p.id,
			label: p.label,
			description: `${p.creditsRequired} créditos (${Math.round((p.creditsRequired / 260) * 100)}% de la carrera)`
		}))
	);

	let current = $state(0);

	const active = $derived(procedures[current] ?? null);
</script>

<section class="proc" aria-label="Trámites académicos">
	<Stepper steps={steps} {current} orientation="horizontal" />

	{#if formNotice}
		<Card padding="sm">
			<div class="proc__notice" role="status">
				{formNotice}
			</div>
		</Card>
	{/if}

	{#if active}
		<Card padding="lg">
			{#snippet header()}
				<div class="proc__header">
					<div>
						<h2 class="proc__title">{active.label}</h2>
						<p class="proc__desc">{active.description}</p>
					</div>
					{#if active.unlocked}
						<Badge variant="success" size="md" dot>
							<CheckCircle2 size={12} strokeWidth={2} aria-hidden="true" />
							{PROCEDURE_STATE_LABEL.AVAILABLE}
						</Badge>
					{:else}
						<Badge variant="neutral" size="md" dot>
							<Lock size={12} strokeWidth={2} aria-hidden="true" />
							{PROCEDURE_STATE_LABEL.LOCKED}
						</Badge>
					{/if}
				</div>
			{/snippet}

			<div class="proc__progress">
				<ProgressBar
					value={active.percentage}
					label={`Requisitos: ${active.creditsHave} / ${active.creditsRequired} créditos`}
					showValue
				/>
				{#if active.blockedReason}
					<p class="proc__blocked">{active.blockedReason}</p>
				{/if}
			</div>
		</Card>

		<form method="POST" class="proc__form">
			<input type="hidden" name="procedure" value={active.id} />
			{#if active.id === 'servicio-social'}
				<TramiteFormServicioSocial unlocked={active.unlocked} />
			{:else if active.id === 'residencia'}
				<TramiteFormResidencia unlocked={active.unlocked} />
			{:else if active.id === 'titulacion'}
				<TramiteFormTitulacion unlocked={active.unlocked} />
			{/if}
		</form>
	{/if}

	<nav class="proc__nav" aria-label="Navegación entre procedimientos">
		{#each procedures as p, i (p.id)}
			<button
				type="button"
				class="proc__nav-button"
				class:proc__nav-button--active={i === current}
				onclick={() => (current = i)}
				aria-pressed={i === current}
			>
				<span class="proc__nav-label">{p.label}</span>
				<span class="proc__nav-meta">{p.creditsRequired} CR</span>
			</button>
		{/each}
	</nav>
</section>

<style>
	.proc {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		font-family: var(--font-sans);
	}

	.proc__notice {
		font-size: var(--text-sm);
		color: var(--info-700);
	}

	.proc__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.proc__title {
		margin: 0 0 var(--space-1) 0;
		font-size: var(--text-lg);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.proc__desc {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
		max-width: 600px;
	}

	.proc__progress {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.proc__blocked {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--warning-700);
	}

	.proc__form {
		display: contents;
	}

	.proc__nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-3);
		background-color: var(--surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-3);
	}

	.proc__nav-button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background-color: transparent;
		color: var(--fg-secondary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-2);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		cursor: pointer;
		transition:
			background-color var(--motion-duration-fast) var(--motion-ease-standard),
			border-color var(--motion-duration-fast) var(--motion-ease-standard);
	}

	.proc__nav-button:hover {
		background-color: var(--surface-2);
	}

	.proc__nav-button--active {
		background-color: var(--brand-50);
		border-color: var(--brand-100);
		color: var(--brand-700);
	}

	.proc__nav-label {
		font-weight: var(--weight-medium);
	}

	.proc__nav-meta {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--fg-tertiary);
	}
</style>

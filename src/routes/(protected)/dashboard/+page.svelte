<!--
  OpenSIM — Student dashboard (Phase 3 Tarea 3.2).

  Replaces the Phase 2 placeholder with four KPI cards, a today's
  classes widget, and a CTA card that links to the retícula. The
  page consumes typed `data` from `+page.server.ts` and keeps all
  presentation logic local — no per-keystroke work, no client-side
  data fetching.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import KpiCard from '#lib/components/dashboard/KpiCard.svelte';
	import TodayClasses from '#lib/components/dashboard/TodayClasses.svelte';
	import { Button, Card, EmptyState } from '#lib/components/ui';
	import { ArrowRight, FileDown } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	function fmtCredits(value: number): string {
		return value.toString();
	}
	function fmtPercent(value: number): string {
		return `${value.toFixed(1)}%`;
	}
	function fmtAverage(value: number): string {
		return value.toFixed(2);
	}
</script>

<svelte:head>
	<title>Panel — OpenSIM</title>
	<meta name="description" content="Resumen académico del estudiante OpenSIM." />
</svelte:head>

<section class="dashboard">
	<header class="dashboard__header">
		<p class="dashboard__eyebrow">Dashboard</p>
		<h1 class="dashboard__greeting">Bienvenido, {data.firstName}</h1>
		<p class="dashboard__sub">Sistema Integral Modular — TecNM Morelia</p>
		{#if data.period}
			<p class="dashboard__period">Periodo actual: <strong>{data.period}</strong></p>
		{/if}
	</header>

	{#if page.url.searchParams.get('reason') === 'logged-out'}
		<p class="dashboard__notice" role="status">Sesión cerrada correctamente.</p>
	{/if}
	{#if page.url.searchParams.get('enrolled') === '1'}
		<p class="dashboard__notice" role="status">Inscripción registrada correctamente.</p>
	{/if}

	<div class="dashboard__kpis" role="list">
		<div role="listitem" class="dashboard__kpi-col">
			<KpiCard
				label="Promedio certificado"
				value={fmtAverage(data.kpis.certifiedAverage)}
				sublabel="Promedio oficial registrado"
				accent="brand"
			/>
		</div>
		<div role="listitem" class="dashboard__kpi-col">
			<KpiCard
				label="Promedio aritmético"
				value={fmtAverage(data.kpis.arithmeticAverage)}
				sublabel="Promedio simple sobre tus calificaciones"
				accent="info"
			/>
		</div>
		<div role="listitem" class="dashboard__kpi-col">
			<KpiCard
				label="Créditos aprobados"
				value={`${fmtCredits(data.kpis.approvedCredits)} / ${fmtCredits(data.kpis.totalCredits)}`}
				sublabel="Acumulados en tu historial académico"
				accent="success"
			/>
		</div>
		<div role="listitem" class="dashboard__kpi-col">
			<KpiCard
				label="% Avance"
				value={fmtPercent(data.kpis.advancePercentage)}
				sublabel="Porcentaje de la carrera cubierto"
				accent="neutral"
			/>
		</div>
	</div>

	<div class="dashboard__grid">
		<div class="dashboard__today">
			<TodayClasses classes={data.todayClasses} dayLabel={data.dayLabel} />
		</div>

		<div class="dashboard__cta">
			<Card padding="lg">
				{#snippet header()}
						<h2 class="dashboard__cta-title">Continuar con la retícula</h2>
					{/snippet}
				<p class="dashboard__cta-text">
					Explora las 42 asignaturas del plan ISIC-2010-224, revisa los
					prerrequisitos en forma de grafo y conoce el camino que te falta
					por recorrer para titularte.
				</p>
				{#snippet footer()}
						<a class="dashboard__cta-link" href="/reticula">
							Ver retícula académica
							<ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
						</a>
					{/snippet}
			</Card>

			{#if data.hasEnrollment && data.period}
				<Card padding="lg">
					{#snippet header()}
						<h2 class="dashboard__cta-title">Carga académica</h2>
					{/snippet}
					<p class="dashboard__cta-text">
						Descarga tu carga académica en formato PDF vectorial. El archivo
						incluye tu horario semanal con los bloques del periodo actual.
					</p>
					{#snippet footer()}
						<form method="POST" action="/api/export/carga">
							<Button type="submit" variant="secondary" size="md">
								{#snippet startIcon()}<FileDown size={16} strokeWidth={1.75} aria-hidden="true" />{/snippet}
								Descargar Carga Académica (PDF)
							</Button>
						</form>
					{/snippet}
				</Card>
			{/if}

			{#if !data.hasEnrollment}
				<div class="dashboard__enroll-hint">
					<EmptyState
						title="Aún no tienes inscripción activa"
						description="Cuando completes tu proceso de reinscripción, aquí verás tus clases del día en vivo."
					/>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.dashboard__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.dashboard__eyebrow {
		margin: 0;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-tertiary);
	}

	.dashboard__greeting {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.dashboard__sub {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
	}

	.dashboard__period {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}

	.dashboard__period strong {
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.dashboard__notice {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background-color: var(--success-50);
		border: 1px solid color-mix(in srgb, var(--success-500) 20%, transparent);
		border-radius: var(--radius-2);
		color: var(--success-700);
		font-size: var(--text-sm);
	}

	.dashboard__kpis {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-4);
	}

	.dashboard__kpi-col {
		min-width: 0;
	}

	.dashboard__grid {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: var(--space-4);
	}

	.dashboard__today {
		min-width: 0;
	}

	.dashboard__cta {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}

	.dashboard__cta-title {
		margin: 0;
		font-size: var(--text-md);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.dashboard__cta-text {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		line-height: var(--leading-normal);
	}

	.dashboard__cta-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--brand-700);
		text-decoration: none;
	}

	.dashboard__cta-link:hover {
		color: var(--brand-600);
		text-decoration: underline;
	}

	.dashboard__enroll-hint {
		min-width: 0;
	}

	@media (max-width: 960px) {
		.dashboard__kpis {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.dashboard__grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 480px) {
		.dashboard__kpis {
			grid-template-columns: 1fr;
		}
	}
</style>
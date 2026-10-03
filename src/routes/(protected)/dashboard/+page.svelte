<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Split the full name for the greeting. We take the first two
	// words as given/family — enough for a friendly "Hola, {name}"
	// without a brittle parser. The full name remains available in
	// `data.fullName` for the body.
	const firstName = $derived(data.fullName.split(/\s+/)[0] ?? data.fullName);
</script>

<svelte:head>
	<title>Dashboard — OpenSIM</title>
	<meta name="description" content="Panel principal del estudiante OpenSIM." />
</svelte:head>

<section class="dashboard">
	<header class="dashboard__header">
		<p class="dashboard__eyebrow">Dashboard</p>
		<h1 class="dashboard__greeting">Bienvenido, {firstName}</h1>
		<p class="dashboard__sub">Sistema Integral Modular — TecNM Morelia</p>
	</header>

	<div class="dashboard__card">
		<h2 class="dashboard__h2">Tu perfil académico</h2>
		<dl class="dashboard__list">
			<div class="dashboard__row">
				<dt>Nombre completo</dt>
				<dd>{data.fullName}</dd>
			</div>
			<div class="dashboard__row">
				<dt>Número de control</dt>
				<dd>{data.controlNumber}</dd>
			</div>
			<div class="dashboard__row">
				<dt>Semestre actual</dt>
				<dd>{data.currentSemester}</dd>
			</div>
			<div class="dashboard__row">
				<dt>Promedio certificado</dt>
				<dd>{data.certifiedAverage.toFixed(2)}</dd>
			</div>
			<div class="dashboard__row">
				<dt>Créditos completados</dt>
				<dd>{data.completedCredits} / {data.completedCredits + data.remainingCredits}</dd>
			</div>
			<div class="dashboard__row">
				<dt>Avance de carrera</dt>
				<dd>{data.advancePercentage.toFixed(1)}%</dd>
			</div>
			<div class="dashboard__row">
				<dt>Estado</dt>
				<dd>{data.status}</dd>
			</div>
		</dl>
	</div>

	<aside class="dashboard__phase-note" role="status">
		<h2 class="dashboard__h2">Fase 3 en desarrollo</h2>
		<p>
			Este panel es un placeholder. La <strong>Tarea 3.2</strong> lo reemplazará
			con tarjetas de KPIs, clases del día, kardex resumido, próximos
			trámites y accesos rápidos a horario, retícula y reinscripción.
		</p>
		{#if page.url.searchParams.get('reason') === 'logged-out'}
			<p class="dashboard__note">Sesión cerrada correctamente.</p>
		{/if}
	</aside>
</section>

<style>
	.dashboard {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-6, 1.5rem);
	}

	.dashboard__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1, 0.25rem);
	}

	.dashboard__eyebrow {
		margin: 0;
		font-size: var(--text-xs, 0.75rem);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-tertiary, #666);
	}

	.dashboard__greeting {
		margin: 0;
		font-size: var(--text-2xl, 1.5rem);
		font-weight: var(--weight-semibold, 600);
		color: var(--fg-primary, #111);
	}

	.dashboard__sub {
		margin: 0;
		font-size: var(--text-sm, 0.875rem);
		color: var(--fg-tertiary, #666);
	}

	.dashboard__card,
	.dashboard__phase-note {
		padding: var(--space-5, 1.25rem);
		background-color: var(--surface-1, #fff);
		border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.08));
		border-radius: var(--radius-3, 0.5rem);
	}

	.dashboard__h2 {
		margin: 0 0 var(--space-3, 0.75rem);
		font-size: var(--text-md, 1rem);
		font-weight: var(--weight-semibold, 600);
		color: var(--fg-primary, #111);
	}

	.dashboard__list {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-2, 0.5rem);
	}

	.dashboard__row {
		display: grid;
		grid-template-columns: minmax(140px, 0.5fr) 1fr;
		gap: var(--space-3, 0.75rem);
		font-size: var(--text-sm, 0.875rem);
	}

	.dashboard__row dt {
		color: var(--fg-tertiary, #666);
	}

	.dashboard__row dd {
		margin: 0;
		color: var(--fg-primary, #111);
	}

	.dashboard__phase-note p {
		margin: 0;
		font-size: var(--text-sm, 0.875rem);
		color: var(--fg-secondary, #444);
		line-height: 1.5;
	}

	.dashboard__phase-note p + p {
		margin-top: var(--space-3, 0.75rem);
	}

	.dashboard__note {
		color: var(--success-700, #15803d);
	}
</style>

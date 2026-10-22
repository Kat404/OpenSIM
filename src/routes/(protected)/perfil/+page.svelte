<!--
  OpenSIM — Student profile (S6).

  Presents the student's OWN general data as cards. Everything comes
  from this page's own server loader (`+page.server.ts`): the
  sensitive columns (CURP, birth state) are loaded per page and never
  travel through the shared layout payload.

  UI copy is Spanish (es-MX); identifiers and comments are English.
-->
<script lang="ts">
import { Avatar, Badge, Card, EmptyState, ProgressBar } from "#lib/components/ui";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

const profile = $derived(data.profile);

// A stored empty string is a hole, not a value: the demo credential's
// profile row carries no enrollment period, and an empty cell would
// read as "the student forgot to fill this in".
function orDash(value: string): string {
	return value.trim() === "" ? "—" : value;
}

function formatAverage(value: number): string {
	return value.toFixed(2);
}

function formatPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

// The stored status is "Activo regular". Any other state renders
// neutral rather than a colour this page would have to invent.
function statusVariant(status: string): "success" | "neutral" {
	return status.toLowerCase().startsWith("activo") ? "success" : "neutral";
}
</script>

<svelte:head>
	<title>Perfil — OpenSIM</title>
	<meta name="description" content="Datos generales del estudiante OpenSIM.">
</svelte:head>

{#snippet field(
	label: string,
	value: string,
)}
	<div class="perfil__field">
		<dt class="perfil__label">{label}</dt>
		<dd class="perfil__value">{value}</dd>
	</div>
{/snippet}

<section class="perfil">
	<header class="perfil__header">
		<p class="perfil__eyebrow">Expediente</p>
		<h1 class="perfil__title">Perfil del estudiante</h1>
		<p class="perfil__sub">Tus datos generales, tal como los tiene el registro de OpenSIM.</p>
	</header>

	{#if !profile}
		<EmptyState
			title="No hay un perfil que mostrar"
			description="Tu sesión está iniciada, pero no encontramos un expediente con tu número de control."
		/>
	{:else}
		<div class="perfil__hero">
			<Card padding="lg" title="Datos generales">
				<div class="perfil__identity">
					<Avatar name={profile.fullName} size="lg" />
					<div class="perfil__identity-text">
						<p class="perfil__name">{profile.fullName}</p>
						<p class="perfil__control">
							Número de control <strong>{profile.controlNumber}</strong>
						</p>
					</div>
				</div>
				<dl class="perfil__fields">
					{@render field("Carrera", profile.careerName ?? profile.careerCode)}
					{@render field("Semestre actual", String(profile.currentSemester))}
					<div class="perfil__field">
						<dt class="perfil__label">Estado</dt>
						<dd class="perfil__value">
							<Badge variant={statusVariant(profile.status)} size="sm">{profile.status}</Badge>
						</dd>
					</div>
				</dl>
			</Card>
		</div>

		<div class="perfil__grid">
			<Card padding="md" title="Créditos">
				<dl class="perfil__fields">
					{@render field("Aprobados", String(profile.approvedCredits))}
					{@render field("Restantes", String(profile.remainingCredits))}
					{@render field("En curso", String(profile.inProgressCredits))}
					{@render field("Avance de la carrera", formatPercent(profile.advancePercentage))}
				</dl>
				<ProgressBar
					value={profile.advancePercentage}
					max={100}
					label="Progreso del plan de estudios"
				/>
			</Card>

			<Card padding="md" title="Promedios">
				<dl class="perfil__fields">
					{@render field("Promedio certificado", formatAverage(profile.certifiedAverage))}
					{@render field("Promedio aritmético", formatAverage(profile.arithmeticAverage))}
				</dl>
			</Card>

			<Card padding="md" title="Registro y servicios">
				<dl class="perfil__fields">
					{@render field("Servicio de salud", orDash(profile.healthService))}
					{@render field("Periodo de inscripción", orDash(profile.enrollmentPeriod))}
				</dl>
			</Card>

			<Card padding="md" title="Datos de identificación">
				<dl class="perfil__fields">
					{@render field("CURP", orDash(profile.curp))}
					{@render field("Estado de nacimiento", orDash(profile.birthState))}
				</dl>
			</Card>
		</div>
	{/if}
</section>

<style>
.perfil {
	display: flex;
	flex-direction: column;
	gap: var(--space-6);
}

.perfil__header {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}

.perfil__eyebrow {
	margin: 0;
	font-size: var(--text-xs);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--fg-tertiary);
}

.perfil__title {
	margin: 0;
	font-size: var(--text-2xl);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.perfil__sub {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
}

.perfil__hero {
	min-width: 0;
}

.perfil__grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	gap: var(--space-4);
	align-items: start;
}

.perfil__identity {
	display: flex;
	align-items: center;
	gap: var(--space-3);
}

.perfil__identity-text {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
	min-width: 0;
}

.perfil__name {
	margin: 0;
	font-size: var(--text-lg);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
	overflow-wrap: anywhere;
}

.perfil__control {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
}

.perfil__control strong {
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
	font-variant-numeric: tabular-nums;
}

.perfil__fields {
	margin: 0;
	display: flex;
	flex-direction: column;
}

.perfil__field {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: var(--space-3);
	padding: var(--space-2) 0;
	border-bottom: 1px solid var(--border-subtle);
}

.perfil__field:last-child {
	border-bottom: none;
	padding-bottom: 0;
}

.perfil__label {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
}

.perfil__value {
	margin: 0;
	font-size: var(--text-sm);
	font-weight: var(--weight-medium);
	color: var(--fg-primary);
	text-align: right;
	font-variant-numeric: tabular-nums;
	overflow-wrap: anywhere;
}
</style>

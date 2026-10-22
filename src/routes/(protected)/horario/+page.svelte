<!--
  OpenSIM — Horario semanal page.

  Header plus either the TimeGridSchedule or an EmptyState when the
  student has no real enrollment. No synthetic data is ever served
  (audit H2): the page renders empty when the enrollment is empty.
  Phase 4 N6: the page surfaces the current period string returned
  by the loader so the user can see "Periodo actual: ..." in the
  header.

  T9.11: a student can be enrolled in a group the SIM has not published a
  classroom or hours for yet. Those groups render as a named "pending"
  list, never as an empty grid — an empty grid reads as "you have no
  classes", which is a different and false statement.
-->
<script lang="ts">
import { CalendarX, Clock } from "@lucide/svelte";
import TimeGridSchedule from "#lib/components/schedule/TimeGridSchedule.svelte";
import { Badge, Card, EmptyState } from "#lib/components/ui";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Horario — OpenSIM</title>
	<meta name="description" content="Horario semanal con bloques proporcionales al tiempo real.">
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
		{#if data.schedule.length === 0 && data.pending.length === 0}
			<EmptyState
				title="No tienes horario activo"
				description="No tienes horario activo este periodo. La reinscripción está disponible en /reinscripcion (próximamente)."
				icon={CalendarX}
			/>
		{:else}
			{#if data.schedule.length > 0}
				<TimeGridSchedule schedule={data.schedule} />
			{/if}

			{#if data.pending.length > 0}
				<div class="horario__pending">
					<Card padding="lg">
						{#snippet header()}
							<div class="horario__pending-header">
								<h2 class="horario__pending-title">
									<Clock size={16} aria-hidden="true" />
									Sin horario publicado ({data.pending.length})
								</h2>
								<Badge variant="warning" size="sm">Pendiente</Badge>
							</div>
						{/snippet}
						<p class="horario__pending-note">
							El SIM publica el aula y la hora de un grupo cuando formalizas la inscripción. Estos
							grupos ya están inscritos, pero su horario todavía no aparece en el portal.
						</p>
						<ul class="horario__pending-list">
							{#each data.pending as group (group.group.id)}
								<li class="horario__pending-item">
									<span class="horario__pending-code">{group.subject.code}</span>
									<span class="horario__pending-name">{group.subject.name}</span>
									<span class="horario__pending-group">
										Grupo {group.group.groupCode} · {group.group.teacherName}
									</span>
								</li>
							{/each}
						</ul>
					</Card>
				</div>
			{/if}
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

.horario__pending {
	margin-top: var(--space-4);
}

.horario__pending-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-2);
}

.horario__pending-title {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	margin: 0;
	font-size: var(--text-md);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.horario__pending-note {
	margin: 0 0 var(--space-3);
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
	max-width: 720px;
}

.horario__pending-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	margin: 0;
	padding: 0;
	list-style: none;
}

.horario__pending-item {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: var(--space-2);
	font-size: var(--text-sm);
}

.horario__pending-code {
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.horario__pending-name {
	color: var(--fg-secondary);
}

.horario__pending-group {
	color: var(--fg-tertiary);
	font-size: var(--text-xs);
}
</style>

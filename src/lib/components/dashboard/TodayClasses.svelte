<!--
  OpenSIM — Today's classes widget for the dashboard.

  Renders up to `classes.length` rows (caller slices to 6 max); shows
  the EmptyState atom when the list is empty. Each row carries the
  subject code, the subject name, the start–end time and the
  classroom. Color comes from the HSL hash so a class always paints
  with the same pastel regardless of which page renders it.
-->
<script lang="ts">
import { CalendarX } from "lucide-svelte";
import { EmptyState } from "#lib/components/ui";
import { getSubjectColor } from "#lib/utils/color";
import { getTheme } from "#lib/utils/theme.svelte";

export interface TodayClass {
	code: string;
	name: string;
	subjectCanonicalId: string;
	startTime: string;
	endTime: string;
	classroom: string;
}

interface Props {
	classes: TodayClass[];
	dayLabel?: string;
}

let { classes, dayLabel = "hoy" }: Props = $props();
</script>

<section class="today" aria-label="Clases de {dayLabel}">
	<header class="today__header">
		<h2 class="today__title">Clases de {dayLabel}</h2>
		<span class="today__count" aria-live="polite"
			>{classes.length}
			bloque{classes.length === 1 ? "" : "s"}</span
		>
	</header>

	{#if classes.length === 0}
		<EmptyState
			title="Sin clases hoy"
			description="No tienes clases programadas para este día."
			icon={CalendarX}
		/>
	{:else}
		<ul class="today__list">
			{#each classes as cls (cls.code + cls.startTime)}
				{@const bg = getSubjectColor(cls.code, getTheme())}
				<li class="today__item">
					<span class="today__swatch" style:background-color={bg} aria-hidden="true"></span>
					<div class="today__meta">
						<div class="today__row">
							<span class="today__code">{cls.code}</span>
							<span class="today__time">{cls.startTime}–{cls.endTime}</span>
						</div>
						<span class="today__name">{cls.name}</span>
						<span class="today__room">Aula {cls.classroom}</span>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
.today {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-5);
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
	font-family: var(--font-sans);
}

.today__header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
}

.today__title {
	margin: 0;
	font-size: var(--text-md);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.today__count {
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
	font-family: var(--font-mono);
}

.today__list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.today__item {
	display: flex;
	align-items: stretch;
	gap: var(--space-3);
	padding: var(--space-2) var(--space-3);
	background-color: var(--surface-0);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-2);
}

.today__swatch {
	width: 6px;
	flex-shrink: 0;
	border-radius: var(--radius-1);
}

.today__meta {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.today__row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-2);
}

.today__code {
	font-family: var(--font-mono);
	font-size: var(--text-sm);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.today__time {
	font-family: var(--font-mono);
	font-size: var(--text-xs);
	color: var(--fg-secondary);
	font-variant-numeric: tabular-nums;
}

.today__name {
	font-size: var(--text-sm);
	color: var(--fg-secondary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.today__room {
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
}
</style>

<!--
  OpenSIM — Weekly classes widget for the dashboard.

  Renders the student's WHOLE week: one row per class block, ordered
  by day (L M X J V S D) and then by start time, so the server and the
  client render the same tree. Today's rows carry a "hoy" badge and a
  highlighted left border, so the student sees the day they are in
  without reading the day column.

  The day is a letter in a chip, but the chip also carries the full
  name ("Lunes") as text: a day that lives only in a position is a day
  a screen reader never says — the same lesson the schedule grid
  learned (see TimeGridSchedule / ClassBlock).

  Colour comes from the HSL hash so a class always paints with the
  same pastel regardless of which page renders it.
-->
<script lang="ts">
import { CalendarX } from "@lucide/svelte";
import { Badge, EmptyState } from "#lib/components/ui";
import { getSubjectColor } from "#lib/utils/color";
import { getTheme } from "#lib/utils/theme.svelte";
import { DAY_NAME, type DayLetter } from "#lib/utils/time";

export interface WeekClass {
	code: string;
	name: string;
	subjectCanonicalId: string;
	day: DayLetter;
	startTime: string;
	endTime: string;
	classroom: string;
}

interface Props {
	classes: WeekClass[];
	today: DayLetter;
	period?: string | null;
}

let { classes, today, period = null }: Props = $props();
</script>

<section class="week" aria-label="Tu semana">
	<header class="week__header">
		<h2 class="week__title">Tu semana</h2>
		<div class="week__meta">
			{#if period}
				<span class="week__period">Periodo {period}</span>
			{/if}
			<span class="week__count" aria-live="polite"
				>{classes.length}
				bloque{classes.length === 1 ? "" : "s"}</span
			>
		</div>
	</header>

	{#if classes.length === 0}
		<EmptyState
			title="Sin clases esta semana"
			description="No tienes clases programadas en el periodo actual."
			icon={CalendarX}
		/>
	{:else}
		<ul class="week__list">
			{#each classes as cls (cls.day + cls.code + cls.startTime + cls.classroom)}
				{@const isToday = cls.day === today}
				{@const bg = getSubjectColor(cls.code, getTheme())}
				<li class="week__item" class:week__item--today={isToday}>
					<span class="week__swatch" style:background-color={bg} aria-hidden="true"></span>
					<span class="week__day">
						<span class="week__day-letter" aria-hidden="true">{cls.day}</span>
						<span class="week__day-name">{DAY_NAME[cls.day]}</span>
					</span>
					<div class="week__info">
						<span class="week__code">{cls.code}</span>
						<span class="week__time">{cls.startTime}–{cls.endTime}</span>
						<span class="week__name">{cls.name}</span>
						<span class="week__room">{cls.classroom}</span>
					</div>
					{#if isToday}
						<Badge variant="brand" size="sm">hoy</Badge>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
.week {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-5);
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
	font-family: var(--font-sans);
}

.week__header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: var(--space-2) var(--space-3);
}

.week__title {
	margin: 0;
	font-size: var(--text-md);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.week__meta {
	display: flex;
	align-items: baseline;
	gap: var(--space-3);
}

.week__period {
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
	font-family: var(--font-mono);
}

.week__count {
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
	font-family: var(--font-mono);
}

.week__list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.week__item {
	display: grid;
	grid-template-columns: 6px 24px minmax(0, 1fr) auto;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-2) var(--space-3);
	background-color: var(--surface-0);
	border: 1px solid var(--border-subtle);
	border-left: 3px solid transparent;
	border-radius: var(--radius-2);
}

.week__item--today {
	border-left-color: var(--brand-600);
}

.week__swatch {
	width: 6px;
	align-self: stretch;
	min-height: 18px;
	border-radius: var(--radius-1);
}

.week__day {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: var(--radius-1);
	background-color: var(--surface-2);
	color: var(--fg-secondary);
	font-family: var(--font-mono);
	font-size: var(--text-xs);
	font-weight: var(--weight-semibold);
}

.week__item--today .week__day {
	background-color: var(--brand-50);
	color: var(--brand-700);
}

/*
 * The day NAME lives here, in the accessibility tree but not on the
 * screen: the letter in the chip is what the eye reads, the name is
 * what a screen reader says. `clip-path` (not `display: none`) is what
 * keeps the text in the tree.
 */
.week__day-name {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
	border: 0;
}

/* One line per class: a week of fourteen blocks has to fit the
	 column, or the dashboard trades one empty column for a taller one. */
.week__info {
	display: flex;
	align-items: baseline;
	gap: var(--space-3);
	min-width: 0;
}

.week__code {
	flex: 0 0 auto;
	font-family: var(--font-mono);
	font-size: var(--text-sm);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.week__time {
	flex: 0 0 auto;
	font-family: var(--font-mono);
	font-size: var(--text-xs);
	color: var(--fg-secondary);
	font-variant-numeric: tabular-nums;
}

.week__name {
	flex: 0 1 auto;
	min-width: 0;
	font-size: var(--text-sm);
	color: var(--fg-secondary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.week__room {
	flex: 0 0 auto;
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
}
</style>

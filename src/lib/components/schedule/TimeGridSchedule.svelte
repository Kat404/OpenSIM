<!--
  OpenSIM — Weekly schedule grid with proportional-height class blocks.

  Layout strategy:
    - 7 day columns (L M M J V S D — Spanish single-letter headers).
    - An hour gutter on the left with hour labels every hour from
      `startHour` to `endHour` (07:00–22:00 by default).
    - Class blocks are absolutely positioned inside their day column.
      Top is computed from `startTime`, height from `endTime -
      startTime`, using 60px per hour so a 90-minute block is 90px tall.

  The component is purely visual: data shaping (mapping schedule rows
  into {subject, block, colorHsl, topPx, heightPx} tuples) lives in
  the parent +page.server.ts so the client never has to think about
  pixel math.
-->
<script lang="ts">
import { getSubjectColor } from "#lib/utils/color";
import { getTheme } from "#lib/utils/theme.svelte";
import ClassBlock, { type ScheduleBlock, type ScheduleSubject } from "./ClassBlock.svelte";

// The loader tags each block with a day-letter so we can group
// here; ClassBlock's `ScheduleBlock` doesn't carry `day` because
// the block doesn't need to know which column it lives in
// (audit N7, Round 6).
export type DayLetter = "L" | "M" | "X" | "J" | "V" | "S" | "D";

export interface ScheduledClass {
	subject: ScheduleSubject;
	block: ScheduleBlock & { day: DayLetter };
}

interface Props {
	schedule: ScheduledClass[];
	startHour?: number;
	endHour?: number;
}

let { schedule, startHour = 7, endHour = 22 }: Props = $props();

const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const DAY_INDEX: Record<string, DayLetter> = {
	L: "L",
	M: "M",
	X: "X",
	J: "J",
	V: "V",
	S: "S",
	D: "D",
};

const HOURS = $derived(Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i));

function parseHHMM(s: string): number {
	const [h, m] = s.split(":").map((x) => parseInt(x, 10));
	return h + (m ?? 0) / 60;
}

// 60px per hour keeps the math simple and matches the audit
// recommendation. Const hoisted to module, defined here for
// clarity (LayoutShell does not import this).
const PIXELS_PER_HOUR = 60;

const totalHeight = $derived((endHour - startHour) * PIXELS_PER_HOUR);

const positioned = $derived.by(() => {
	const theme = getTheme();
	const byDay = new Map<
		DayLetter,
		{
			subject: ScheduleSubject;
			block: ScheduleBlock;
			topPx: number;
			heightPx: number;
			colorHsl: string;
		}[]
	>();
	for (const { subject, block } of schedule) {
		const day = DAY_INDEX[block.day.toUpperCase()];
		if (!day) continue;
		const start = parseHHMM(block.startTime);
		const end = parseHHMM(block.endTime);
		const topPx = Math.max(0, (start - startHour) * PIXELS_PER_HOUR);
		const heightPx = Math.max(28, (end - start) * PIXELS_PER_HOUR);
		const colorHsl = getSubjectColor(subject.code, theme);
		const arr = byDay.get(day) ?? [];
		arr.push({ subject, block, topPx, heightPx, colorHsl });
		byDay.set(day, arr);
	}
	return byDay;
});
</script>

<div
	class="grid"
	style:--total-height="{totalHeight}px"
	role="presentation"
	aria-label="Horario semanal"
>
	<div class="grid__header-spacer" aria-hidden="true"></div>
	{#each DAY_LETTERS as letter (letter)}
		<div class="grid__day-header">
			<span class="col-msg" aria-label="Día {letter}">{letter}</span>
		</div>
	{/each}

	<div class="grid__hours" aria-hidden="true">
		{#each HOURS as hour (hour)}
			<div class="grid__hour">
				<span class="grid__hour-label">{String(hour).padStart(2, "0")}:00</span>
			</div>
		{/each}
	</div>

	{#each DAY_LETTERS as letter (letter)}
		<div class="grid__day">
			{#each HOURS as hour (hour)}
				<div class="grid__row-line" class:grid__row-line--hourly={true} aria-hidden="true"></div>
			{/each}
			{#each positioned.get(letter) ?? [] as item (item.subject.canonicalId + item.block.startTime)}
				<ClassBlock
					subject={item.subject}
					block={item.block}
					colorHsl={item.colorHsl}
					topPx={item.topPx}
					heightPx={item.heightPx}
				/>
			{/each}
		</div>
	{/each}
</div>

<style>
.grid {
	--col-count: 7;
	--gutter-width: 56px;
	display: grid;
	grid-template-columns: var(--gutter-width) repeat(var(--col-count), minmax(0, 1fr));
	grid-template-rows: 40px auto;
	gap: 0;
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
	font-family: var(--font-sans);
	overflow: hidden;
}

.grid__header-spacer {
	grid-column: 1;
	grid-row: 1;
	background-color: var(--surface-2);
	border-bottom: 1px solid var(--border-subtle);
	border-right: 1px solid var(--border-subtle);
}

.grid__day-header {
	grid-row: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: var(--space-2);
	background-color: var(--surface-2);
	border-bottom: 1px solid var(--border-subtle);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
	font-size: var(--text-sm);
}

.grid__day-header + .grid__day-header {
	border-left: 1px solid var(--border-subtle);
}

.col-msg {
	font-family: var(--font-mono);
}

.grid__hours {
	grid-column: 1;
	grid-row: 2;
	display: flex;
	flex-direction: column;
	border-right: 1px solid var(--border-subtle);
	background-color: var(--surface-1);
}

.grid__hour {
	height: 60px;
	display: flex;
	align-items: flex-start;
	justify-content: flex-end;
	padding: 2px var(--space-2);
	font-family: var(--font-mono);
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
	font-variant-numeric: tabular-nums;
}

.grid__day {
	grid-row: 2;
	position: relative;
	min-height: var(--total-height, 900px);
	background-color: var(--surface-1);
}

.grid__day + .grid__day {
	border-left: 1px solid var(--border-subtle);
}

.grid__row-line {
	height: 60px;
	border-bottom: 1px solid var(--border-subtle);
}

@media (max-width: 720px) {
	.grid {
		--gutter-width: 40px;
	}
	.grid__day-header {
		font-size: var(--text-xs);
		padding: var(--space-1);
	}
	.grid__hour-label {
		display: none;
	}
}
</style>

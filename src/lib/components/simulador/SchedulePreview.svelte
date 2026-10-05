<!--
  OpenSIM — Schedule preview for the Reinscripción simulator.

  A simplified time-grid that renders the student's *current*
  (already-enrolled) classes plus the *candidate* classes the user
  is about to add. Conflict detection is run client-side over the
  pure helper so the preview updates instantly as the selection
  changes (no server round-trip per keystroke).

  Visual:
    - 7 day columns (L M M J V S D)
    - Hour gutter 07:00-22:00 (60px per hour, same as the
      TimeGridSchedule in /horario)
    - Already-enrolled blocks: solid background (theme-aware HSL)
    - Candidate blocks: outlined + a thicker left border so the
      user can tell at a glance which classes are new
    - Conflicting candidates: red outline + a small badge so the
      ARIA live region can announce the conflict
-->
<script lang="ts">
import { AlertTriangle } from "lucide-svelte";
import { Badge } from "#lib/components/ui";
import { getSubjectColor } from "#lib/utils/color";
import { type ConflictBlock, findConflicts } from "#lib/utils/schedule-conflict";
import { getTheme } from "#lib/utils/theme.svelte";

export interface PreviewBlock extends ConflictBlock {
	groupId: string;
	subjectCode: string;
	subjectName: string;
	teacherName: string;
	classroom: string;
	kind: "enrolled" | "candidate";
}

interface Props {
	enrolledBlocks: PreviewBlock[];
	candidateBlocks: PreviewBlock[];
	startHour?: number;
	endHour?: number;
}

let { enrolledBlocks, candidateBlocks, startHour = 7, endHour = 22 }: Props = $props();

const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"] as const;
type DayLetter = (typeof DAY_LETTERS)[number];

const HOURS = $derived(Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i));
const totalHeight = $derived((endHour - startHour) * 60);

const conflictIds = $derived.by(() => {
	const enrolledOnly: ConflictBlock[] = enrolledBlocks.map((b) => ({
		id: b.id,
		day: b.day,
		startTime: b.startTime,
		endTime: b.endTime,
	}));
	const candidateOnly: ConflictBlock[] = candidateBlocks.map((b) => ({
		id: b.id,
		day: b.day,
		startTime: b.startTime,
		endTime: b.endTime,
	}));
	// A candidate conflicts if it overlaps any ENROLLED block OR
	// any other candidate that the student has also selected.
	const againstEnrolled = findConflicts(candidateOnly, enrolledOnly);
	const againstOtherCandidates = findConflicts(candidateOnly, candidateOnly);
	return new Set<string | number>([...againstEnrolled, ...againstOtherCandidates]);
});

const conflictCount = $derived(conflictIds.size);

function parseHHMM(s: string): number {
	const [h, m] = s.split(":").map((x) => parseInt(x, 10));
	return (h || 0) + (m || 0) / 60;
}

const positioned = $derived.by(() => {
	const theme = getTheme();
	const all: PreviewBlock[] = [...enrolledBlocks, ...candidateBlocks];
	const byDay = new Map<
		DayLetter,
		{ block: PreviewBlock; topPx: number; heightPx: number; colorHsl: string; conflicts: boolean }[]
	>();
	for (const b of all) {
		const day = b.day.toUpperCase() as DayLetter;
		if (!DAY_LETTERS.includes(day)) continue;
		const start = parseHHMM(b.startTime);
		const end = parseHHMM(b.endTime);
		const topPx = Math.max(0, (start - startHour) * 60);
		const heightPx = Math.max(28, (end - start) * 60);
		const colorHsl = getSubjectColor(b.subjectCode, theme);
		const arr = byDay.get(day) ?? [];
		arr.push({ block: b, topPx, heightPx, colorHsl, conflicts: conflictIds.has(b.id) });
		byDay.set(day, arr);
	}
	return byDay;
});
</script>

<div
	class="preview"
	style:--total-height="{totalHeight}px"
	role="region"
	aria-label="Vista previa del horario"
>
	<div class="preview__announce" aria-live="polite" aria-atomic="true">
		{#if conflictCount > 0}
			Tienes {conflictCount} {conflictCount === 1 ? "conflicto" : "conflictos"} de horario.
		{/if}
	</div>

	{#if conflictCount > 0}
		<div class="preview__alert">
			<Badge variant="danger" size="md" dot>
				<AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />
				{conflictCount} {conflictCount === 1 ? "conflicto" : "conflictos"} de horario
			</Badge>
		</div>
	{/if}

	<div class="preview__grid">
		<div class="preview__header-spacer" aria-hidden="true"></div>
		{#each DAY_LETTERS as letter (letter)}
			<div class="preview__day-header">
				<span class="preview__day-letter">{letter}</span>
			</div>
		{/each}

		<div class="preview__hours" aria-hidden="true">
			{#each HOURS as hour (hour)}
				<div class="preview__hour">
					<span class="preview__hour-label">{String(hour).padStart(2, "0")}:00</span>
				</div>
			{/each}
		</div>

		{#each DAY_LETTERS as letter (letter)}
			<div class="preview__day">
				{#each HOURS as hour (hour)}
					<div class="preview__row-line" aria-hidden="true"></div>
				{/each}
				{#each positioned.get(letter) ?? [] as item (`${item.block.id}-${item.block.kind}`)}
					<div
						class="preview__block"
						class:preview__block--candidate={item.block.kind === "candidate"}
						class:preview__block--conflict={item.conflicts}
						style:top="{item.topPx}px"
						style:height="{item.heightPx}px"
						style:background-color={item.colorHsl}
						aria-label={item.conflicts
							? `Conflicto: ${item.block.subjectCode} ${item.block.subjectName} ${item.block.startTime} a ${item.block.endTime}`
							: `${item.block.subjectCode} ${item.block.subjectName} ${item.block.startTime} a ${item.block.endTime} en ${item.block.classroom}`}
					>
						<div class="preview__block-inner">
							<span class="preview__block-code">{item.block.subjectCode}</span>
							{#if item.heightPx >= 48}
								<span class="preview__block-name">{item.block.subjectName}</span>
							{/if}
							<span class="preview__block-meta">
								{item.block.startTime}–{item.block.endTime}
								{item.heightPx >= 60 ? ` · ${item.block.classroom}` : ""}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
.preview {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	font-family: var(--font-sans);
	min-width: 0;
}

.preview__announce {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}

.preview__alert {
	display: flex;
	align-items: center;
	gap: var(--space-2);
}

.preview__grid {
	--col-count: 7;
	--gutter-width: 56px;
	display: grid;
	grid-template-columns: var(--gutter-width) repeat(var(--col-count), minmax(0, 1fr));
	grid-template-rows: 36px auto;
	gap: 0;
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
	overflow: hidden;
}

.preview__header-spacer {
	grid-column: 1;
	grid-row: 1;
	background-color: var(--surface-2);
	border-bottom: 1px solid var(--border-subtle);
	border-right: 1px solid var(--border-subtle);
}

.preview__day-header {
	grid-row: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: var(--space-1);
	background-color: var(--surface-2);
	border-bottom: 1px solid var(--border-subtle);
	font-size: var(--text-xs);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.preview__day-header + .preview__day-header {
	border-left: 1px solid var(--border-subtle);
}

.preview__day-letter {
	font-family: var(--font-mono);
}

.preview__hours {
	grid-column: 1;
	grid-row: 2;
	display: flex;
	flex-direction: column;
	border-right: 1px solid var(--border-subtle);
	background-color: var(--surface-1);
}

.preview__hour {
	height: 60px;
	display: flex;
	align-items: flex-start;
	justify-content: flex-end;
	padding: 2px var(--space-2);
	font-family: var(--font-mono);
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
}

.preview__day {
	grid-row: 2;
	position: relative;
	min-height: var(--total-height, 900px);
	background-color: var(--surface-1);
}

.preview__day + .preview__day {
	border-left: 1px solid var(--border-subtle);
}

.preview__row-line {
	height: 60px;
	border-bottom: 1px solid var(--border-subtle);
}

.preview__block {
	position: absolute;
	left: 4px;
	right: 4px;
	border-radius: var(--radius-2);
	padding: var(--space-1) var(--space-2);
	border: 1px solid color-mix(in srgb, var(--fg-primary) 8%, transparent);
	color: var(--fg-primary);
	overflow: hidden;
	transition:
		box-shadow var(--motion-duration-fast) var(--motion-ease-standard),
		transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.preview__block--candidate {
	/* Outline for new (uncommitted) selections: thicker left
		   border + dashed outline so the user can tell which
		   classes are about to be added. */
	border: 1.5px dashed var(--brand-500);
	border-left-width: 4px;
}

.preview__block--conflict {
	border: 1.5px solid var(--danger-500);
	border-left-width: 4px;
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--danger-500) 25%, transparent);
}

.preview__block-inner {
	display: flex;
	flex-direction: column;
	gap: 1px;
	height: 100%;
	min-height: 0;
}

.preview__block-code {
	font-family: var(--font-mono);
	font-size: var(--text-xs);
	font-weight: var(--weight-semibold);
	line-height: 1.2;
}

.preview__block-name {
	font-size: var(--text-xs);
	font-weight: var(--weight-medium);
	line-height: 1.2;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 1;
	line-clamp: 1;
	-webkit-box-orient: vertical;
}

.preview__block-meta {
	font-size: 10px;
	font-family: var(--font-mono);
	color: var(--fg-secondary);
	font-variant-numeric: tabular-nums;
	margin-top: auto;
}

@media (max-width: 720px) {
	.preview__grid {
		--gutter-width: 36px;
	}
	.preview__hour-label {
		display: none;
	}
}
</style>

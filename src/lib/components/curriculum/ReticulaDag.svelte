<!--
  OpenSIM — Retícula Académica DAG.

  Lays out subjects in a 9-column grid (one per semester, semesters
  1..9) and draws a Bézier connector between every (prereq -> subject)
  edge. Hovering a node highlights that subject plus all of its
  ancestors and descendants; everything else is dimmed.

  Performance contract (audit watchpoints):
    - `hoveredSubjectId` is the ONLY piece of reactive state for
      hover-driven highlight changes.
    - Adjacency map is built once in a $derived (not on every hover).
    - Ancestors / descendants for the hovered id are computed once
      per id-change and cached as Sets in a $derived. We do NOT
      re-traverse on `mouseenter` of every node.

  Deep-link contract (audit M6):
    - The parent passes `focusedCanonicalId`; when it changes
      (e.g. via a `#subject` hash from the Cmd+K palette), this
      component sets the hover to that id and scrolls the matching
      `<g id={canonicalId}>` into view. The `<g>` carries both
      `id` and `data-canonical-id` so the native fragment scroll
      works even before the $effect fires.
-->
<script lang="ts">
import { BookOpen } from "lucide-svelte";
import { EmptyState } from "#lib/components/ui";
import type { StudentProgressStatus } from "#lib/server/db/schema";
import { getSubjectColor } from "#lib/utils/color";
import { buildAdjacency, getAncestorsFromMap, getDescendantsFromMap } from "#lib/utils/dag";
import { getTheme } from "#lib/utils/theme.svelte";
import SubjectNode, { type SubjectViewModel } from "./SubjectNode.svelte";

export interface EdgeInput {
	from: string;
	to: string;
}

interface Props {
	subjects: SubjectViewModel[];
	edges: EdgeInput[];
	statusByCanonicalId: Record<string, StudentProgressStatus>;
	/**
	 * Canonical id of the subject the parent wants the DAG to
	 * focus (e.g. from `#${canonicalId}` in the URL). When this
	 * value changes, the DAG highlights that node and scrolls
	 * it into view. Pass `null` to clear.
	 */
	focusedCanonicalId?: string | null;
}

let { subjects, edges, statusByCanonicalId, focusedCanonicalId = null }: Props = $props();

const MAX_SEMESTER = 9;
const ROW_HEIGHT = 76; // matches NODE_HEIGHT
const ROW_GAP = 16;
const COLUMN_COUNT = 9;
const NODE_WIDTH = 168;
const NODE_HEIGHT = 76;
const COLUMN_GAP = 28;
const MARGIN_X = 32;
const MARGIN_Y = 56;

let hoveredSubjectId = $state<string | null>(null);

// Build adjacency map ONCE per (edges) input. O(E), not O(V+E) per
// hover — this is the key performance win vs. calling
// getAncestors/getDescendants per mouseenter.
const adjacency = $derived(buildAdjacency(edges));

// Group subjects by semester so we can compute positions and only
// iterate over the columns that actually exist. Subjects with
// `semester` outside 1..MAX_SEMESTER are logged to the console
// and dropped from the visible grid (audit M7, Round 4) — they
// were silently missing before, so a typo in the seed would
// not surface.
const subjectsBySemester = $derived.by(() => {
	const map = new Map<number, SubjectViewModel[]>();
	for (const s of subjects) {
		if (s.semester < 1 || s.semester > MAX_SEMESTER) {
			console.warn(
				`[ReticulaDag] Subject ${s.canonicalId} (${s.code}) has semester ${s.semester}, outside 1..${MAX_SEMESTER}; not rendered.`,
			);
			continue;
		}
		const arr = map.get(s.semester) ?? [];
		arr.push(s);
		map.set(s.semester, arr);
	}
	// Stable per-column ordering: by code so SSR + CSR agree.
	for (const arr of map.values()) {
		arr.sort((a, b) => a.code.localeCompare(b.code));
	}
	return map;
});

// Position map keyed by canonicalId for connector math.
const positionByCanonical = $derived.by(() => {
	const map = new Map<string, { x: number; y: number }>();
	for (let sem = 1; sem <= COLUMN_COUNT; sem++) {
		const col = subjectsBySemester.get(sem) ?? [];
		col.forEach((s, row) => {
			map.set(s.canonicalId, {
				x: MARGIN_X + (sem - 1) * (NODE_WIDTH + COLUMN_GAP),
				y: MARGIN_Y + row * (NODE_HEIGHT + ROW_GAP),
			});
		});
	}
	return map;
});

// Width is fixed (9 columns of fixed-width nodes). Height adapts
// to the tallest column, so a semester with 7+ subjects no longer
// clips (audit M7, Round 4).
const maxRowsPerColumn = $derived.by(() => {
	let max = 0;
	for (const arr of subjectsBySemester.values()) {
		if (arr.length > max) max = arr.length;
	}
	return max;
});

const svgWidth = $derived(
	MARGIN_X * 2 + COLUMN_COUNT * NODE_WIDTH + (COLUMN_COUNT - 1) * COLUMN_GAP,
);
const svgHeight = $derived(
	MARGIN_Y * 2 + maxRowsPerColumn * ROW_HEIGHT + Math.max(0, maxRowsPerColumn - 1) * ROW_GAP,
);

// Highlight sets computed in $derived so a hover only triggers one
// traversal pass (vs. one per ancestor/descendant).
const highlight = $derived.by(() => {
	const ancestors = new Set<string>();
	const descendants = new Set<string>();
	if (hoveredSubjectId) {
		for (const id of getAncestorsFromMap(hoveredSubjectId, adjacency)) ancestors.add(id);
		for (const id of getDescendantsFromMap(hoveredSubjectId, adjacency)) descendants.add(id);
	}
	return {
		highlighted: new Set(hoveredSubjectId ? [hoveredSubjectId, ...ancestors, ...descendants] : []),
		dimmed: hoveredSubjectId
			? new Set(
					subjects
						.map((s) => s.canonicalId)
						.filter((id) => id !== hoveredSubjectId && !ancestors.has(id) && !descendants.has(id)),
				)
			: new Set<string>(),
	};
});

// Connector paths. Computed once in $derived per (edges, position)
// change; the dim flag is recomputed per hovered id so a hover
// does not re-allocate the path string.
const connectors = $derived.by(() => {
	const paths: { d: string; dim: boolean }[] = [];
	for (const { from, to } of edges) {
		const a = positionByCanonical.get(from);
		const b = positionByCanonical.get(to);
		if (!a || !b) continue;
		const x1 = a.x + NODE_WIDTH;
		const y1 = a.y + NODE_HEIGHT / 2;
		const x2 = b.x;
		const y2 = b.y + NODE_HEIGHT / 2;
		const midX = (x1 + x2) / 2;
		const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
		const dim =
			hoveredSubjectId !== null &&
			!highlight.highlighted.has(from) &&
			!highlight.highlighted.has(to);
		paths.push({ d, dim });
	}
	return paths;
});

// Deep-link: when the parent hands us a new `focusedCanonicalId`
// (e.g. Cmd+K palette navigation reads `#subject` from the URL),
// set the hover to that id and scroll the corresponding node into
// view. We track the last-applied id so repeated renders with the
// same focus do not re-scroll.
let lastFocused: string | null = null;
$effect(() => {
	if (!focusedCanonicalId) {
		lastFocused = null;
		return;
	}
	if (focusedCanonicalId === lastFocused) return;
	lastFocused = focusedCanonicalId;
	hoveredSubjectId = focusedCanonicalId;
	if (typeof document !== "undefined") {
		const el = document.getElementById(focusedCanonicalId);
		el?.scrollIntoView({ behavior: "smooth", block: "center" });
	}
});

function setHover(id: string | null) {
	hoveredSubjectId = id;
}

function activate(id: string) {
	// Surface activation through the URL hash so Cmd+K palette
	// links land on a focused subject node without a full
	// navigation. The parent reads the hash and re-feeds it via
	// `focusedCanonicalId`.
	if (typeof window !== "undefined") {
		window.history.replaceState(null, "", `#${id}`);
	}
}
</script>

{#if subjects.length === 0}
	<div class="dag dag--empty">
		<EmptyState
			title="Retícula no disponible"
			description="No hay asignaturas en el catálogo para mostrar. La retícula se carga desde la base de datos curricular."
			icon={BookOpen}
		/>
	</div>
{:else}
	<div class="dag" role="figure" aria-label="Retícula académica interactiva">
		<svg
			class="dag__svg"
			viewBox="0 0 {svgWidth} {svgHeight}"
			width={svgWidth}
			height={svgHeight}
			xmlns="http://www.w3.org/2000/svg"
		>
			{#each Array.from({ length: COLUMN_COUNT }, (_, i) => i + 1) as sem (sem)}
				<text
					x={MARGIN_X + (sem - 1) * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2}
					y={MARGIN_Y - 16}
					class="dag__sem-label"
					text-anchor="middle"
				>
					Sem {sem}
				</text>
			{/each}

			{#each connectors as c, i (i)}
				<path
					d={c.d}
					class="dag__edge"
					class:dag__edge--dim={c.dim}
					fill="none"
					stroke-width="1.5"
				/>
			{/each}

			{#each subjects as s (s.canonicalId)}
				{@const pos = positionByCanonical.get(s.canonicalId)}
				{#if pos}
					{@const status = statusByCanonicalId[s.canonicalId] ?? "AVAILABLE"}
					<SubjectNode
						subject={s}
						{status}
						isHighlighted={highlight.highlighted.has(s.canonicalId)}
						isDimmed={highlight.dimmed.has(s.canonicalId)}
						x={pos.x}
						y={pos.y}
						width={NODE_WIDTH}
						height={NODE_HEIGHT}
						colorHsl={getSubjectColor(s.code, getTheme())}
						onHover={setHover}
						onActivate={activate}
					/>
				{/if}
			{/each}
		</svg>
	</div>
{/if}

<style>
.dag {
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
	padding: var(--space-3);
	overflow-x: auto;
	font-family: var(--font-sans);
}

.dag--empty {
	padding: var(--space-6);
}

.dag__svg {
	display: block;
	max-width: 100%;
	height: auto;
}

.dag__sem-label {
	font-family: var(--font-mono);
	font-size: 12px;
	font-weight: 600;
	fill: var(--fg-tertiary);
	text-transform: uppercase;
	letter-spacing: 0.06em;
}

:global(.dag__edge) {
	stroke: var(--border-default);
	transition: stroke var(--motion-duration-fast) var(--motion-ease-standard);
}

:global(.dag__edge--dim) {
	stroke: var(--border-subtle);
	opacity: 0.35;
}
</style>

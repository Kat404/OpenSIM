<!--
  OpenSIM — Retícula Académica DAG.

  Lays out subjects in a 9-column grid (one per semester, semesters
  1..9) and draws a Bézier connector between every (prereq -> subject)
  edge. Hovering a node highlights that subject plus all of its
  ancestors and descendants; everything else is dimmed.

  Performance contract (audit watchpoints):
    - `hoveredSubjectId` is the ONLY piece of reactive state.
    - Adjacency map is built once in a $derived (not on every hover).
    - Ancestors / descendants for the hovered id are computed once
      per id-change and cached as Sets in a $derived. We do NOT
      re-traverse on `mouseenter` of every node.
-->
<script lang="ts">
	import { buildAdjacency, getAncestorsFromMap, getDescendantsFromMap } from '#lib/utils/dag';
	import { getSubjectColorHSL } from '#lib/utils/color';
	import type { StudentProgressStatus } from '#lib/server/db/schema';
	import SubjectNode, { type SubjectViewModel } from './SubjectNode.svelte';

	export interface EdgeInput {
		from: string;
		to: string;
	}

	interface Props {
		subjects: SubjectViewModel[];
		edges: EdgeInput[];
		statusByCanonicalId: Record<string, StudentProgressStatus>;
	}

	let { subjects, edges, statusByCanonicalId }: Props = $props();

	const SUBJECTS_PER_COLUMN = 6;
	const COLUMN_COUNT = 9;
	const NODE_WIDTH = 168;
	const NODE_HEIGHT = 76;
	const COLUMN_GAP = 28;
	const ROW_GAP = 16;
	const MARGIN_X = 32;
	const MARGIN_Y = 56;

	let hoveredSubjectId = $state<string | null>(null);

	// Build adjacency map ONCE per (edges) input. O(E), not O(V+E) per
	// hover — this is the key performance win vs. calling
	// getAncestors/getDescendants per mouseenter.
	const adjacency = $derived(buildAdjacency(edges));

	// Group subjects by semester so we can compute positions and only
	// iterate over the columns that actually exist.
	const subjectsBySemester = $derived.by(() => {
		const map = new Map<number, SubjectViewModel[]>();
		for (const s of subjects) {
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
					y: MARGIN_Y + row * (NODE_HEIGHT + ROW_GAP)
				});
			});
		}
		return map;
	});

	const svgWidth = $derived(
		MARGIN_X * 2 + COLUMN_COUNT * NODE_WIDTH + (COLUMN_COUNT - 1) * COLUMN_GAP
	);
	const svgHeight = $derived(
		MARGIN_Y * 2 + SUBJECTS_PER_COLUMN * NODE_HEIGHT + (SUBJECTS_PER_COLUMN - 1) * ROW_GAP
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
			highlighted: new Set(
				hoveredSubjectId
					? [hoveredSubjectId, ...ancestors, ...descendants]
					: []
			),
			dimmed: hoveredSubjectId
				? new Set(
						subjects
							.map((s) => s.canonicalId)
							.filter(
								(id) =>
									id !== hoveredSubjectId &&
									!ancestors.has(id) &&
									!descendants.has(id)
							)
					)
				: new Set<string>()
		};
	});

	// Connector paths. Computed once in $derived per (edges, position)
	// change; the result is an array of static strings so we never
	// re-build them on hover.
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

	function setHover(id: string | null) {
		hoveredSubjectId = id;
	}

	function activate(id: string) {
		// Surface activation through the URL hash so Cmd+K palette
		// links land on a focused subject node without a full
		// navigation.
		if (typeof window !== 'undefined') {
			window.history.replaceState(null, '', `#${id}`);
		}
	}
</script>

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
			>Sem {sem}</text>
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
				{@const status = statusByCanonicalId[s.canonicalId] ?? 'AVAILABLE'}
				<SubjectNode
					subject={s}
					{status}
					isHighlighted={highlight.highlighted.has(s.canonicalId)}
					isDimmed={highlight.dimmed.has(s.canonicalId)}
					x={pos.x}
					y={pos.y}
					width={NODE_WIDTH}
					height={NODE_HEIGHT}
					colorHsl={getSubjectColorHSL(s.code)}
					onHover={setHover}
					onActivate={activate}
				/>
			{/if}
		{/each}
	</svg>
</div>

<style>
	.dag {
		background-color: var(--surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-3);
		padding: var(--space-3);
		overflow-x: auto;
		font-family: var(--font-sans);
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
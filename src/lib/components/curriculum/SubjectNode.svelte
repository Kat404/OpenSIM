<!--
  OpenSIM — Single subject card rendered inside the retícula SVG.

  The whole DAG is one big <svg> so each subject is an SVG <g>
  containing a rect (filled with the HSL-hash color when neutral,
  or with a stronger brand wash when highlighted) plus text labels.
  The parent passes pre-computed highlight / dim flags so this
  component does not need to look up status from any global state.
-->
<script lang="ts">
	import type { StudentProgressStatus } from '#lib/server/db/schema';

	export interface SubjectViewModel {
		canonicalId: string;
		code: string;
		name: string;
		semester: number;
		credits: number;
	}

	interface Props {
		subject: SubjectViewModel;
		status: StudentProgressStatus;
		isHighlighted: boolean;
		isDimmed: boolean;
		x: number;
		y: number;
		width: number;
		height: number;
		colorHsl: string;
		onHover?: (id: string | null) => void;
		onActivate?: (id: string) => void;
	}

	let {
		subject,
		status,
		isHighlighted,
		isDimmed,
		x,
		y,
		width,
		height,
		colorHsl,
		onHover,
		onActivate
	}: Props = $props();

	const STATUS_LABEL: Record<StudentProgressStatus, string> = {
		APPROVED: 'Aprobada',
		ENROLLED: 'Cursando',
		AVAILABLE: 'Disponible',
		LOCKED: 'Bloqueada'
	};

	// Highlighted nodes get the saturated brand color; everything else
	// uses the HSL-hash pastel. Locked subjects overlay a diagonal
	// hatch by reducing opacity (rendered as <pattern> would be nicer
	// but a stroked overlay line keeps the SVG DOM small).
	const fill = $derived(isHighlighted ? 'var(--brand-100)' : colorHsl);
	const stroke = $derived(isHighlighted ? 'var(--brand-500)' : 'var(--border-default)');
	const strokeWidth = $derived(isHighlighted ? 2 : 1);
	const opacity = $derived(isDimmed ? 0.35 : 1);
	const statusText = $derived(STATUS_LABEL[status]);
</script>

<g
	class="node"
	class:node--highlighted={isHighlighted}
	class:node--dimmed={isDimmed}
	opacity={opacity}
	data-canonical-id={subject.canonicalId}
	role="button"
	tabindex="0"
	aria-label="{subject.code} — {subject.name}. Semestre {subject.semester}. {subject.credits} créditos. {statusText}."
	onmouseenter={() => onHover?.(subject.canonicalId)}
	onmouseleave={() => onHover?.(null)}
	onfocus={() => onHover?.(subject.canonicalId)}
	onblur={() => onHover?.(null)}
	onclick={() => onActivate?.(subject.canonicalId)}
	onkeydown={(e: KeyboardEvent) => {
		if ((e.key === 'Enter' || e.key === ' ') && onActivate) {
			e.preventDefault();
			onActivate(subject.canonicalId);
		}
	}}
>
	<rect
		{x}
		{y}
		{width}
		{height}
		rx="6"
		ry="6"
		fill={fill}
		stroke={stroke}
		stroke-width={strokeWidth}
	/>
	<text
		x={x + width / 2}
		y={y + 20}
		class="node__code"
		text-anchor="middle"
	>
		{subject.code}
	</text>
	<text
		x={x + width / 2}
		y={y + 38}
		class="node__name"
		text-anchor="middle"
	>
		{subject.name.length > 26 ? subject.name.slice(0, 25) + '…' : subject.name}
	</text>
	<text
		x={x + width / 2}
		y={y + 56}
		class="node__meta"
		text-anchor="middle"
	>
		S{subject.semester} · {subject.credits}cr · {statusText}
	</text>
</g>

<style>
	.node {
		cursor: pointer;
		font-family: var(--font-sans);
		transition: opacity var(--motion-duration-fast) var(--motion-ease-standard);
	}

	.node__code {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		fill: var(--fg-primary);
	}

	.node__name {
		font-size: 12px;
		font-weight: 500;
		fill: var(--fg-primary);
	}

	.node__meta {
		font-size: 10px;
		fill: var(--fg-tertiary);
		font-family: var(--font-mono);
	}

	.node:focus-visible rect {
		stroke: var(--brand-500);
		stroke-width: 2;
	}
</style>
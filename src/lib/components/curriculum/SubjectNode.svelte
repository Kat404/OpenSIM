<!--
  OpenSIM — Single subject card rendered inside the retícula SVG.

  The whole DAG is one big <svg> so each subject is an SVG <g>
  containing a rect (filled with the HSL-hash color when neutral,
  or with a stronger brand wash when highlighted) plus text labels.
  The parent passes pre-computed highlight / dim flags so this
  component does not need to look up status from any global state.
-->
<script lang="ts">
import type {
	StudentProgressStatus,
	SubjectComponent,
	SubjectSeriationState,
} from "#lib/server/db/schema";
import { STATUS_LABEL } from "#lib/utils/status-labels";

export interface SubjectViewModel {
	canonicalId: string;
	code: string;
	name: string;
	/** `null` when the plan does not state the semester. True for all 16
	 * specialty modules in v1 (H8), so it is a routine value, not an edge
	 * case: the DAG cannot place those subjects on the grid. */
	semester: number | null;
	credits: number;
	/** Stored tri-state. `UNKNOWN` means "not established from a source",
	 * NOT "not serialized" — the node renders all three differently. */
	seriationState: SubjectSeriationState;
	/** `SPECIALTY` is the only component whose missing semester is expected;
	 * every other component without one is a data defect and warns. */
	component: SubjectComponent;
	/** Derived from `course_groups.has_lab`: the subject has at least one
	 * group with a dedicated laboratory. */
	hasLab: boolean;
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
	/** One sentence describing the subject's place in a seriation chain, or
	 * `""` when the stored tri-state carries nothing to say. Resolved by
	 * `ReticulaDag` so the chain decomposition is built once per render
	 * instead of once per node. */
	seriationText?: string;
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
	seriationText = "",
	onHover,
	onActivate,
}: Props = $props();

// Highlighted nodes get the saturated brand color; everything else
// uses the HSL-hash pastel. Locked subjects overlay a diagonal
// hatch by reducing opacity (rendered as <pattern> would be nicer
// but a stroked overlay line keeps the SVG DOM small).
const fill = $derived(isHighlighted ? "var(--brand-100)" : colorHsl);
const stroke = $derived(isHighlighted ? "var(--brand-500)" : "var(--border-default)");
const strokeWidth = $derived(isHighlighted ? 2 : 1);
const opacity = $derived(isDimmed ? 0.35 : 1);
const statusText = $derived(STATUS_LABEL[status]);
// `ReticulaDag` filters unplaced subjects out, so this only renders for a
// subject that does have a semester. Guarded anyway: the type permits null
// and an unrendered "S" would be worse than an explicit dash.
const semesterText = $derived(
	subject.semester === null ? "Semestre sin registrar" : `Semestre ${subject.semester}`,
);
const semesterLabel = $derived(subject.semester === null ? "S—" : `S${subject.semester}`);
// The SIM's flask marker, as one token inside the meta line. A dedicated
// badge would mean 68 extra <g> nodes to mark the six that qualify.
const labText = $derived(subject.hasLab ? "Con grupo de laboratorio." : "");
const metaText = $derived(
	`${semesterLabel} · ${subject.credits}cr${subject.hasLab ? " · LAB" : ""} · ${statusText}`,
);
</script>

<g
	class="node"
	class:node--highlighted={isHighlighted}
	class:node--dimmed={isDimmed}
	{opacity}
	id={subject.canonicalId}
	data-canonical-id={subject.canonicalId}
	role="button"
	tabindex="0"
	aria-label="{subject.code} — {subject.name}. {semesterText}. {subject.credits} créditos. {statusText}. {labText} {seriationText}"
	onmouseenter={() => onHover?.(subject.canonicalId)}
	onmouseleave={() => onHover?.(null)}
	onfocus={() => onHover?.(subject.canonicalId)}
	onblur={() => onHover?.(null)}
	onclick={() => onActivate?.(subject.canonicalId)}
	onkeydown={(e: KeyboardEvent) => {
		if ((e.key === "Enter" || e.key === " ") && onActivate) {
			e.preventDefault();
			onActivate(subject.canonicalId);
		}
	}}
>
	{#if seriationText}
		<!-- Native SVG tooltip. The seriation branch is an attribute of the
		     subject, not a badge: 24 UNKNOWN nodes would not survive one. -->
		<title>{seriationText}</title>
	{/if}
	<rect {x} {y} {width} {height} rx="6" ry="6" {fill} {stroke} stroke-width={strokeWidth} />
	<text x={x + width / 2} y={y + 20} class="node__code" text-anchor="middle">
		{subject.code}
	</text>
	<text x={x + width / 2} y={y + 38} class="node__name" text-anchor="middle">
		{subject.name.length > 26 ? `${subject.name.slice(0, 25)}…` : subject.name}
	</text>
	<text x={x + width / 2} y={y + 56} class="node__meta" text-anchor="middle">
		{metaText}
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

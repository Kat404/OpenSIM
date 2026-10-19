<!--
  OpenSIM — Kardex unificado.

  Filter pills (Todos / Ordinario / Repetición / Especial) + the
  Table atom. The atom owns the column sort UI; this component owns
  the evaluation-type filter. Grade badges use semantic colors per
  the spec — APPROVED green, FAILED red, IN_PROGRESS amber — driven
  by `isPassing` from `#lib/utils/academic` so the 6.0 threshold
  cannot drift.

  Status labels and grades share the same source of truth as the
  retícula (`STATUS_LABEL`).
-->
<script lang="ts">
import { Badge, Table } from "#lib/components/ui";
import type { StudentProgressStatus } from "#lib/server/db/schema";
import { EVALUATION_TYPES, type EvaluationType, isPassing } from "#lib/utils/academic";
import { EVALUATION_LABEL, STATUS_LABEL } from "#lib/utils/status-labels";

export interface KardexEntry {
	code: string;
	name: string;
	grade: number | null;
	credits: number;
	period: string;
	evaluationType: EvaluationType | null;
	status: StudentProgressStatus;
}

interface Props {
	entries: KardexEntry[];
}

let { entries }: Props = $props();

// Filter state lives locally; the page does not need to know
// about it. The Table atom owns the sort UI internally.
let filter = $state<"ALL" | EvaluationType>("ALL");

// Filter pills share their labels with the cell renderer through
// EVALUATION_LABEL so they can never drift (audit L3, Round 6).
const filterOptions: { key: "ALL" | EvaluationType; label: string }[] = [
	{ key: "ALL", label: "Todos" },
	...EVALUATION_TYPES.map((t) => ({ key: t, label: EVALUATION_LABEL[t] })),
];

const filtered = $derived(
	filter === "ALL" ? entries : entries.filter((e) => e.evaluationType === filter),
);

function gradeBadgeVariant(grade: number | null) {
	if (grade == null) return "neutral" as const;
	if (isPassing(grade)) return "success" as const;
	return "danger" as const;
}

/**
 * A subject with no grade has a HOLE, not a state.
 *
 * This used to say "En curso" for every row without a grade, which put a
 * status word in a column that holds grades — and made the row contradict
 * itself: the three approved complementary subjects (ITM-100, ITM-104,
 * ITM-105, evaluated without a 0–10 grade) and the two locked ones said
 * "En curso" while the Estado column beside them said "Aprobado" or
 * "Bloqueado". The Estado column carries the state; this one carries the
 * grade, and the sibling Evaluación column already renders a missing value
 * as "—".
 */
function gradeText(grade: number | null): string {
	return grade == null ? "—" : grade.toFixed(1);
}

function statusBadgeVariant(status: StudentProgressStatus) {
	if (status === "APPROVED") return "success" as const;
	if (status === "ENROLLED") return "brand" as const;
	if (status === "LOCKED") return "danger" as const;
	return "neutral" as const;
}

function evalLabel(t: EvaluationType | null): string {
	return t ? EVALUATION_LABEL[t] : "—";
}
</script>

<!-- Snippet definitions live at the top of the template so the column
     declarations below (in the {#if} branch) can reference them. -->
{#snippet gradeCell(
	e: KardexEntry,
)}
	<Badge variant={gradeBadgeVariant(e.grade)} size="sm">
		{gradeText(e.grade)}
	</Badge>
{/snippet}

{#snippet evalCell(
	e: KardexEntry,
)}
	<span class="kardex__eval">{evalLabel(e.evaluationType)}</span>
{/snippet}

{#snippet statusCell(
	e: KardexEntry,
)}
	<Badge variant={statusBadgeVariant(e.status)} size="sm">
		{STATUS_LABEL[e.status]}
	</Badge>
{/snippet}

<section class="kardex">
	<div class="kardex__filters" role="group" aria-label="Filtros de evaluación">
		{#each filterOptions as opt (opt.key)}
			<button
				type="button"
				class="kardex__filter"
				class:kardex__filter--active={filter === opt.key}
				aria-pressed={filter === opt.key}
				onclick={() => (filter = opt.key)}
			>
				{opt.label}
			</button>
		{/each}
	</div>

	{#if entries.length === 0}
		<p class="kardex__empty">Aún no tienes asignaturas registradas en tu kardex.</p>
	{:else if filtered.length === 0}
		<p class="kardex__empty">Sin resultados con el filtro seleccionado.</p>
	{:else}
		{@const columns = [
			{ key: "code", label: "Clave", sortable: true },
			{ key: "name", label: "Asignatura", sortable: true },
			{ key: "credits", label: "Cr", sortable: true, align: "right" as const },
			{ key: "period", label: "Periodo", sortable: true },
			{
				key: "grade",
				label: "Calificación",
				sortable: true,
				align: "right" as const,
				render: gradeCell,
			},
			{
				key: "evaluationType",
				label: "Evaluación",
				sortable: true,
				render: evalCell,
			},
			{ key: "status", label: "Estado", sortable: true, render: statusCell },
		]}
		<Table {columns} rows={filtered} sortable />
	{/if}
</section>

<style>
.kardex {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}

.kardex__filters {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
}

.kardex__filter {
	padding: var(--space-1) var(--space-3);
	height: 32px;
	font: inherit;
	font-size: var(--text-sm);
	font-weight: var(--weight-medium);
	color: var(--fg-secondary);
	background-color: var(--surface-1);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-2);
	cursor: pointer;
	transition:
		background-color var(--motion-duration-fast) var(--motion-ease-standard),
		color var(--motion-duration-fast) var(--motion-ease-standard),
		border-color var(--motion-duration-fast) var(--motion-ease-standard);
}

.kardex__filter:hover {
	background-color: var(--surface-2);
	color: var(--fg-primary);
}

.kardex__filter--active {
	background-color: var(--brand-50);
	color: var(--brand-700);
	border-color: var(--brand-500);
}

.kardex__eval {
	font-size: var(--text-sm);
	color: var(--fg-secondary);
}

.kardex__empty {
	margin: 0;
	padding: var(--space-6);
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
	text-align: center;
	color: var(--fg-tertiary);
	font-style: italic;
}
</style>

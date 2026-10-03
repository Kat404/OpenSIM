<!--
  OpenSIM — Kardex unificado.

  Wraps the existing Table atom with a local sort-by-any-column state
  and an evaluationType filter pill row. Grade badges use semantic
  colors per the spec — APPROVED green, FAILED red, IN_PROGRESS amber.
  Sort + filter state live here (local) so the page stays dumb.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Table, Badge } from '#lib/components/ui';
	import type { EvaluationType, StudentProgressStatus } from '#lib/server/db/schema';
	import { isPassing } from '#lib/utils/academic';

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

	// Sort + filter state live locally. The page does not need to
	// know about either: the parent passes the raw `entries`, we
	// return the rendered rows via the Table atom.
	let sortKey = $state<string | null>(null);
	let sortDir = $state<'asc' | 'desc' | null>(null);
	let filter = $state<'ALL' | EvaluationType>('ALL');

	const filtered = $derived(
		filter === 'ALL' ? entries : entries.filter((e) => e.evaluationType === filter)
	);

	const sorted = $derived.by(() => {
		if (!sortKey || !sortDir) return filtered;
		const copy = [...filtered];
		copy.sort((a, b) => {
			const av = (a as unknown as Record<string, unknown>)[sortKey!];
			const bv = (b as unknown as Record<string, unknown>)[sortKey!];
			if (av === bv) return 0;
			if (av == null) return 1;
			if (bv == null) return -1;
			const cmp = av > bv ? 1 : -1;
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return copy;
	});

	function toggleSort(key: string) {
		if (sortKey !== key) {
			sortKey = key;
			sortDir = 'asc';
		} else if (sortDir === 'asc') {
			sortDir = 'desc';
		} else {
			sortKey = null;
			sortDir = null;
		}
	}

	function gradeBadgeVariant(grade: number | null, status: StudentProgressStatus) {
		if (status === 'ENROLLED' || grade == null) return 'warning' as const;
		if (isPassing(grade)) return 'success' as const;
		return 'danger' as const;
	}

	function gradeText(grade: number | null, status: StudentProgressStatus): string {
		if (status === 'ENROLLED' || grade == null) return 'En curso';
		return grade.toFixed(1);
	}

	function statusBadgeVariant(status: StudentProgressStatus) {
		if (status === 'APPROVED') return 'success' as const;
		if (status === 'ENROLLED') return 'brand' as const;
		if (status === 'LOCKED') return 'danger' as const;
		return 'neutral' as const;
	}

	function statusLabel(status: StudentProgressStatus): string {
		return {
			APPROVED: 'Aprobada',
			ENROLLED: 'Cursando',
			AVAILABLE: 'Disponible',
			LOCKED: 'Bloqueada'
		}[status];
	}

	function evalLabel(t: EvaluationType | null): string {
		if (!t) return '—';
		return {
			ORDINARIO: 'Ordinario',
			REPETICION: 'Repetición',
			ESPECIAL: 'Especial'
		}[t];
	}
</script>

<!-- Snippet definitions live at the top of the template so the column
     declarations below (in the {#if} branch) can reference them. -->
{#snippet gradeCell(e: KardexEntry)}
	<Badge variant={gradeBadgeVariant(e.grade, e.status)} size="sm">
		{gradeText(e.grade, e.status)}
	</Badge>
{/snippet}

{#snippet evalCell(e: KardexEntry)}
	<span class="kardex__eval">{evalLabel(e.evaluationType)}</span>
{/snippet}

{#snippet statusCell(e: KardexEntry)}
	<Badge variant={statusBadgeVariant(e.status)} size="sm">
		{statusLabel(e.status)}
	</Badge>
{/snippet}

<section class="kardex">
	<div class="kardex__filters" role="group" aria-label="Filtros de evaluación">
		{#each [
			{ key: 'ALL', label: 'Todos' },
			{ key: 'ORDINARIO', label: 'Ordinario' },
			{ key: 'REPETICION', label: 'Repetición' },
			{ key: 'ESPECIAL', label: 'Especial' }
		] as opt (opt.key)}
			<button
				type="button"
				class="kardex__filter"
				class:kardex__filter--active={filter === opt.key}
				aria-pressed={filter === opt.key}
				onclick={() => (filter = opt.key as 'ALL' | EvaluationType)}
			>
				{opt.label}
			</button>
		{/each}
	</div>

	{#if entries.length === 0}
		<p class="kardex__empty">Aún no tienes asignaturas registradas en tu kardex.</p>
	{:else if sorted.length === 0}
		<p class="kardex__empty">Sin resultados con el filtro seleccionado.</p>
	{:else}
		{@const columns = [
			{ key: 'code', label: 'Clave', sortable: true },
			{ key: 'name', label: 'Asignatura', sortable: true },
			{ key: 'credits', label: 'Cr', sortable: true, align: 'right' as const },
			{ key: 'period', label: 'Periodo', sortable: true },
			{
				key: 'grade',
				label: 'Calificación',
				sortable: true,
				align: 'right' as const,
				render: gradeCell
			},
			{
				key: 'evaluationType',
				label: 'Evaluación',
				sortable: true,
				render: evalCell
			},
			{ key: 'status', label: 'Estado', sortable: true, render: statusCell }
		]}
		<Table {columns} rows={sorted} sortable />
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
<!--
  OpenSIM — Course filter panel for the Reinscripción simulator.

  A controlled component: the parent owns the `query`, `area`, and
  `credits` runes and the filter panel renders the inputs. The
  parent does the actual filtering (Svelte 5 runes handle
  reactivity without a separate store).

  Filters:
    - Free-text search (code + name, case-insensitive)
    - Subject area (single-select)
    - Credits (single-select: all, ≤4, =5)
    - "Only show conflicts" toggle (parent reads this to flag rows)

  The components are typed in English (per convention §13); UI copy
  is Spanish.
-->
<script lang="ts">
	import { Input, Select, Badge } from '#lib/components/ui';
	import { Filter } from 'lucide-svelte';

	interface Props {
		areas: string[];
		query: string;
		area: string;
		credits: '' | 'lt5' | 'eq5';
		onlyConflicts: boolean;
		totalCount: number;
		filteredCount: number;
	}

	let {
		areas,
		query = $bindable(''),
		area = $bindable(''),
		credits = $bindable<'' | 'lt5' | 'eq5'>(''),
		onlyConflicts = $bindable(false),
		totalCount,
		filteredCount
	}: Props = $props();

	const areaOptions = $derived([
		{ value: '', label: 'Todas las áreas' },
		...areas.map((a) => ({ value: a, label: a }))
	]);

	const creditOptions = [
		{ value: '', label: 'Todos los créditos' },
		{ value: 'lt5', label: 'Menos de 5 créditos' },
		{ value: 'eq5', label: '5 créditos' }
	];
</script>

<section class="filter" aria-label="Filtros de la oferta académica">
	<header class="filter__header">
		<h2 class="filter__title">
			<Filter size={16} strokeWidth={1.75} aria-hidden="true" />
			Filtrar oferta
		</h2>
		<Badge variant="neutral" size="sm">
			{filteredCount} / {totalCount} grupos
		</Badge>
	</header>

	<div class="filter__row">
		<Input
			label="Buscar"
			type="search"
			placeholder="Código o nombre de la asignatura"
			bind:value={query}
		/>
	</div>

	<div class="filter__row">
		<Select label="Área" options={areaOptions} bind:value={area} />
	</div>

	<div class="filter__row">
		<Select
			label="Créditos"
			options={creditOptions}
			bind:value={credits}
		/>
	</div>

	<label class="filter__toggle">
		<input type="checkbox" bind:checked={onlyConflicts} />
		<span>Solo grupos con conflicto de horario</span>
	</label>
</section>

<style>
	.filter {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		background-color: var(--surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-3);
		font-family: var(--font-sans);
		min-width: 0;
	}

	.filter__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.filter__title {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.filter__row {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.filter__toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		cursor: pointer;
	}

	.filter__toggle input {
		cursor: pointer;
	}
</style>

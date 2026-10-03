<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface Column<Row> {
		key: string;
		label: string;
		sortable?: boolean;
		align?: 'left' | 'right' | 'center';
		render?: Snippet<[Row]>;
	}

	interface Props {
		columns: Column<T>[];
		rows: T[];
		caption?: string;
		emptyText?: string;
		dense?: boolean;
		sortable?: boolean;
	}

	let {
		columns,
		rows,
		caption,
		emptyText = 'Sin datos',
		dense = false,
		sortable = false
	}: Props = $props();

	type SortDir = 'asc' | 'desc' | null;
	let sortKey = $state<string | null>(null);
	let sortDir = $state<SortDir>(null);

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

	const sortedRows = $derived.by(() => {
		if (!sortKey || !sortDir) return rows;
		const copy = [...rows];
		copy.sort((a, b) => {
			const av = (a as Record<string, unknown>)[sortKey!];
			const bv = (b as Record<string, unknown>)[sortKey!];
			if (av === bv) return 0;
			if (av == null) return 1;
			if (bv == null) return -1;
			const cmp = av > bv ? 1 : -1;
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return copy;
	});

	const sortIcon = (key: string) => {
		if (sortKey !== key) return '↕';
		return sortDir === 'asc' ? '↑' : '↓';
	};
</script>

<table class="table" class:table--dense={dense}>
	{#if caption}
		<caption class="table__caption">{caption}</caption>
	{/if}
	<thead class="table__head">
		<tr>
			{#each columns as col (col.key)}
				<th
					class="table__th"
					class:table__th--sortable={(col.sortable ?? sortable)}
					style:text-align={col.align ?? 'left'}
					aria-sort={sortKey === col.key
						? sortDir === 'asc'
							? 'ascending'
							: 'descending'
						: 'none'}
				>
					{#if (col.sortable ?? sortable)}
						<button
							type="button"
							class="table__sort-btn"
							onclick={() => toggleSort(col.key)}
							aria-label="Ordenar por {col.label}"
						>
							<span>{col.label}</span>
							<span class="table__sort-icon" aria-hidden="true">{sortIcon(col.key)}</span>
						</button>
					{:else}
						{col.label}
					{/if}
				</th>
			{/each}
		</tr>
	</thead>
	<tbody class="table__body">
		{#each sortedRows as row, i (i)}
			<tr class="row">
					{#each columns as col (col.key)}
						<td class="table__td" style:text-align={col.align ?? 'left'}>
							{#if col.render}
								{@render col.render(row)}
							{:else}
								{(row as Record<string, unknown>)[col.key] ?? ''}
							{/if}
						</td>
					{/each}
				</tr>
		{:else}
			<tr>
				<td class="table__empty" colspan={columns.length}>{emptyText}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}

	.table__caption {
		caption-side: top;
		text-align: left;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
		padding-bottom: var(--space-2);
	}

	.table__head {
		background-color: var(--surface-2);
	}

	.table__th {
		padding: var(--space-2) var(--space-3);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
		border-bottom: 1px solid var(--border-default);
		white-space: nowrap;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.table--dense .table__th {
		padding: var(--space-1) var(--space-2);
	}

	.table__th--sortable {
		padding: 0;
	}

	.table__sort-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		width: 100%;
		background: transparent;
		border: none;
		color: inherit;
		font: inherit;
		text-transform: inherit;
		letter-spacing: inherit;
		cursor: pointer;
		text-align: left;
	}

	.table__sort-btn:hover {
		background-color: var(--surface-3);
	}

	.table__sort-icon {
		font-size: var(--text-xs);
		color: var(--fg-tertiary);
	}

	.table__body .row {
		background-color: var(--surface-1);
		transition: background-color var(--motion-duration-fast) var(--motion-ease-standard);
	}

	.table__body .row:hover {
		background-color: var(--surface-2);
	}

	.table__td {
		padding: var(--space-3);
		border-bottom: 1px solid var(--border-subtle);
		color: var(--fg-secondary);
	}

	.table--dense .table__td {
		padding: var(--space-2) var(--space-3);
	}

	.table__empty {
		padding: var(--space-6);
		text-align: center;
		color: var(--fg-tertiary);
		font-style: italic;
	}
</style>
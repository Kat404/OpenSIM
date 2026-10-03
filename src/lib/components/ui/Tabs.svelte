<script lang="ts">
	import type { Snippet } from 'svelte';

	export interface Tab {
		id: string;
		label: string;
		badge?: string | number;
		disabled?: boolean;
	}

	interface Props {
		tabs: Tab[];
		value?: string;
		variant?: 'underline' | 'pill';
		size?: 'sm' | 'md';
		children?: Snippet<[string]>;
		onChange?: (id: string) => void;
	}

	let {
		tabs,
		value = $bindable(tabs[0]?.id ?? ''),
		variant = 'underline',
		size = 'md',
		children,
		onChange
	}: Props = $props();

	const activeTab = $derived(tabs.find((t) => t.id === value));

	function activate(id: string) {
		value = id;
		onChange?.(id);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
		const idx = tabs.findIndex((t) => t.id === value);
		if (idx === -1) return;
		const dir = e.key === 'ArrowRight' ? 1 : -1;
		for (let i = 1; i <= tabs.length; i++) {
			const nextIdx = (idx + dir * i + tabs.length) % tabs.length;
			const next = tabs[nextIdx];
			if (next && !next.disabled) {
				activate(next.id);
				(e.currentTarget as HTMLElement)
					.querySelector<HTMLElement>(`[data-tab-id="${next.id}"]`)
					?.focus();
				break;
			}
		}
	}
</script>

<div class="tabs tabs--{variant} tabs--{size}" role="tablist" aria-orientation="horizontal">
	{#each tabs as tab (tab.id)}
		<button
			type="button"
			role="tab"
			id="trigger-{tab.id}"
			class="tabs__trigger"
			class:tabs__trigger--active={tab.id === value}
			aria-selected={tab.id === value}
			aria-controls="panel-{tab.id}"
			disabled={tab.disabled}
			data-tab-id={tab.id}
			onclick={() => activate(tab.id)}
			onkeydown={onKeydown}
		>
			<span>{tab.label}</span>
			{#if tab.badge !== undefined}<span class="tabs__badge">{tab.badge}</span>{/if}
		</button>
	{/each}
</div>

{#if activeTab}
	<div
		class="tabs__panel"
		role="tabpanel"
		id="panel-{activeTab.id}"
		aria-labelledby="trigger-{activeTab.id}"
	>
		{@render children?.(activeTab.id)}
	</div>
{/if}

<style>
	.tabs {
		display: flex;
		font-family: var(--font-sans);
	}

	.tabs--underline {
		flex-direction: row;
		gap: 0;
		border-bottom: 1px solid var(--border-subtle);
	}

	.tabs--pill {
		flex-direction: row;
		gap: var(--space-1);
		padding: var(--space-1);
		background-color: var(--surface-2);
		border-radius: var(--radius-3);
		border: 1px solid var(--border-subtle);
	}

	.tabs__trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		background: transparent;
		border: none;
		color: var(--fg-secondary);
		font-family: inherit;
		font-weight: var(--weight-medium);
		cursor: pointer;
		transition:
			color var(--motion-duration-fast) var(--motion-ease-standard),
			background-color var(--motion-duration-fast) var(--motion-ease-standard);
	}

	.tabs--sm .tabs__trigger {
		padding: var(--space-1) var(--space-3);
		font-size: var(--text-sm);
		height: 28px;
	}
	.tabs--md .tabs__trigger {
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-base);
		height: 36px;
	}

	.tabs__trigger:hover:not(:disabled) {
		color: var(--fg-primary);
	}

	.tabs__trigger:disabled {
		color: var(--fg-disabled);
		cursor: not-allowed;
	}

	.tabs--underline .tabs__trigger {
		position: relative;
	}

	.tabs--underline .tabs__trigger--active {
		color: var(--brand-600);
	}

	.tabs--underline .tabs__trigger--active::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 2px;
		background-color: var(--brand-500);
	}

	.tabs--pill .tabs__trigger--active {
		background-color: var(--surface-1);
		color: var(--fg-primary);
		border-radius: var(--radius-2);
		box-shadow: var(--shadow-1);
	}

	.tabs__badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		padding: 0 var(--space-1);
		height: 18px;
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		border-radius: var(--radius-pill);
		background-color: var(--surface-3);
		color: var(--fg-secondary);
		font-variant-numeric: tabular-nums;
	}

	.tabs__trigger--active .tabs__badge {
		background-color: var(--brand-50);
		color: var(--brand-700);
	}

	.tabs__panel {
		padding-top: var(--space-4);
	}
</style>
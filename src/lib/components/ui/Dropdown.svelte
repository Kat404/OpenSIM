<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronDown } from 'lucide-svelte';

	export interface DropdownItem {
		id: string;
		label: string;
		icon?: Snippet;
		disabled?: boolean;
		destructive?: boolean;
	}

	interface Props {
		label: string;
		items: DropdownItem[];
		placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
		variant?: 'primary' | 'secondary' | 'ghost';
		size?: 'sm' | 'md';
		onSelect?: (id: string) => void;
		children?: Snippet;
	}

	let {
		label,
		items,
		placement = 'bottom-start',
		variant = 'secondary',
		size = 'md',
		onSelect,
		children
	}: Props = $props();

	let open = $state(false);
	let rootEl: HTMLDivElement | undefined = $state();

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	function onWindowClick(e: MouseEvent) {
		if (!rootEl) return;
		if (!rootEl.contains(e.target as Node)) {
			close();
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	function pick(id: string) {
		onSelect?.(id);
		close();
	}

	$effect(() => {
		if (open) {
			window.addEventListener('click', onWindowClick);
			window.addEventListener('keydown', onKeydown);
			return () => {
				window.removeEventListener('click', onWindowClick);
				window.removeEventListener('keydown', onKeydown);
			};
		}
	});
</script>

<div class="dropdown" bind:this={rootEl}>
	<button
		type="button"
		class="dropdown__trigger dropdown__trigger--{variant} dropdown__trigger--{size}"
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={toggle}
	>
		{#if children}
			{@render children()}
		{:else}
			<span>{label}</span>
		{/if}
		<ChevronDown size={14} strokeWidth={1.75} />
	</button>
	{#if open}
		<ul class="dropdown__menu dropdown__menu--{placement}" role="menu">
			{#each items as item (item.id)}
				<li role="none">
					<button
						type="button"
						role="menuitem"
						class="dropdown__item"
						class:dropdown__item--destructive={item.destructive}
						disabled={item.disabled}
						onclick={() => pick(item.id)}
					>
						{#if item.icon}
							<span class="dropdown__icon" aria-hidden="true">{@render item.icon()}</span>
						{/if}
						<span>{item.label}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.dropdown {
		position: relative;
		display: inline-block;
		font-family: var(--font-sans);
	}

	.dropdown__trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-weight: var(--weight-medium);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-2);
		cursor: pointer;
		background-color: var(--surface-1);
		color: var(--fg-primary);
		transition:
			background-color var(--motion-duration-fast) var(--motion-ease-standard),
			border-color var(--motion-duration-fast) var(--motion-ease-standard);
	}

	.dropdown__trigger--sm {
		height: 28px;
		padding: 0 var(--space-2);
		font-size: var(--text-sm);
	}
	.dropdown__trigger--md {
		height: 36px;
		padding: 0 var(--space-3);
		font-size: var(--text-base);
	}

	.dropdown__trigger--primary {
		background-color: var(--brand-500);
		color: var(--brand-fg);
		border-color: var(--brand-500);
	}
	.dropdown__trigger--primary:hover {
		background-color: var(--brand-600);
		border-color: var(--brand-600);
	}
	.dropdown__trigger--secondary:hover {
		background-color: var(--surface-2);
	}
	.dropdown__trigger--ghost {
		background-color: transparent;
		border-color: transparent;
	}
	.dropdown__trigger--ghost:hover {
		background-color: var(--surface-2);
	}

	.dropdown__menu {
		position: absolute;
		min-width: 200px;
		background-color: var(--surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-3);
		box-shadow: var(--shadow-3);
		padding: var(--space-1);
		margin: 0;
		list-style: none;
		z-index: var(--z-overlay);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.dropdown__menu--bottom-start {
		top: calc(100% + 4px);
		left: 0;
	}
	.dropdown__menu--bottom-end {
		top: calc(100% + 4px);
		right: 0;
	}
	.dropdown__menu--top-start {
		bottom: calc(100% + 4px);
		left: 0;
	}
	.dropdown__menu--top-end {
		bottom: calc(100% + 4px);
		right: 0;
	}

	.dropdown__item {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		font: inherit;
		color: var(--fg-primary);
		background: transparent;
		border: none;
		border-radius: var(--radius-2);
		text-align: left;
		cursor: pointer;
		font-size: var(--text-sm);
	}

	.dropdown__item:hover:not(:disabled) {
		background-color: var(--surface-2);
	}

	.dropdown__item:disabled {
		color: var(--fg-disabled);
		cursor: not-allowed;
	}

	.dropdown__item--destructive {
		color: var(--danger-700);
	}
	.dropdown__item--destructive:hover:not(:disabled) {
		background-color: var(--danger-50);
	}

	.dropdown__icon {
		display: inline-flex;
		color: var(--fg-tertiary);
	}
</style>
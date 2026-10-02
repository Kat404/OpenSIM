<script lang="ts">
	import type { Snippet } from 'svelte';

	type Size = 'sm' | 'md';

	interface Props {
		size?: Size;
		title?: string;
		children: Snippet;
	}

	let { size = 'sm', title, children }: Props = $props();
</script>

<kbd class="kbd kbd--{size}" {title}>
	{@render children()}
</kbd>

<style>
	.kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-weight: var(--weight-medium);
		color: var(--fg-secondary);
		background-color: var(--surface-1);
		border: 1px solid var(--border-default);
		border-bottom-width: 2px;
		border-radius: var(--radius-2);
		padding: 0 var(--space-1);
		min-width: 1.5em;
		text-align: center;
		line-height: 1;
		white-space: nowrap;
	}

	.kbd--sm {
		font-size: var(--text-xs);
		height: 20px;
	}

	.kbd--md {
		font-size: var(--text-sm);
		height: 24px;
	}
</style>
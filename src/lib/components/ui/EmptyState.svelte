<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Inbox } from 'lucide-svelte';
	import type { IconComponent } from '#lib/utils/icon';

	interface Props {
		title: string;
		description?: string;
		icon?: IconComponent;
		action?: Snippet;
	}

	let { title, description, icon: Icon = Inbox, action }: Props = $props();
</script>

<div class="empty">
	<span class="empty__icon" aria-hidden="true">
		<Icon size={32} strokeWidth={1.5} />
	</span>
	<h3 class="empty__title">{title}</h3>
	{#if description}<p class="empty__desc">{description}</p>{/if}
	{#if action}
		<div class="empty__action">{@render action()}</div>
	{/if}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--space-8) var(--space-4);
		gap: var(--space-3);
		font-family: var(--font-sans);
		color: var(--fg-secondary);
	}

	.empty__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background-color: var(--surface-2);
		color: var(--fg-tertiary);
	}

	.empty__title {
		margin: 0;
		font-size: var(--text-md);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.empty__desc {
		margin: 0;
		max-width: 360px;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
		line-height: var(--leading-normal);
	}

	.empty__action {
		margin-top: var(--space-2);
	}
</style>

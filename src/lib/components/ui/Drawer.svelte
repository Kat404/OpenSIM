<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title?: string;
		side?: 'left' | 'right';
		size?: 'sm' | 'md' | 'lg';
		children?: Snippet;
		footer?: Snippet;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		title,
		side = 'right',
		size = 'md',
		children,
		footer,
		onclose
	}: Props = $props();

	function close() {
		open = false;
		onclose?.();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	const widthVar = $derived(
		size === 'sm' ? '320px' : size === 'lg' ? '640px' : '480px'
	);
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="drawer-scrim" onclick={close} aria-hidden="true"></div>
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<aside
		class="drawer drawer--{side} drawer--{size}"
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? 'drawer-title' : undefined}
		style:--drawer-width={widthVar}
	>
		<header class="drawer__header">
			{#if title}<h2 id="drawer-title" class="drawer__title">{title}</h2>{/if}
			<button type="button" class="drawer__close" aria-label="Cerrar" onclick={close}>
				<X size={18} strokeWidth={1.75} />
			</button>
		</header>
		<div class="drawer__body">{@render children?.()}</div>
		{#if footer}<footer class="drawer__footer">{@render footer()}</footer>{/if}
	</aside>
{/if}

<style>
	.drawer-scrim {
		position: fixed;
		inset: 0;
		background-color: var(--scrim);
		backdrop-filter: blur(4px);
		z-index: var(--z-overlay);
	}

	.drawer {
		position: fixed;
		top: 0;
		bottom: 0;
		width: var(--drawer-width, 480px);
		max-width: 100vw;
		background-color: var(--surface-1);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-5);
		font-family: var(--font-sans);
		color: var(--fg-secondary);
		z-index: var(--z-modal);
		animation: drawer-slide var(--motion-duration-base) var(--motion-ease-emphasized);
	}

	.drawer--right {
		right: 0;
		border-left: 1px solid var(--border-subtle);
		border-right: none;
		border-radius: var(--radius-4) 0 0 var(--radius-4);
	}

	.drawer--left {
		left: 0;
		border-right: 1px solid var(--border-subtle);
		border-left: none;
		border-radius: 0 var(--radius-4) var(--radius-4) 0;
		animation-name: drawer-slide-left;
	}

	@keyframes drawer-slide {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	@keyframes drawer-slide-left {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(0);
		}
	}

	.drawer__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.drawer__title {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.drawer__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-2);
		border: 1px solid transparent;
		background: transparent;
		color: var(--fg-tertiary);
		cursor: pointer;
	}

	.drawer__close:hover {
		background-color: var(--surface-2);
		color: var(--fg-primary);
	}

	.drawer__body {
		overflow-y: auto;
		flex: 1;
	}

	.drawer__footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--border-subtle);
	}
</style>
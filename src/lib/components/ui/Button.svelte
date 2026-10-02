<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'lg';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		size?: Size;
		loading?: boolean;
		fullWidth?: boolean;
		children?: Snippet;
		startIcon?: Snippet;
		endIcon?: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		fullWidth = false,
		disabled,
		type = 'button',
		children,
		startIcon,
		endIcon,
		...rest
	}: Props = $props();

	const isDisabled = $derived(loading || disabled);
</script>

<button
	{...rest}
	{type}
	class="btn btn--{variant} btn--{size}"
	class:btn--full={fullWidth}
	class:btn--loading={loading}
	disabled={isDisabled}
	aria-busy={loading ? 'true' : undefined}
>
	{#if startIcon}<span class="btn__icon btn__icon--start" aria-hidden="true">{@render startIcon()}</span>{/if}
	<span class="btn__label">{@render children?.()}</span>
	{#if endIcon}<span class="btn__icon btn__icon--end" aria-hidden="true">{@render endIcon()}</span>{/if}
	{#if loading}<span class="btn__spinner" aria-hidden="true"></span>{/if}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		border: 1px solid transparent;
		border-radius: var(--radius-2);
		font-family: var(--font-sans);
		font-weight: var(--weight-medium);
		cursor: pointer;
		transition:
			background-color var(--motion-duration-fast) var(--motion-ease-standard),
			border-color var(--motion-duration-fast) var(--motion-ease-standard),
			box-shadow var(--motion-duration-fast) var(--motion-ease-standard),
			transform var(--motion-duration-fast) var(--motion-ease-standard);
		white-space: nowrap;
		user-select: none;
	}

	.btn:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.btn:not(:disabled):active {
		transform: translateY(0.5px);
	}

	.btn--sm {
		padding: 0 var(--space-3);
		height: 28px;
		font-size: var(--text-sm);
	}
	.btn--md {
		padding: 0 var(--space-4);
		height: 36px;
		font-size: var(--text-base);
	}
	.btn--lg {
		padding: 0 var(--space-5);
		height: 44px;
		font-size: var(--text-md);
	}

	.btn--primary {
		background-color: var(--brand-500);
		color: var(--brand-fg);
		border-color: var(--brand-500);
	}
	.btn--primary:hover:not(:disabled) {
		background-color: var(--brand-600);
		border-color: var(--brand-600);
	}

	.btn--secondary {
		background-color: var(--surface-1);
		color: var(--fg-primary);
		border-color: var(--border-default);
	}
	.btn--secondary:hover:not(:disabled) {
		background-color: var(--surface-2);
		border-color: var(--border-strong);
	}

	.btn--ghost {
		background-color: transparent;
		color: var(--fg-primary);
		border-color: transparent;
	}
	.btn--ghost:hover:not(:disabled) {
		background-color: var(--surface-2);
	}

	.btn--danger {
		background-color: var(--danger-500);
		color: #ffffff;
		border-color: var(--danger-500);
	}
	.btn--danger:hover:not(:disabled) {
		background-color: var(--danger-700);
		border-color: var(--danger-700);
	}

	.btn--full {
		width: 100%;
	}

	.btn--loading .btn__label {
		opacity: 0.7;
	}

	.btn__spinner {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid currentColor;
		border-top-color: transparent;
		animation: btn-spin 0.7s linear infinite;
	}

	@keyframes btn-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
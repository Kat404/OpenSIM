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
		/* brand-700 (5.44:1 vs white) rather than brand-500 (2.42:1):
		   the primary CTA needs AA contrast for its label. brand-500
		   stays available for accents that don't carry text. The hover
		   state uses brand-900 to keep the visual progression darker
		   rather than lighter — preserves the dark-on-light identity
		   (audit axe-core, Round 7). */
		background-color: var(--brand-700);
		color: var(--brand-fg);
		border-color: var(--brand-700);
	}
	.btn--primary:hover:not(:disabled) {
		background-color: var(--brand-900);
		border-color: var(--brand-900);
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
		/* danger-500 + hardcoded #fff = 3.82:1 in light, 2.77:1 in dark.
		 * Move to danger-700 (7.95:1 light) and use --fg-on-danger
		 * which is white in light and dark-near-black in dark (6.5:1),
		 * so both themes pass AA. Audit axe-core N13, Round 7. */
		background-color: var(--danger-700);
		color: var(--fg-on-danger);
		border-color: var(--danger-700);
	}
	.btn--danger:hover:not(:disabled) {
		background-color: var(--danger-500);
		border-color: var(--danger-500);
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

	/* Phase 6 U4: make the icon span a self-centering flex container so
	 * the SVG's optical center aligns with the text x-height, not with
	 * the SVG viewBox top. Without this, lucide icons (stroke-width 2)
	 * sit ~1-2 px above the label baseline because their viewBox is
	 * tighter than the text's. */
	.btn__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	@keyframes btn-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
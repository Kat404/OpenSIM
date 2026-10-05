<script lang="ts">
import type { Snippet } from "svelte";

type Variant = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
type Size = "sm" | "md";

interface Props {
	variant?: Variant;
	size?: Size;
	dot?: boolean;
	children?: Snippet;
}

let { variant = "neutral", size = "sm", dot = false, children }: Props = $props();
</script>

<span class="badge badge--{variant} badge--{size}">
	{#if dot}
		<span class="badge__dot" aria-hidden="true"></span>
	{/if}
	{@render children?.()}
</span>

<style>
.badge {
	display: inline-flex;
	align-items: center;
	gap: var(--space-1);
	font-family: var(--font-sans);
	font-weight: var(--weight-medium);
	border-radius: var(--radius-1);
	white-space: nowrap;
	line-height: 1;
}

.badge--sm {
	padding: 3px 6px;
	font-size: var(--text-xs);
}

.badge--md {
	padding: 5px 8px;
	font-size: var(--text-sm);
}

.badge--neutral {
	background-color: var(--surface-2);
	color: var(--fg-secondary);
	border: 1px solid var(--border-subtle);
}

.badge--brand {
	background-color: var(--brand-50);
	color: var(--brand-700);
	border: 1px solid var(--brand-100);
}

.badge--success {
	background-color: var(--success-50);
	color: var(--success-700);
	border: 1px solid color-mix(in srgb, var(--success-500) 20%, transparent);
}

.badge--warning {
	background-color: var(--warning-50);
	color: var(--warning-700);
	border: 1px solid color-mix(in srgb, var(--warning-500) 20%, transparent);
}

.badge--danger {
	background-color: var(--danger-50);
	color: var(--danger-700);
	border: 1px solid color-mix(in srgb, var(--danger-500) 20%, transparent);
}

.badge--info {
	background-color: var(--info-50);
	color: var(--info-700);
	border: 1px solid color-mix(in srgb, var(--info-500) 20%, transparent);
}

.badge__dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background-color: currentColor;
}
</style>

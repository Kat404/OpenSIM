<script lang="ts">
type Variant = "brand" | "success" | "warning" | "danger";

interface Props {
	value: number;
	max?: number;
	variant?: Variant;
	label?: string;
	showValue?: boolean;
	indeterminate?: boolean;
	size?: "sm" | "md" | "lg";
}

let {
	value,
	max = 100,
	variant = "brand",
	label,
	showValue = false,
	indeterminate = false,
	size = "md",
}: Props = $props();

const pct = $derived(Math.max(0, Math.min(100, (value / max) * 100)));
</script>

<div
	class="bar bar--{size}"
	role="progressbar"
	aria-valuenow={indeterminate ? undefined : value}
	aria-valuemin={0}
	aria-valuemax={max}
	aria-label={label}
>
	{#if label || showValue}
		<div class="bar__header">
			{#if label}
				<span class="bar__label">{label}</span>
			{/if}
			{#if showValue && !indeterminate}
				<span class="bar__value">{Math.round(pct)}%</span>
			{/if}
		</div>
	{/if}
	<div class="bar__track">
		{#if indeterminate}
			<div class="bar__fill bar__fill--indeterminate bar__fill--{variant}"></div>
		{:else}
			<div class="bar__fill bar__fill--{variant}" style:width="{pct}%"></div>
		{/if}
	</div>
</div>

<style>
.bar {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
	font-family: var(--font-sans);
	width: 100%;
}

.bar__header {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
}

.bar__label {
	font-weight: var(--weight-medium);
	color: var(--fg-secondary);
}

.bar__value {
	font-variant-numeric: tabular-nums;
}

.bar__track {
	background-color: var(--surface-3);
	border-radius: var(--radius-pill);
	overflow: hidden;
	width: 100%;
}

.bar--sm .bar__track {
	height: 4px;
}
.bar--md .bar__track {
	height: 8px;
}
.bar--lg .bar__track {
	height: 12px;
}

.bar__fill {
	height: 100%;
	border-radius: var(--radius-pill);
	/* Phase 6 U2: smooth 700ms ease-out (Material standard). The
		 * global @media (prefers-reduced-motion) override at the top of
		 * tokens.css zeroes all motion-* durations, which makes this
		 * transition instant for users who request reduced motion — no
		 * extra @media block needed here. */
	transition: width 700ms cubic-bezier(0.4, 0, 0.2, 1);
}

.bar__fill--brand {
	background-color: var(--brand-500);
}
.bar__fill--success {
	background-color: var(--success-500);
}
.bar__fill--warning {
	background-color: var(--warning-500);
}
.bar__fill--danger {
	background-color: var(--danger-500);
}

.bar__fill--indeterminate {
	width: 35%;
	animation: bar-indeterminate 1.4s var(--motion-ease-standard) infinite;
}

@keyframes bar-indeterminate {
	0% {
		transform: translateX(-100%);
	}
	100% {
		transform: translateX(300%);
	}
}
</style>

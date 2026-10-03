<!--
  OpenSIM — KPI tile for the dashboard.

  Renders a single metric card with optional accent and sublabel.
  Designed to live inside a 4-column grid; the card itself only
  carries the typographic hierarchy, so the parent decides spacing.
-->
<script lang="ts">
	type Accent = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

	interface Props {
		label: string;
		value: string;
		sublabel?: string;
		accent?: Accent;
	}

	let { label, value, sublabel, accent = 'neutral' }: Props = $props();
</script>

<section class="kpi kpi--{accent}" aria-label={label}>
	<p class="kpi__label">{label}</p>
	<p class="kpi__value">{value}</p>
	{#if sublabel}<p class="kpi__sub">{sublabel}</p>{/if}
</section>

<style>
	.kpi {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-4) var(--space-5);
		background-color: var(--surface-1);
		border: 1px solid var(--border-subtle);
		border-left-width: 4px;
		border-radius: var(--radius-3);
		font-family: var(--font-sans);
		min-height: 88px;
	}

	.kpi--neutral {
		border-left-color: var(--border-default);
	}
	.kpi--brand {
		border-left-color: var(--brand-500);
	}
	.kpi--success {
		border-left-color: var(--success-500);
	}
	.kpi--warning {
		border-left-color: var(--warning-500);
	}
	.kpi--danger {
		border-left-color: var(--danger-500);
	}
	.kpi--info {
		border-left-color: var(--info-500);
	}

	.kpi__label {
		margin: 0;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-tertiary);
		font-weight: var(--weight-medium);
	}

	.kpi__value {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
	}

	.kpi__sub {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
	}
</style>
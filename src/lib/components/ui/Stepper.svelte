<script lang="ts">
import { Check } from "lucide-svelte";
import type { Snippet } from "svelte";

export interface Step {
	id: string;
	label: string;
	description?: string;
}

interface Props {
	steps: Step[];
	current: number;
	orientation?: "horizontal" | "vertical";
	children?: Snippet;
}

let { steps, current, orientation = "horizontal", children }: Props = $props();

const normalizedCurrent = $derived(Math.max(0, Math.min(steps.length - 1, current)));

function statusOf(idx: number): "complete" | "current" | "upcoming" {
	if (idx < normalizedCurrent) return "complete";
	if (idx === normalizedCurrent) return "current";
	return "upcoming";
}
</script>

<ol class="stepper stepper--{orientation}" aria-label="Progreso">
	{#each steps as step, i (step.id)}
		{@const status = statusOf(i)}
		<li
			class="stepper__item stepper__item--{status}"
			aria-current={status === "current" ? "step" : undefined}
		>
			<span class="stepper__indicator" aria-hidden="true">
				{#if status === "complete"}
					<Check size={14} strokeWidth={2} />
				{:else}
					{i + 1}
				{/if}
			</span>
			<div class="stepper__text">
				<span class="stepper__label">{step.label}</span>
				{#if step.description}
					<span class="stepper__desc">{step.description}</span>
				{/if}
			</div>
		</li>
	{/each}
</ol>

{#if children}
	<div class="stepper__content">
		{@render children()}
	</div>
{/if}

<style>
.stepper {
	display: flex;
	font-family: var(--font-sans);
	color: var(--fg-secondary);
	list-style: none;
	padding: 0;
	margin: 0;
}

.stepper--horizontal {
	flex-direction: row;
	gap: 0;
	overflow-x: auto;
}

.stepper--vertical {
	flex-direction: column;
	gap: var(--space-3);
}

.stepper__item {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	position: relative;
	padding: var(--space-2) var(--space-3);
	flex: 1 1 0;
}

.stepper--horizontal .stepper__item:not(:last-child)::after {
	content: "";
	position: absolute;
	right: 0;
	top: 50%;
	width: var(--space-4);
	height: 1px;
	background-color: var(--border-default);
}

.stepper__indicator {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border-radius: 50%;
	border: 1.5px solid var(--border-default);
	background-color: var(--surface-1);
	color: var(--fg-tertiary);
	font-size: var(--text-sm);
	font-weight: var(--weight-semibold);
	font-variant-numeric: tabular-nums;
	flex-shrink: 0;
	transition:
		background-color var(--motion-duration-fast) var(--motion-ease-standard),
		color var(--motion-duration-fast) var(--motion-ease-standard),
		border-color var(--motion-duration-fast) var(--motion-ease-standard);
}

.stepper__item--complete .stepper__indicator {
	background-color: var(--success-500);
	border-color: var(--success-500);
	color: var(--fg-on-success);
}

.stepper__item--current .stepper__indicator {
	background-color: var(--brand-500);
	border-color: var(--brand-500);
	color: var(--brand-fg);
}

.stepper__text {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.stepper__label {
	font-size: var(--text-sm);
	font-weight: var(--weight-medium);
	color: var(--fg-primary);
}

.stepper__item--upcoming .stepper__label {
	color: var(--fg-tertiary);
}

.stepper__desc {
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
}

.stepper__content {
	margin-top: var(--space-4);
}
</style>

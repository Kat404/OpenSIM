<script lang="ts">
import type { Snippet } from "svelte";

interface Props {
	title?: string;
	description?: string;
	elevation?: 1 | 2 | 3 | 4;
	padding?: "sm" | "md" | "lg";
	interactive?: boolean;
	children?: Snippet;
	header?: Snippet;
	footer?: Snippet;
}

let {
	title,
	description,
	elevation = 1,
	padding = "md",
	interactive = false,
	children,
	header,
	footer,
}: Props = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section
	class="card card--p-{padding} card--elev-{elevation}"
	class:card--interactive={interactive}
	role={interactive ? "button" : undefined}
	tabindex={interactive ? 0 : undefined}
	data-interactive={interactive ? "true" : undefined}
>
	{#if header}
		<div class="card__header">{@render header()}</div>
	{:else if title || description}
		<header class="card__header">
			{#if title}
				<h2 class="card__title">{title}</h2>
			{/if}
			{#if description}
				<p class="card__description">{description}</p>
			{/if}
		</header>
	{/if}
	<div class="card__body">{@render children?.()}</div>
	{#if footer}
		<footer class="card__footer">{@render footer()}</footer>
	{/if}
</section>

<style>
.card {
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	font-family: var(--font-sans);
	color: var(--fg-secondary);
	transition:
		box-shadow var(--motion-duration-base) var(--motion-ease-standard),
		transform var(--motion-duration-base) var(--motion-ease-standard),
		border-color var(--motion-duration-base) var(--motion-ease-standard);
}

.card--elev-1 {
	box-shadow: var(--shadow-1);
}
.card--elev-2 {
	box-shadow: var(--shadow-2);
}
.card--elev-3 {
	box-shadow: var(--shadow-3);
}
.card--elev-4 {
	box-shadow: var(--shadow-4);
}

.card--p-sm {
	padding: var(--space-3);
}
.card--p-md {
	padding: var(--space-4);
}
.card--p-lg {
	padding: var(--space-6);
}

.card--interactive {
	cursor: pointer;
}

.card--interactive:hover {
	border-color: var(--border-default);
	box-shadow: var(--shadow-3);
}

.card--interactive:active {
	transform: translateY(0.5px);
}

.card__header {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}

.card__title {
	margin: 0;
	font-size: var(--text-md);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.card__description {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
}

.card__body {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.card__footer {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	padding-top: var(--space-2);
	border-top: 1px solid var(--border-subtle);
}
</style>

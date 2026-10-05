<script lang="ts">
import type { Snippet } from "svelte";

interface Props {
	content: string;
	placement?: "top" | "bottom" | "left" | "right";
	delay?: number;
	children: Snippet;
}

let { content, placement = "top", delay = 200, children }: Props = $props();

let visible = $state(false);
let timer: ReturnType<typeof setTimeout> | null = null;

function show() {
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		visible = true;
	}, delay);
}

function hide() {
	if (timer) clearTimeout(timer);
	visible = false;
}
</script>

<span
	class="tooltip-wrap"
	role="presentation"
	onmouseenter={show}
	onmouseleave={hide}
	onfocusin={show}
	onfocusout={hide}
>
	{@render children()}
	{#if visible}
		<span role="tooltip" class="tooltip tooltip--{placement}">
			{content}
		</span>
	{/if}
</span>

<style>
.tooltip-wrap {
	position: relative;
	display: inline-flex;
}

.tooltip {
	position: absolute;
	background-color: var(--surface-inverse);
	color: var(--fg-inverse);
	padding: var(--space-1) var(--space-2);
	border-radius: var(--radius-2);
	font-size: var(--text-xs);
	font-family: var(--font-sans);
	font-weight: var(--weight-medium);
	white-space: nowrap;
	z-index: var(--z-tooltip);
	box-shadow: var(--shadow-2);
	animation: tooltip-fade var(--motion-duration-fast) var(--motion-ease-standard);
}

.tooltip--top {
	bottom: calc(100% + 6px);
	left: 50%;
	transform: translateX(-50%);
}
.tooltip--bottom {
	top: calc(100% + 6px);
	left: 50%;
	transform: translateX(-50%);
}
.tooltip--left {
	right: calc(100% + 6px);
	top: 50%;
	transform: translateY(-50%);
}
.tooltip--right {
	left: calc(100% + 6px);
	top: 50%;
	transform: translateY(-50%);
}

@keyframes tooltip-fade {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}
</style>

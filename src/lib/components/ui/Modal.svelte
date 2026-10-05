<script lang="ts">
import { X } from "lucide-svelte";
import type { Snippet } from "svelte";

interface Props {
	open: boolean;
	title?: string;
	description?: string;
	size?: "sm" | "md" | "lg";
	closeOnBackdrop?: boolean;
	closeOnEscape?: boolean;
	children?: Snippet;
	footer?: Snippet;
	onclose?: () => void;
}

let {
	open = $bindable(false),
	title,
	description,
	size = "md",
	closeOnBackdrop = true,
	closeOnEscape = true,
	children,
	footer,
	onclose,
}: Props = $props();

let dialogEl: HTMLDialogElement | undefined = $state();

$effect(() => {
	if (!dialogEl) return;
	if (open && !dialogEl.open) {
		dialogEl.showModal();
	} else if (!open && dialogEl.open) {
		dialogEl.close();
	}
});

function close() {
	open = false;
	onclose?.();
}

function onBackdropClick(e: MouseEvent) {
	if (!closeOnBackdrop) return;
	if (e.target === dialogEl) {
		close();
	}
}

function onKeydown(e: KeyboardEvent) {
	if (closeOnEscape && e.key === "Escape") {
		close();
	}
}
</script>

<dialog
	bind:this={dialogEl}
	class="modal modal--{size}"
	aria-labelledby={title ? "modal-title" : undefined}
	aria-describedby={description ? "modal-desc" : undefined}
	onclick={onBackdropClick}
	onkeydown={onKeydown}
>
	<div class="modal__panel" role="document">
		<header class="modal__header">
			<div class="modal__heading">
				{#if title}
					<h2 id="modal-title" class="modal__title">{title}</h2>
				{/if}
				{#if description}
					<p id="modal-desc" class="modal__description">{description}</p>
				{/if}
			</div>
			<button type="button" class="modal__close" aria-label="Cerrar" onclick={close}>
				<X size={18} strokeWidth={1.75} />
			</button>
		</header>
		<div class="modal__body">{@render children?.()}</div>
		{#if footer}
			<footer class="modal__footer">{@render footer()}</footer>
		{/if}
	</div>
</dialog>

<style>
.modal {
	padding: 0;
	border: none;
	background: transparent;
	color: var(--fg-secondary);
	max-width: min(560px, calc(100vw - var(--space-6)));
	max-height: calc(100vh - var(--space-6));
	margin: auto;
}

.modal[open] {
	display: flex;
}

.modal::backdrop {
	background-color: var(--scrim);
	backdrop-filter: blur(4px);
}

.modal--sm {
	max-width: min(360px, calc(100vw - var(--space-6)));
}
.modal--lg {
	max-width: min(840px, calc(100vw - var(--space-6)));
}

.modal__panel {
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-4);
	box-shadow: var(--shadow-4);
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-5);
	width: 100%;
	font-family: var(--font-sans);
	max-height: calc(100vh - var(--space-6));
}

.modal__header {
	display: flex;
	align-items: flex-start;
	gap: var(--space-3);
	justify-content: space-between;
}

.modal__heading {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}

.modal__title {
	margin: 0;
	font-size: var(--text-lg);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.modal__description {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
}

.modal__close {
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

.modal__close:hover {
	background-color: var(--surface-2);
	color: var(--fg-primary);
}

.modal__body {
	overflow-y: auto;
	max-height: 60vh;
}

.modal__footer {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: var(--space-2);
	padding-top: var(--space-2);
	border-top: 1px solid var(--border-subtle);
}
</style>

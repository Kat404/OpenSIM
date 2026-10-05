<script lang="ts" module>
import { type Writable, writable } from "svelte/store";

type ToastVariant = "info" | "success" | "warning" | "danger";

interface ToastItem {
	id: number;
	variant: ToastVariant;
	title: string;
	description?: string;
	duration: number;
}

let nextId = 1;
const store: Writable<ToastItem[]> = writable([]);

export function pushToast(opts: {
	variant?: ToastVariant;
	title: string;
	description?: string;
	duration?: number;
}): number {
	const item: ToastItem = {
		id: nextId++,
		variant: opts.variant ?? "info",
		title: opts.title,
		description: opts.description,
		duration: opts.duration ?? 4000,
	};
	store.update((items) => [...items, item]);
	if (item.duration > 0) {
		setTimeout(() => dismiss(item.id), item.duration);
	}
	return item.id;
}

export function dismiss(id: number) {
	store.update((items) => items.filter((i) => i.id !== id));
}

const _store = store;
export const toasts = _store;
</script>

<script lang="ts">
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-svelte";
import { onMount } from "svelte";

let items = $state<ToastItem[]>([]);
$effect(() => {
	const unsub = toasts.subscribe((v) => (items = v));
	return unsub;
});

const ICONS = {
	success: CheckCircle2,
	warning: AlertTriangle,
	danger: AlertCircle,
	info: Info,
} as const;

onMount(() => {
	// Hydration: ensure SSR-aware readers see the store initialised.
});
</script>

<div class="toast-region" role="region" aria-label="Notificaciones" aria-live="polite">
	{#each items as t (t.id)}
		{@const Icon = ICONS[t.variant]}
		<div class="toast toast--{t.variant}" role="status">
			<span class="toast__icon" aria-hidden="true">
				<Icon size={18} strokeWidth={1.75} />
			</span>
			<div class="toast__body">
				<p class="toast__title">{t.title}</p>
				{#if t.description}
					<p class="toast__desc">{t.description}</p>
				{/if}
			</div>
			<button
				type="button"
				class="toast__close"
				aria-label="Cerrar notificación"
				onclick={() => dismiss(t.id)}
			>
				<X size={14} strokeWidth={1.75} />
			</button>
		</div>
	{/each}
</div>

<style>
.toast-region {
	position: fixed;
	bottom: var(--space-4);
	right: var(--space-4);
	display: flex;
	flex-direction: column-reverse;
	gap: var(--space-2);
	z-index: var(--z-toast);
	max-width: min(380px, calc(100vw - var(--space-6)));
}

.toast {
	display: grid;
	grid-template-columns: auto 1fr auto;
	gap: var(--space-3);
	align-items: flex-start;
	padding: var(--space-3) var(--space-4);
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
	box-shadow: var(--shadow-3);
	font-family: var(--font-sans);
	color: var(--fg-secondary);
	animation: toast-slide var(--motion-duration-base) var(--motion-ease-emphasized);
}

@keyframes toast-slide {
	from {
		opacity: 0;
		transform: translateY(8px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.toast--success {
	border-color: color-mix(in srgb, var(--success-500) 30%, var(--border-subtle));
}
.toast--warning {
	border-color: color-mix(in srgb, var(--warning-500) 30%, var(--border-subtle));
}
.toast--danger {
	border-color: color-mix(in srgb, var(--danger-500) 30%, var(--border-subtle));
}
.toast--info {
	border-color: color-mix(in srgb, var(--info-500) 30%, var(--border-subtle));
}

.toast__icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.toast--success .toast__icon {
	color: var(--success-500);
}
.toast--warning .toast__icon {
	color: var(--warning-500);
}
.toast--danger .toast__icon {
	color: var(--danger-500);
}
.toast--info .toast__icon {
	color: var(--info-500);
}

.toast__body {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.toast__title {
	margin: 0;
	font-size: var(--text-sm);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.toast__desc {
	margin: 0;
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
}

.toast__close {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border: none;
	background: transparent;
	color: var(--fg-tertiary);
	cursor: pointer;
	border-radius: var(--radius-1);
}

.toast__close:hover {
	background-color: var(--surface-2);
	color: var(--fg-primary);
}
</style>

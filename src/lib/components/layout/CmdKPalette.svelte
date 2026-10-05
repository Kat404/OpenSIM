<!--
  OpenSIM — Cmd+K global palette.

  A minimal modal that indexes the protected-route nav plus the
  subjects catalog and lets the user fuzzy-search via `includes()`
  (lowercased substring match). The index is built once on open from
  the props passed in; keystrokes only filter the in-memory list, so
  no D1 traffic per character.

  ARIA (audit M4, Round 4):
    - The input is the combobox; it owns `aria-controls`,
      `aria-expanded`, and `aria-activedescendant` so screen
      readers can announce the current option without leaving the
      input.
    - The list is a `<ul role="listbox">`; each option is a
      `<li role="option">` with a stable `id` and `tabindex="-1"`
      so the focus stays on the input while the user arrows
      through results.
    - The keyboard handler lives on the input wrapper, not the
      options, so the arrows keep working no matter which element
      has DOM focus.

  Keyboard:
    - Cmd/Ctrl+K (handled by LayoutHeader) opens the palette.
    - ArrowDown / ArrowUp navigate the result list.
    - Enter navigates to the highlighted result.
    - Escape closes (via the Modal atom).
    - Clicking outside closes.
-->
<script lang="ts">
import { Search } from "lucide-svelte";
import { tick } from "svelte";
import { Modal } from "#lib/components/ui";
import { goto } from "$app/navigation";

export interface PaletteRoute {
	label: string;
	href: string;
	group: string;
}

export interface PaletteSubject {
	label: string;
	canonicalId: string;
	group: string;
}

interface Props {
	open: boolean;
	onClose: () => void;
	routes: PaletteRoute[];
	subjects: PaletteSubject[];
}

let { open = $bindable(false), onClose, routes, subjects }: Props = $props();

let query = $state("");
let highlight = $state(0);
let inputEl: HTMLInputElement | undefined = $state();

// The flattened, unfiltered list built once on open. We rebuild it
// when `open` flips so the search index is always fresh against
// whatever props the parent currently has.
const index = $derived.by(() => {
	if (!open) return [];
	const merged: { label: string; sublabel: string; href: string; key: string }[] = [];
	for (const r of routes) {
		merged.push({ label: r.label, sublabel: r.group, href: r.href, key: `r:${r.href}` });
	}
	for (const s of subjects) {
		merged.push({
			label: s.label,
			sublabel: s.group,
			href: `/reticula#${s.canonicalId}`,
			key: `s:${s.canonicalId}`,
		});
	}
	return merged;
});

const results = $derived.by(() => {
	const q = query.trim().toLowerCase();
	if (!q) return index.slice(0, 12);
	return index
		.filter(
			(item) => item.label.toLowerCase().includes(q) || item.sublabel.toLowerCase().includes(q),
		)
		.slice(0, 12);
});

// Stable id for the highlighted option so `aria-activedescendant`
// always points somewhere real (audit M4, Round 4).
const activeOptionId = $derived.by(() => {
	const target = results[highlight];
	return target ? `palette-option-${target.key}` : "";
});

$effect(() => {
	if (open) {
		query = "";
		highlight = 0;
		// Defer focus until Svelte has flushed the DOM and the
		// <dialog> the Modal wraps is mounted. `tick()` awaits
		// the next DOM-update microtask; on slow browsers the
		// dialog may need a frame, so we re-focus on the next
		// animation frame as a safety net (audit M4, Round 6).
		tick().then(() => inputEl?.focus());
		requestAnimationFrame(() => inputEl?.focus());
	}
});

// Whenever the result list shrinks, keep highlight in bounds.
$effect(() => {
	if (highlight >= results.length) highlight = 0;
});

function close() {
	open = false;
	onClose();
}

function commit(href: string) {
	// Hash links (#subject) are not full routes — SvelteKit's
	// router will navigate and the retícula page reads the
	// hash via `$page.url.hash` and pipes it to the DAG as
	// `focusedCanonicalId`.
	goto(href).catch(() => {});
	close();
}

function handleKey(e: KeyboardEvent) {
	if (e.key === "ArrowDown") {
		e.preventDefault();
		highlight = (highlight + 1) % Math.max(results.length, 1);
	} else if (e.key === "ArrowUp") {
		e.preventDefault();
		highlight = (highlight - 1 + results.length) % Math.max(results.length, 1);
	} else if (e.key === "Enter") {
		e.preventDefault();
		const target = results[highlight];
		if (target) commit(target.href);
	}
}

function isMac(): boolean {
	if (typeof navigator === "undefined") return false;
	return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}
</script>

<Modal
	bind:open
	title="Buscar"
	description={isMac()
		? "⌘ + K para abrir en cualquier momento"
		: "Ctrl + K para abrir en cualquier momento"}
	size="md"
	onclose={close}
>
	<div class="palette" role="presentation" onkeydown={handleKey}>
		<div class="palette__field">
			<Search size={16} strokeWidth={1.75} aria-hidden="true" />
			<input
				bind:this={inputEl}
				bind:value={query}
				type="text"
				class="palette__input"
				placeholder="Buscar asignaturas, secciones…"
				aria-label="Buscar"
				role="combobox"
				aria-controls="palette-list"
				aria-expanded={open}
				aria-autocomplete="list"
				aria-activedescendant={activeOptionId}
			>
		</div>

		<ul id="palette-list" class="palette__list" role="listbox" aria-label="Resultados">
			{#each results as r, i (r.key)}
				{@const optionId = `palette-option-${r.key}`}
				<li role="option" id={optionId} aria-selected={i === highlight} tabindex="-1">
					<button
						type="button"
						class="palette__item"
						class:palette__item--active={i === highlight}
						onmouseenter={() => (highlight = i)}
						onclick={() => commit(r.href)}
					>
						<span class="palette__item-label">{r.label}</span>
						<span class="palette__item-group">{r.sublabel}</span>
					</button>
				</li>
			{:else}
				<li class="palette__empty">Sin resultados.</li>
			{/each}
		</ul>

		<footer class="palette__hint">
			<span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
			<span><kbd>↵</kbd> seleccionar</span>
			<span><kbd>Esc</kbd> cerrar</span>
		</footer>
	</div>
</Modal>

<style>
.palette {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.palette__field {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	padding: 0 var(--space-3);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-2);
	background-color: var(--surface-0);
	color: var(--fg-tertiary);
}

.palette__field:focus-within {
	border-color: var(--brand-500);
	box-shadow: var(--shadow-focus);
}

.palette__input {
	flex: 1;
	height: 36px;
	font: inherit;
	font-size: var(--text-base);
	color: var(--fg-primary);
	background: transparent;
	border: none;
	outline: none;
}

.palette__input::placeholder {
	color: var(--fg-tertiary);
}

.palette__list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
	max-height: 360px;
	overflow-y: auto;
}

.palette__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-3);
	width: 100%;
	padding: var(--space-2) var(--space-3);
	background: transparent;
	border: none;
	border-radius: var(--radius-2);
	color: var(--fg-primary);
	font: inherit;
	font-size: var(--text-sm);
	cursor: pointer;
	text-align: left;
	transition: background-color var(--motion-duration-fast) var(--motion-ease-standard);
}

.palette__item:hover,
.palette__item--active {
	background-color: var(--surface-2);
}

.palette__item--active {
	outline: 1px solid var(--brand-500);
}

.palette__item-label {
	font-weight: var(--weight-medium);
}

.palette__item-group {
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
	font-family: var(--font-mono);
}

.palette__empty {
	padding: var(--space-4);
	text-align: center;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
	font-style: italic;
}

.palette__hint {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding-top: var(--space-2);
	border-top: 1px solid var(--border-subtle);
	color: var(--fg-tertiary);
	font-size: var(--text-xs);
}

.palette__hint kbd {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	margin: 0 2px;
	padding: 0 var(--space-1);
	min-width: 1.5em;
	height: 18px;
	font-family: var(--font-mono);
	color: var(--fg-secondary);
	background-color: var(--surface-1);
	border: 1px solid var(--border-default);
	border-bottom-width: 2px;
	border-radius: var(--radius-2);
}
</style>

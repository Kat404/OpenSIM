<script lang="ts">
import type { HTMLInputAttributes } from "svelte/elements";

interface Props extends Omit<HTMLInputAttributes, "size"> {
	label?: string;
	helper?: string;
	error?: string;
	size?: "sm" | "md" | "lg";
	invalid?: boolean;
}

let {
	label,
	helper,
	error,
	size = "md",
	invalid = false,
	id,
	value = $bindable(""),
	...rest
}: Props = $props();

const autoId = $props.id();
const inputId = $derived(id ?? autoId);
const describedBy = $derived(error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined);
const hasError = $derived(Boolean(error) || invalid);
</script>

<div class="field field--{size}" class:field--with-error={hasError}>
	{#if label}
		<label class="field__label" for={inputId}>{label}</label>
	{/if}
	<input
		{...rest}
		id={inputId}
		class="field__input"
		aria-invalid={hasError ? "true" : undefined}
		aria-describedby={describedBy}
		bind:value
	>
	{#if error}
		<p id="{inputId}-error" class="field__error" role="alert">{error}</p>
	{:else if helper}
		<p id="{inputId}-helper" class="field__helper">{helper}</p>
	{/if}
</div>

<style>
.field {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
	font-family: var(--font-sans);
}

.field__label {
	font-size: var(--text-sm);
	font-weight: var(--weight-medium);
	color: var(--fg-primary);
}

.field__input {
	font-family: var(--font-sans);
	color: var(--fg-primary);
	background-color: var(--surface-1);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-2);
	padding: 0 var(--space-3);
	transition:
		border-color var(--motion-duration-fast) var(--motion-ease-standard),
		box-shadow var(--motion-duration-fast) var(--motion-ease-standard);
	width: 100%;
}

.field__input::placeholder {
	color: var(--fg-tertiary);
}

.field__input:hover:not(:disabled) {
	border-color: var(--border-strong);
}

.field__input:disabled {
	background-color: var(--surface-2);
	color: var(--fg-disabled);
	cursor: not-allowed;
}

.field--sm .field__input {
	height: 28px;
	font-size: var(--text-sm);
}
.field--md .field__input {
	height: 36px;
	font-size: var(--text-base);
}
.field--lg .field__input {
	height: 44px;
	font-size: var(--text-md);
}

.field--with-error .field__input {
	border-color: var(--danger-500);
}

.field__helper {
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
	margin: 0;
}

.field__error {
	font-size: var(--text-xs);
	color: var(--danger-700);
	margin: 0;
}
</style>

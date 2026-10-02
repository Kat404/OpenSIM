<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronDown } from 'lucide-svelte';

	interface Option {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		label?: string;
		helper?: string;
		error?: string;
		options: Option[];
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		required?: boolean;
		name?: string;
		id?: string;
		children?: Snippet;
	}

	let {
		label,
		helper,
		error,
		options,
		value = $bindable(''),
		placeholder = 'Selecciona una opción',
		disabled = false,
		required = false,
		name,
		id,
		children
	}: Props = $props();

	const autoId = $props.id();
	const fieldId = $derived(id ?? autoId);
	const hasError = $derived(Boolean(error));
</script>

<div class="select" class:select--error={hasError}>
	{#if label}
		<label class="select__label" for={fieldId}>{label}{#if required}<span aria-hidden="true"> *</span>{/if}</label>
	{/if}
	<div class="select__wrap">
		<select
			id={fieldId}
			{name}
			class="select__native"
			{disabled}
			{required}
			bind:value
			aria-invalid={hasError ? 'true' : undefined}
		>
			{#if placeholder}
				<option value="" disabled>{placeholder}</option>
			{/if}
			{#each options as opt (opt.value)}
				<option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
			{/each}
		</select>
		<span class="select__icon" aria-hidden="true">
			<ChevronDown size={16} strokeWidth={1.75} />
		</span>
	</div>
	{@render children?.()}
	{#if error}
		<p class="select__error" role="alert">{error}</p>
	{:else if helper}
		<p class="select__helper">{helper}</p>
	{/if}
</div>

<style>
	.select {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-family: var(--font-sans);
	}

	.select__label {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--fg-primary);
	}

	.select__wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.select__native {
		appearance: none;
		-webkit-appearance: none;
		background-color: var(--surface-1);
		color: var(--fg-primary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-2);
		padding: 0 var(--space-8) 0 var(--space-3);
		height: 36px;
		width: 100%;
		font-family: inherit;
		font-size: var(--text-base);
		cursor: pointer;
		transition:
			border-color var(--motion-duration-fast) var(--motion-ease-standard),
			box-shadow var(--motion-duration-fast) var(--motion-ease-standard);
	}

	.select__native:hover:not(:disabled) {
		border-color: var(--border-strong);
	}

	.select__native:disabled {
		background-color: var(--surface-2);
		color: var(--fg-disabled);
		cursor: not-allowed;
	}

	.select__icon {
		position: absolute;
		right: var(--space-2);
		pointer-events: none;
		color: var(--fg-tertiary);
		display: inline-flex;
	}

	.select--error .select__native {
		border-color: var(--danger-500);
	}

	.select__helper,
	.select__error {
		font-size: var(--text-xs);
		margin: 0;
	}

	.select__helper {
		color: var(--fg-tertiary);
	}

	.select__error {
		color: var(--danger-700);
	}
</style>
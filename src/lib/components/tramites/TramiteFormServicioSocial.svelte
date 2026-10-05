<!--
  OpenSIM — Servicio Social form (Phase 4 Tarea 4.2).

  Static form surface for the academic procedure. Submission is a
  Phase 5+ concern; for now the form posts to the page's default
  action which returns a 'Trámite en desarrollo' notice.

  The component is *content-only*: the parent stepper controls the
  layout and the disabled state. The form's submit button is the
  Stepper's primary action so disabled propagation is consistent.

  A native <textarea> is used for the long-text field — there is no
  Textarea atom in the 18-component set and the spec forbids
  modifying them.
-->
<script lang="ts">
import { Badge, Button, Card, Input, Select } from "#lib/components/ui";
import { PROCEDURE_STATE_LABEL } from "#lib/utils/procedure-labels";

interface Props {
	unlocked: boolean;
}

let { unlocked }: Props = $props();

const _dependencyOptions = [
	{ value: "", label: "Selecciona una dependencia" },
	{ value: "imss", label: "IMSS" },
	{ value: "gobierno-estatal", label: "Gobierno del Estado de Michoacán" },
	{ value: "municipio", label: "Ayuntamiento de Morelia" },
	{ value: "universidad", label: "Universidad Michoacana" },
	{ value: "empresa-privada", label: "Empresa privada" },
	{ value: "otro", label: "Otra" },
];

const modalityOptions = [
	{ value: "presencial", label: "Presencial" },
	{ value: "mixto", label: "Mixto" },
	{ value: "investigacion", label: "Vinculación a investigación" },
];
</script>

<Card padding="lg">
	{#snippet header()}
		<div class="form__header">
			<h3 class="form__title">Datos del programa de Servicio Social</h3>
			<Badge variant={unlocked ? "success" : "neutral"} size="sm" dot>
				{PROCEDURE_STATE_LABEL[unlocked ? "AVAILABLE" : "LOCKED"]}
			</Badge>
		</div>
	{/snippet}

	<fieldset class="form" disabled={!unlocked}>
		<Input
			label="Dependencia receptora"
			helper="Organización donde realizarás las 500 horas."
			placeholder="IMSS — Hospital General"
			name="dependency"
		/>

		<Input
			label="Nombre del programa o proyecto"
			placeholder="Mantenimiento de equipo médico"
			name="program"
		/>

		<Input label="Ubicación" placeholder="Morelia, Michoacán" name="location" />

		<Select label="Modalidad" options={modalityOptions} value="presencial" name="modality" />

		<label class="form__field">
			<span class="form__label">Objetivo general del programa</span>
			<span class="form__helper">2-3 oraciones resumiendo el aporte a la dependencia.</span>
			<textarea
				class="form__textarea"
				rows="4"
				placeholder="Apoyar al área de TI en el mantenimiento..."
				name="objective"
				disabled={!unlocked}
			></textarea>
		</label>

		<Button type="submit" variant="primary" size="md" disabled={!unlocked}>
			Enviar solicitud
		</Button>
	</fieldset>
</Card>

<style>
.form__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-2);
}

.form__title {
	margin: 0;
	font-size: var(--text-md);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.form {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
	border: 0;
	padding: 0;
	margin: 0;
	min-width: 0;
}

.form:disabled {
	opacity: 0.6;
}

.form__field {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
	font-family: var(--font-sans);
}

.form__label {
	font-size: var(--text-sm);
	font-weight: var(--weight-medium);
	color: var(--fg-primary);
}

.form__helper {
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
}

.form__textarea {
	font-family: inherit;
	color: var(--fg-primary);
	background-color: var(--surface-1);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-2);
	padding: var(--space-2) var(--space-3);
	font-size: var(--text-base);
	min-height: 88px;
	resize: vertical;
	transition:
		border-color var(--motion-duration-fast) var(--motion-ease-standard),
		box-shadow var(--motion-duration-fast) var(--motion-ease-standard);
}

.form__textarea:focus {
	outline: none;
	border-color: var(--brand-500);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-500) 18%, transparent);
}

.form__textarea:disabled {
	background-color: var(--surface-2);
	color: var(--fg-disabled);
	cursor: not-allowed;
}
</style>

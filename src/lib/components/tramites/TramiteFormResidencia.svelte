<!--
  OpenSIM — Residencia Profesional form (Phase 4 Tarea 4.2).

  Static form surface. Requires >= 208 CR (80% of 260). Submission
  is a Phase 5+ concern; for now the form posts to the page's
  default action which returns a 'Trámite en desarrollo' notice.
-->
<script lang="ts">
import { Badge, Button, Card, Input, Select } from "#lib/components/ui";
import { PROCEDURE_STATE_LABEL } from "#lib/utils/procedure-labels";

interface Props {
	unlocked: boolean;
}

let { unlocked }: Props = $props();

const modalityOptions = [
	{ value: "interna", label: "Empresa privada" },
	{ value: "publica", label: "Dependencia pública" },
	{ value: "investigacion", label: "Vinculación a investigación" },
	{ value: "emprendimiento", label: "Emprendimiento propio" },
];
</script>

<Card padding="lg">
	{#snippet header()}
		<div class="form__header">
			<h3 class="form__title">Datos de la Residencia Profesional</h3>
			<Badge variant={unlocked ? "success" : "neutral"} size="sm" dot>
				{PROCEDURE_STATE_LABEL[unlocked ? "AVAILABLE" : "LOCKED"]}
			</Badge>
		</div>
	{/snippet}

	<fieldset class="form" disabled={!unlocked}>
		<Input
			label="Empresa o institución"
			placeholder="Tecnológico Nacional de México — Morelia"
			name="company"
		/>

		<Input
			label="Nombre del proyecto"
			placeholder="Migración de base de datos legacy a PostgreSQL"
			name="project"
		/>

		<Input
			label="Asesor interno (TecNM)"
			placeholder="Nombre completo del asesor"
			name="advisorInternal"
		/>

		<Input
			label="Asesor externo"
			placeholder="Ing. Carlos Méndez (líder de proyecto)"
			name="advisorExternal"
		/>

		<Select label="Modalidad" options={modalityOptions} value="publica" name="modality" />

		<label class="form__field">
			<span class="form__label">Objetivo del proyecto</span>
			<span class="form__helper">Resumen ejecutivo (200-400 palabras).</span>
			<textarea
				class="form__textarea"
				rows="5"
				placeholder="Migrar 12 GB de datos..."
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
	min-height: 110px;
	resize: vertical;
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

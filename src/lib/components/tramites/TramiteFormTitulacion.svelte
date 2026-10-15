<!--
  OpenSIM — Titulación form (Phase 4 Tarea 4.2).

  Static form surface. Requires all credits + Servicio Social done.
  Submission is a Phase 5+ concern; for now the form posts to the
  page's default action which returns a 'Trámite en desarrollo'
  notice.
-->
<script lang="ts">
import { Badge, Button, Card, Input, Select } from "#lib/components/ui";
import { PROCEDURE_STATE_LABEL } from "#lib/utils/procedure-labels";

interface Props {
	unlocked: boolean;
}

let { unlocked }: Props = $props();

const modalityOptions = [
	{ value: "tesis", label: "Tesis" },
	{ value: "informe-residencia", label: "Informe de Residencia" },
	{ value: "proyecto-investigacion", label: "Proyecto de investigación" },
	{ value: "examen-conocimientos", label: "Examen de conocimientos" },
	{ value: "promedio", label: "Excelencia académica (promedio >= 9.0)" },
];
</script>

<Card padding="lg">
	{#snippet header()}
		<div class="form__header">
			<h3 class="form__title">Datos de Titulación</h3>
			<Badge variant={unlocked ? "success" : "neutral"} size="sm" dot>
				{PROCEDURE_STATE_LABEL[unlocked ? "AVAILABLE" : "LOCKED"]}
			</Badge>
		</div>
	{/snippet}

	<fieldset class="form" disabled={!unlocked}>
		<Select
			label="Modalidad de titulación"
			options={modalityOptions}
			value="informe-residencia"
			name="modality"
			helper="Selecciona la opción que mejor describe tu trabajo final."
		/>

		<Input
			label="Título del trabajo"
			placeholder="Migración de base de datos legacy a PostgreSQL"
			name="title"
		/>

		<Input
			label="Director de tesis (si aplica)"
			placeholder="Nombre completo del asesor"
			name="director"
		/>

		<Input
			label="Sinodal presidente"
			placeholder="Nombre completo del sinodal presidente"
			name="reviewer1"
		/>

		<Input
			label="Sinodal secretario"
			placeholder="Nombre completo del sinodal secretario"
			name="reviewer2"
		/>

		<Input label="Sinodal vocal" placeholder="Nombre completo del sinodal vocal" name="reviewer3" />

		<Button type="submit" variant="primary" size="md" disabled={!unlocked}>
			Programar acto de titulación
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
</style>

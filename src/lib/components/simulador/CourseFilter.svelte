<!--
  OpenSIM — Course filter panel for the Reinscripción simulator.

  A GET form: submitting it navigates to `/reinscripcion?q=…&credits=…`,
  the loader narrows in SQL, and the page comes back paged (T9.14). The
  inputs are therefore uncontrolled — the loader's value is what was
  last submitted, and the browser owns anything typed since.

  Filters:
    - Free-text search (code + name, accent-insensitive in SQL)
    - Subject area (single-select, inert — see below)
    - Credits (single-select: all, ≤4, =5)

  The area select carries no `name`, so it is never submitted and never
  reaches the server. `subjects.area` is NULL for all 68 subjects — no
  source establishes the classification (H4) — so there is nothing to
  filter on; keeping the control inert is deliberate and adding a way to
  set it would be a lie.

  The "only conflicts" toggle is gone. It cannot be a query parameter
  (a conflict depends on what the student has ticked, which is client
  state) and it could never return a row: the SIM publishes no timetable
  for the catalogue (H11), so `allConflictIds` never holds a selectable
  group. It was a control that always answered "nothing matches".

  The components are typed in English (per convention §13); UI copy
  is Spanish.
-->
<script lang="ts">
import { Funnel } from "@lucide/svelte";
import { Badge, Button, Input, Select } from "#lib/components/ui";

interface Props {
	areas: string[];
	query: string;
	area: string;
	credits: "" | "lt5" | "eq5";
	period: string;
	totalCount: number;
}

let { areas, query, area, credits, period, totalCount }: Props = $props();

const areaOptions = $derived([
	{ value: "", label: "Todas las áreas" },
	...areas.map((a) => ({ value: a, label: a })),
]);

const creditOptions = [
	{ value: "", label: "Todos los créditos" },
	{ value: "lt5", label: "Menos de 5 créditos" },
	{ value: "eq5", label: "5 créditos" },
];
</script>

<form class="filter" method="GET" aria-label="Filtros de la oferta académica">
	<!-- Carries the resolved term so a filter submit cannot silently
		 re-resolve it to a different one mid-browse. -->
	<input type="hidden" name="period" value={period}>

	<header class="filter__header">
		<h2 class="filter__title">
			<Funnel size={16} strokeWidth={1.75} aria-hidden="true" />
			Filtrar oferta
		</h2>
		<Badge variant="neutral" size="sm"> {totalCount} grupos </Badge>
	</header>

	<div class="filter__row">
		<Input
			label="Buscar"
			type="search"
			name="q"
			placeholder="Código o nombre de la asignatura"
			value={query}
		/>
	</div>

	<div class="filter__row">
		<Select label="Área" options={areaOptions} value={area} />
	</div>

	<div class="filter__row">
		<Select label="Créditos" name="credits" options={creditOptions} value={credits} />
	</div>

	<Button type="submit" variant="secondary" size="sm" fullWidth>Filtrar</Button>
</form>

<style>
.filter {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-4);
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
	font-family: var(--font-sans);
	min-width: 0;
}

.filter__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-2);
}

.filter__title {
	display: inline-flex;
	align-items: center;
	gap: var(--space-2);
	margin: 0;
	font-size: var(--text-sm);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.filter__row {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}
</style>

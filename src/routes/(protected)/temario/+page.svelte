<!--
  OpenSIM — Temario por materia (T9.12).

  The first consumer of `subject_units`. Operator decision, 2026-10-13:
  explicit coverage. The page states how many of the plan's subjects have a
  published syllabus and names the cause of the gap, then splits the list in
  two so a subject the portal never published never reads like a subject
  with an empty syllabus.

  Units live inside a collapsed <details> on purpose: the plan has 32 units
  and 223 subtopics, and rendering all of them open is the same 2 450-node
  page T9.14 removed from /reinscripcion.
-->
<script lang="ts">
import { Badge } from "#lib/components/ui";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

const conTemario = $derived(data.subjects.filter((s) => s.units.length > 0));
const sinTemario = $derived(data.subjects.filter((s) => s.units.length === 0));
const subtopicCount = $derived(
	data.subjects.reduce(
		(total, s) => total + s.units.reduce((n, u) => n + u.subtopics.length, 0),
		0,
	),
);

function windowText(from: string | null, to: string | null): string {
	if (from && to) return `${from} – ${to}`;
	if (from) return `Desde ${from}`;
	if (to) return `Hasta ${to}`;
	return "";
}
</script>

<svelte:head>
	<title>Temario — OpenSIM</title>
	<meta name="description" content="Temario publicado por el portal, materia por materia.">
</svelte:head>

<section class="temario">
	<header class="temario__header">
		<p class="temario__eyebrow">Temario</p>
		<h1 class="temario__title">Temario por materia</h1>
		<p class="temario__coverage">
			<strong>{data.coverage.withTemario}</strong>
			de <strong>{data.coverage.total}</strong>
			materias tienen temario publicado
			{#if subtopicCount > 0}
				· {subtopicCount} subtemas
			{/if}
		</p>
		<p class="temario__note">
			El portal del SIM publica el temario sólo de las materias del periodo activo, no de todo el
			plan. Una materia sin temario aquí significa que el portal no lo publica, no que la
			institución no lo tenga.
		</p>
	</header>

	{#if conTemario.length > 0}
		<section class="temario__group" aria-labelledby="temario-con">
			<h2 class="temario__group-title" id="temario-con">
				Con temario publicado
				<Badge variant="success" size="sm">{conTemario.length}</Badge>
			</h2>
			<ul class="temario__list">
				{#each conTemario as subject (subject.canonicalId)}
					<li>
						<details class="temario__item">
							<summary class="temario__summary">
								<span class="temario__code">{subject.code}</span>
								<span class="temario__name">{subject.name}</span>
								<Badge variant="neutral" size="sm"
									>{subject.units.length}
									{subject.units.length === 1 ? "unidad" : "unidades"}</Badge
								>
							</summary>
							<ol class="temario__units">
								{#each subject.units as unit (unit.unitNumber)}
									<li class="temario__unit">
										<p class="temario__unit-title">
											<span class="temario__unit-number">Unidad {unit.unitNumber}</span>
											{unit.title}
										</p>
										{#if windowText(unit.evalFrom, unit.evalTo)}
											<p class="temario__unit-window">
												Evaluación: {windowText(unit.evalFrom, unit.evalTo)}
											</p>
										{/if}
										{#if unit.subtopics.length > 0}
											<ul class="temario__subtopics">
												{#each unit.subtopics as subtopic, index (`${unit.unitNumber}-${index}`)}
													<li class="temario__subtopic">
														{#if subtopic.index}
															<span class="temario__subtopic-index">{subtopic.index}</span>
														{/if}
														<span class="temario__subtopic-title">{subtopic.title}</span>
														{#if windowText(subtopic.evalFrom, subtopic.evalTo)}
															<span class="temario__subtopic-window">
																{windowText(subtopic.evalFrom, subtopic.evalTo)}
															</span>
														{/if}
													</li>
												{/each}
											</ul>
										{/if}
										{#if unit.instruments.length > 0}
											<p class="temario__meta">Instrumentos: {unit.instruments.join(", ")}</p>
										{/if}
										{#if unit.criteria.length > 0}
											<p class="temario__meta">Criterios: {unit.criteria.join(", ")}</p>
										{/if}
									</li>
								{/each}
							</ol>
						</details>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if sinTemario.length > 0}
		<section class="temario__group" aria-labelledby="temario-sin">
			<h2 class="temario__group-title" id="temario-sin">
				Sin temario publicado por el portal
				<Badge variant="warning" size="sm">{sinTemario.length}</Badge>
			</h2>
			<ul class="temario__list">
				{#each sinTemario as subject (subject.canonicalId)}
					<li class="temario__item temario__item--absent">
						<span class="temario__code">{subject.code}</span>
						<span class="temario__name">{subject.name}</span>
						<span class="temario__absent-note"
							>El portal no publica el temario de esta materia</span
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.subjects.length === 0}
		<p class="temario__empty">No hay materias en el plan todavía.</p>
	{/if}
</section>

<style>
.temario {
	display: flex;
	flex-direction: column;
	gap: var(--space-5);
}

.temario__header {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}

.temario__eyebrow {
	margin: 0;
	font-size: var(--text-xs);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--fg-tertiary);
}

.temario__title {
	margin: 0;
	font-size: var(--text-2xl);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.temario__coverage {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-secondary);
}

.temario__note {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
	max-width: 720px;
}

.temario__group {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.temario__group-title {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	margin: 0;
	font-size: var(--text-md);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.temario__list {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
	margin: 0;
	padding: 0;
	list-style: none;
}

.temario__item {
	border: 1px solid var(--border-default);
	border-radius: var(--radius-2);
	padding: var(--space-2) var(--space-3);
}

.temario__item--absent {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: var(--space-2);
	font-size: var(--text-sm);
	background-color: var(--bg-subtle);
}

.temario__summary {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--space-2);
	cursor: pointer;
	font-size: var(--text-sm);
}

.temario__code {
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.temario__name {
	color: var(--fg-secondary);
}

.temario__absent-note {
	color: var(--fg-tertiary);
	font-size: var(--text-xs);
}

.temario__units {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	margin: var(--space-3) 0 0;
	padding-left: var(--space-4);
}

.temario__unit {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}

.temario__unit-title {
	margin: 0;
	font-size: var(--text-sm);
	font-weight: var(--weight-medium, 500);
	color: var(--fg-primary);
}

.temario__unit-number {
	color: var(--fg-tertiary);
	margin-right: var(--space-1);
}

.temario__unit-window,
.temario__meta {
	margin: 0;
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
}

.temario__subtopics {
	display: flex;
	flex-direction: column;
	gap: 2px;
	margin: 0;
	padding-left: var(--space-4);
	list-style: none;
}

.temario__subtopic {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: var(--space-2);
	font-size: var(--text-xs);
	color: var(--fg-secondary);
}

.temario__subtopic-index {
	font-weight: var(--weight-semibold);
	color: var(--fg-tertiary);
}

.temario__subtopic-window {
	color: var(--fg-tertiary);
}

.temario__empty {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
}
</style>

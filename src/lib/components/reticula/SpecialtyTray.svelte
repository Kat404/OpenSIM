<!--
  OpenSIM — Specialty module tray for /retícula.

  The 16 specialty modules have no registered semester (H8: the plan does
  not publish the term they are taken in), so the DAG cannot place them on
  the grid. Dropping them silently was the failure Phase 9 exists to
  remove — the student saw 52 of 68 subjects with no explanation.

  This tray explains them, and it lists ONLY the student's own specialty.
  The other eleven specialty programmes belong to other careers; the loader
  resolves that with `inStudentSpecialty`, so nothing else can reach this
  component even if the page tried.

  It invents nothing: no term, no order, no timetable.
-->
<script lang="ts">
import type { SubjectViewModel } from "#lib/components/curriculum/SubjectNode.svelte";
import type { StudentProgressStatus } from "#lib/server/db/schema";
import { STATUS_COLOR_VAR, STATUS_LABEL } from "#lib/utils/status-labels";

interface Props {
	subjects: SubjectViewModel[];
	statusByCanonicalId: Record<string, StudentProgressStatus>;
}

let { subjects, statusByCanonicalId }: Props = $props();
</script>

<section class="tray" aria-labelledby="specialty-tray-title" data-testid="specialty-tray">
	<h2 class="tray__title" id="specialty-tray-title">Módulos de tu especialidad</h2>
	<p class="tray__note">
		El plan de estudios no registra el semestre en que se cursan, por eso no aparecen en la
		retícula.
	</p>
	<ul class="tray__list">
		{#each subjects as s (s.canonicalId)}
			{@const status = statusByCanonicalId[s.canonicalId] ?? "AVAILABLE"}
			<li class="tray__item">
				<span class="tray__code">{s.code}</span>
				<span class="tray__name">{s.name}</span>
				<span class="tray__credits">{s.credits} cr</span>
				<span
					class="tray__status tray__status--{status.toLowerCase()}"
					style:background-color="var({STATUS_COLOR_VAR[status].surface})"
					style:border-color="var({STATUS_COLOR_VAR[status].border})"
				>
					{STATUS_LABEL[status]}
				</span>
			</li>
		{/each}
	</ul>
</section>

<style>
.tray {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	padding: var(--space-4);
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
}

.tray__title {
	margin: 0;
	font-size: var(--text-md);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.tray__note {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-secondary);
}

.tray__list {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	margin: var(--space-2) 0 0;
	padding: 0;
	list-style: none;
}

.tray__item {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: var(--space-3);
	padding: var(--space-2);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-2);
}

.tray__code {
	font-family: var(--font-mono);
	font-size: var(--text-sm);
	font-weight: 600;
	color: var(--fg-primary);
}

.tray__name {
	flex: 1 1 12rem;
	font-size: var(--text-sm);
	color: var(--fg-secondary);
}

.tray__credits {
	font-family: var(--font-mono);
	font-size: var(--text-xs);
	color: var(--fg-secondary);
}

.tray__status {
	padding: 0 var(--space-2);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-2);
	font-size: var(--text-xs);
	color: var(--fg-primary);
	white-space: nowrap;
}
</style>

<!--
  OpenSIM — Stateful parent for the Reinscripción simulator.

  The page (`/reinscripcion`) ships ONE PAGE of the catalog (groups +
  blocks + the student's already-enrolled set) plus the totals for the
  current filter. The simulator owns the *selection* — the set of
  `groupId`s the user has ticked — and derives everything else:
    - candidate schedule blocks (the blocks of the selected groups)
    - conflict annotation (pure helper, see schedule-conflict.ts)
    - selected credits total
  It does NOT filter: `groups` already answers "which groups match",
  because the loader narrowed and paged it in SQL. A second chain here
  would be a second answer to the same question, and the page would be
  back to 475 rows the moment a filter is cleared.

  Selection is therefore per page: ticking a group and paging away drops
  the tick. That is the honest reading of a server-side page — the
  server has no idea what was ticked.

  Submitting the form posts `groupId` for every selected group; the
  server-side action re-validates and inserts the rows. The page
  uses SvelteKit's default form submission (no client-side enhance)
  so the bundle stays under the 100KB budget.

  `candidateBlocks` is therefore always empty: the student can only
  select offering-catalogue groups (the student's own groups arrive
  pre-filtered as `alreadyEnrolled`), and the SIM publishes no
  timetable for the catalogue, so `allBlocks` holds no row for any
  selectable group. `findConflicts` is kept because it is the correct
  rule for the enrolled schedule and it starts working the moment an
  offering export carries blocks — it is the DATA that is missing, not
  the check. The note rendered above the grid says so out loud rather
  than letting an empty grid imply "no conflicts".
-->
<script lang="ts">
import { AlertCircle, CheckCircle2, FileSignature } from "lucide-svelte";
import { Badge, Button, Card } from "#lib/components/ui";
import { findConflicts } from "#lib/utils/schedule-conflict";
import CourseFilter from "./CourseFilter.svelte";
import SchedulePreview, { type PreviewBlock } from "./SchedulePreview.svelte";
import type { OfferBlock, OfferGroup, OfferPage } from "./types";

interface Props {
	period: string | null;
	groups: OfferGroup[];
	allBlocks: OfferBlock[];
	enrolledCanonicalIds: string[];
	enrolledBlocks: OfferBlock[];
	offer: OfferPage;
	formError?: string | null;
}

let {
	period,
	groups,
	allBlocks,
	enrolledCanonicalIds,
	enrolledBlocks,
	offer,
	formError = null,
}: Props = $props();

// ---------- Selection state ----------
let selectedIds = $state<Set<string>>(new Set());

const groupToEnrolled = $derived(new Set(enrolledCanonicalIds));
const _groupIdToCanonical = $derived(new Map(groups.map((g) => [g.groupId, g.subjectCanonicalId])));

// Compute conflict set once per render so the table + the
// preview agree on the same answer.
const allConflictIds = $derived.by(() => {
	const candidateBlockIds = new Set(
		allBlocks.filter((b) => selectedIds.has(b.groupId)).map((b) => b.id),
	);
	const candidateBlocks = allBlocks.filter((b) => candidateBlockIds.has(b.id));
	const enrolled: { id: number; day: string; startTime: string; endTime: string }[] =
		enrolledBlocks.map((b) => ({
			id: b.id,
			day: b.day,
			startTime: b.startTime,
			endTime: b.endTime,
		}));
	const ids = findConflicts(candidateBlocks, enrolled);
	// Pair conflicts back to the groupId so the table can flag
	// the row.
	const groupIds = new Set<string>();
	for (const b of candidateBlocks) {
		if (ids.has(b.id)) groupIds.add(b.groupId);
	}
	return groupIds;
});

const selectedGroups = $derived(groups.filter((g) => selectedIds.has(g.groupId)));
const selectedCredits = $derived(selectedGroups.reduce((acc, g) => acc + g.credits, 0));

// ---------- Derived: schedule preview shapes ----------
function blockToPreview(b: OfferBlock, kind: "enrolled" | "candidate"): PreviewBlock {
	const g = groups.find((x) => x.groupId === b.groupId);
	return {
		id: b.id,
		groupId: b.groupId,
		day: b.day,
		startTime: b.startTime,
		endTime: b.endTime,
		classroom: b.classroom,
		subjectCode: g?.subjectCode ?? "—",
		subjectName: g?.subjectName ?? "",
		teacherName: g?.teacherName ?? "",
		kind,
	};
}

const enrolledPreview = $derived(enrolledBlocks.map((b) => blockToPreview(b, "enrolled")));
const candidatePreview = $derived(
	allBlocks.filter((b) => selectedIds.has(b.groupId)).map((b) => blockToPreview(b, "candidate")),
);

const selectionHasConflict = $derived(allConflictIds.size > 0);
const selectionCount = $derived(selectedIds.size);

function toggleGroup(groupId: string): void {
	const next = new Set(selectedIds);
	if (next.has(groupId)) next.delete(groupId);
	else next.add(groupId);
	selectedIds = next;
}

function isSelected(groupId: string): boolean {
	return selectedIds.has(groupId);
}

/**
 * The pager's target URL. Carries the current filter plus the term, so
 * paging never drops the query and never re-resolves the period.
 */
function pageHref(target: number): string {
	const params = new URLSearchParams();
	if (period) params.set("period", period);
	if (offer.query) params.set("q", offer.query);
	if (offer.credits) params.set("credits", offer.credits);
	if (target > 1) params.set("page", String(target));
	return `?${params.toString()}`;
}

/**
 * Row metadata, built by joining the parts that exist. A null `area` is
 * skipped entirely rather than rendered as an empty string, which would
 * leave the line starting with a bare "·".
 */
function rowMeta(g: OfferGroup): string {
	return [g.area, `${g.credits} créditos`, g.teacherName, g.hasLab ? "Lab" : null]
		.filter((part): part is string => part !== null)
		.join(" · ");
}
</script>

{#if !period}
	<div class="simulator">
		<Card padding="lg">
			<p class="simulator__empty">No hay un periodo activo para reinscribirte. Vuelve más tarde.</p>
		</Card>
	</div>
{:else}
	<!--
		The filter form is a sibling of the POST form, not a child: HTML
		forbids nesting, and the browser would otherwise drop one of them.
	-->
	<div class="simulator">
		<aside class="simulator__filter">
			<!--
				`areas` is empty by construction, not by accident:
				`subjects.area` is NULL for all 68 subjects (H4), so the
				page has nothing to populate the option list with.
			-->
			<CourseFilter
				areas={[]}
				query={offer.query}
				area=""
				credits={offer.credits}
				{period}
				totalCount={offer.totalCount}
			/>
		</aside>

		<form method="POST" action="?/enroll" class="simulator__enroll">
			<section class="simulator__catalog" aria-label="Oferta académica">
				<header class="simulator__catalog-header">
					<h2 class="simulator__catalog-title">Oferta disponible</h2>
					<p class="simulator__catalog-sub">Periodo: <strong>{period}</strong></p>
				</header>

				{#if groupToEnrolled.size > 0}
					<div class="simulator__enrolled-note">
						<CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" />
						<span
							>Inscrito en {groupToEnrolled.size}
							{groupToEnrolled.size === 1 ? "materia" : "materias"}
							este periodo.</span
						>
					</div>
				{/if}

				{#if formError}
					<div class="simulator__error" role="alert">
						<AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
						<span>{formError}</span>
					</div>
				{/if}

				{#if groups.length === 0}
					<p class="simulator__empty">No hay grupos que coincidan con los filtros.</p>
				{:else}
					<ul class="simulator__list">
						{#each groups as g (g.groupId)}
							{@const conflicts = allConflictIds.has(g.groupId)}
							<li class="simulator__row" class:simulator__row--conflict={conflicts}>
								<label class="simulator__row-label">
									<input
										type="checkbox"
										name="groupId"
										value={g.groupId}
										checked={isSelected(g.groupId)}
										onchange={() => toggleGroup(g.groupId)}
										aria-describedby={`g-${g.groupId}-meta`}
									>
									<span class="simulator__row-body">
										<span class="simulator__row-top">
											<span class="simulator__row-code">{g.subjectCode}</span>
											<span class="simulator__row-name">{g.subjectName}</span>
										</span>
										<span class="simulator__row-meta" id={`g-${g.groupId}-meta`}>
											{rowMeta(g)}
										</span>
										{#if conflicts}
											<Badge variant="danger" size="sm" dot>
												<AlertCircle size={12} strokeWidth={2} aria-hidden="true" />
												Conflicto de horario
											</Badge>
										{/if}
									</span>
								</label>
							</li>
						{/each}
					</ul>
				{/if}

				{#if offer.pages > 1}
					<nav class="simulator__pager" aria-label="Paginación de la oferta">
						{#if offer.page > 1}
							<a class="simulator__pager-link" href={pageHref(offer.page - 1)} rel="prev"
								>Anterior</a
							>
						{/if}
						<span class="simulator__pager-status">Página {offer.page} de {offer.pages}</span>
						{#if offer.page < offer.pages}
							<a class="simulator__pager-link" href={pageHref(offer.page + 1)} rel="next"
								>Siguiente</a
							>
						{/if}
					</nav>
				{/if}
			</section>

			<section class="simulator__preview" aria-label="Vista previa del horario">
				<header class="simulator__preview-header">
					<h2 class="simulator__preview-title">Carga actual</h2>
					<Badge variant="neutral" size="sm">
						{selectionCount} {selectionCount === 1 ? "grupo" : "grupos"} ·
						{selectedCredits}
						créditos
					</Badge>
				</header>
				<!--
					The SIM publishes who teaches a group and in which term, never a
					timetable, so no selectable group carries schedule blocks. Without
					this the empty grid below reads as "your selection has no
					conflicts" when it actually means "there is nothing to compare".
				-->
				<p class="simulator__preview-note">
					El SIM no publica horarios para los grupos de la oferta, por lo que no se pueden detectar
					traslapes entre las materias que elijas.
				</p>
				<SchedulePreview enrolledBlocks={enrolledPreview} candidateBlocks={candidatePreview} />
			</section>

			<footer class="simulator__footer">
				<Button
					type="submit"
					variant="primary"
					size="lg"
					disabled={selectionCount === 0 || selectionHasConflict}
				>
					{#snippet startIcon()}
						<FileSignature size={16} strokeWidth={1.75} aria-hidden="true" />
					{/snippet}
					Inscribir y firmar
				</Button>
				<p class="simulator__footer-help">
					{#if selectionHasConflict}
						Resuelve los conflictos antes de inscribir.
					{:else if selectionCount === 0}
						Selecciona al menos un grupo.
					{:else}
						La firma registra {selectionCount} {selectionCount === 1 ? "materia" : "materias"} en tu
						historial.
					{/if}
				</p>
			</footer>
		</form>
	</div>
{/if}

<style>
.simulator {
	display: grid;
	grid-template-columns: 280px minmax(0, 1fr);
	gap: var(--space-4);
	font-family: var(--font-sans);
}

.simulator__filter {
	min-width: 0;
}

.simulator__enroll {
	display: grid;
	grid-template-rows: auto auto auto;
	gap: var(--space-4);
	min-width: 0;
	align-content: start;
}

.simulator__catalog {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	min-width: 0;
}

.simulator__catalog-header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: var(--space-2);
	flex-wrap: wrap;
}

.simulator__catalog-title {
	margin: 0;
	font-size: var(--text-md);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.simulator__catalog-sub {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
}

.simulator__enrolled-note {
	display: inline-flex;
	align-items: center;
	gap: var(--space-2);
	padding: var(--space-2) var(--space-3);
	background-color: var(--success-50);
	border: 1px solid color-mix(in srgb, var(--success-500) 20%, transparent);
	border-radius: var(--radius-2);
	color: var(--success-700);
	font-size: var(--text-sm);
}

.simulator__error {
	display: inline-flex;
	align-items: center;
	gap: var(--space-2);
	padding: var(--space-2) var(--space-3);
	background-color: var(--danger-50);
	border: 1px solid color-mix(in srgb, var(--danger-500) 20%, transparent);
	border-radius: var(--radius-2);
	color: var(--danger-700);
	font-size: var(--text-sm);
}

.simulator__list {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	list-style: none;
	margin: 0;
	padding: 0;
}

.simulator__row {
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-2);
	padding: var(--space-3);
	transition: border-color var(--motion-duration-fast) var(--motion-ease-standard);
}

.simulator__row:hover {
	border-color: var(--border-default);
}

.simulator__row--conflict {
	border-color: var(--danger-500);
}

.simulator__row-label {
	display: flex;
	align-items: flex-start;
	gap: var(--space-3);
	cursor: pointer;
}

.simulator__row-label input {
	margin-top: 4px;
	cursor: pointer;
}

.simulator__row-body {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
	min-width: 0;
}

.simulator__row-top {
	display: flex;
	align-items: baseline;
	gap: var(--space-2);
	flex-wrap: wrap;
}

.simulator__row-code {
	font-family: var(--font-mono);
	font-size: var(--text-sm);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.simulator__row-name {
	font-size: var(--text-sm);
	color: var(--fg-primary);
}

.simulator__row-meta {
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
}

.simulator__preview {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	min-width: 0;
}

.simulator__preview-header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: var(--space-2);
}

.simulator__preview-title {
	margin: 0;
	font-size: var(--text-md);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.simulator__preview-note {
	margin: 0;
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
}

.simulator__footer {
	display: flex;
	align-items: center;
	gap: var(--space-4);
	flex-wrap: wrap;
	padding: var(--space-4);
	background-color: var(--surface-1);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-3);
}

.simulator__pager {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-4);
	padding-top: var(--space-2);
}

.simulator__pager-link {
	font-size: var(--text-sm);
	color: var(--fg-primary);
	text-decoration: underline;
}

.simulator__pager-status {
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
}

.simulator__footer-help {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
}

.simulator__empty {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--fg-tertiary);
}

@media (max-width: 960px) {
	.simulator {
		grid-template-columns: 1fr;
	}
}
</style>

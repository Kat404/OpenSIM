<!--
	OpenSIM — Dev-only fixture rendering all 80 avatar cells required by
	the Phase 6.1 overlap Playwright suite (5 sizes × 2 shapes × 4 statuses).

	Each cell receives a `data-testid` HTML attribute (via the spread
	on Avatar.svelte's Props) so the spec can locate it via
	`page.getByTestId(...)`. The page itself has no visually
	distinctive layout — it is a pure fixture for headless tests.

	Production: the parent `+page.server.ts` returns 404 when !dev, so
	this component never ships in the prod bundle.
-->
<script lang="ts">
import Avatar from "#lib/components/ui/Avatar.svelte";

const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
const SHAPES = ["circle", "square"] as const;
const STATUSES = ["online", "offline", "busy", "away"] as const;
</script>

<svelte:head>
	<title>Avatar fixture (dev only)</title>
</svelte:head>

<main class="fixture" data-testid="avatar-fixture-root">
	<h1>Avatar fixture — Phase 6.1 overlap suite</h1>
	<p class="hint">
		This page renders all 40 cells (5 sizes × 2 shapes × 4 statuses). The Playwright suite exercises
		each cell under both light and dark themes for a total of 80 test cases. It is gated by
		<code>+page.server.ts</code>
		to 404 in non-dev environments.
	</p>
	{#each SIZES as size}
		<section class="row" data-testid="row-{size}">
			<h2>size: {size}</h2>
			{#each SHAPES as shape}
				<div class="cell-group" data-testid="group-{size}-{shape}">
					<h3>shape: {shape}</h3>
					{#each STATUSES as status}
						<Avatar
							name="{size} {shape} {status}"
							{size}
							{shape}
							{status}
							data-testid="avatar-{size}-{shape}-{status}"
						/>
					{/each}
				</div>
			{/each}
		</section>
	{/each}
</main>

<style>
.fixture {
	font-family: var(--font-sans);
	padding: 1.5rem;
	color: var(--fg-default);
	background: var(--surface-0);
}
.hint {
	color: var(--fg-secondary);
	font-size: var(--text-sm);
}
.row {
	margin-block: 1.5rem;
}
.cell-group {
	display: flex;
	gap: 1rem;
	align-items: center;
	flex-wrap: wrap;
	margin-block: 0.5rem;
}
h1 {
	font-size: var(--text-xl);
}
h2 {
	font-size: var(--text-lg);
	margin-block: 0.5rem 0.25rem;
}
h3 {
	font-size: var(--text-sm);
	font-weight: var(--weight-semibold);
	margin-inline-end: 0.5rem;
}
code {
	font-family: var(--font-mono);
	background: var(--surface-1);
	padding: 0 0.25rem;
	border-radius: var(--radius-1);
}
</style>

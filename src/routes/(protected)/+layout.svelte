<script lang="ts">
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<!--
  Minimal layout for the (protected) route group. The full sidebar +
  header comes in Phase 3 (Tarea 3.1). For now this just renders the
  current page with a tiny strip showing who is signed in and a logout
  button, so the auth round-trip is verifiable end-to-end.
-->
<div class="protected-shell">
	<header class="protected-shell__bar">
		<a class="protected-shell__brand" href="/dashboard">OpenSIM</a>
		<form method="POST" action="/login/logout" class="protected-shell__logout">
			<button type="submit" class="protected-shell__logout-btn">
				Cerrar sesión
			</button>
		</form>
	</header>
	<main class="protected-shell__main">
		{@render children()}
	</main>
</div>

<style>
	.protected-shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background-color: var(--surface-0, #fafafa);
		font-family: var(--font-sans, system-ui, sans-serif);
	}

	.protected-shell__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3, 0.75rem) var(--space-5, 1.25rem);
		border-bottom: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.08));
		background-color: var(--surface-1, #ffffff);
	}

	.protected-shell__brand {
		font-weight: var(--weight-semibold, 600);
		font-size: var(--text-md, 1rem);
		color: var(--fg-primary, #111);
		text-decoration: none;
	}

	.protected-shell__logout {
		margin: 0;
	}

	.protected-shell__logout-btn {
		font: inherit;
		font-size: var(--text-sm, 0.875rem);
		padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
		background: transparent;
		color: var(--fg-secondary, #444);
		border: 1px solid var(--border-default, rgba(0, 0, 0, 0.16));
		border-radius: var(--radius-2, 0.375rem);
		cursor: pointer;
	}

	.protected-shell__logout-btn:hover {
		background-color: var(--surface-2, #f3f3f3);
	}

	.protected-shell__main {
		flex: 1;
		padding: var(--space-6, 1.5rem) var(--space-5, 1.25rem);
	}
</style>

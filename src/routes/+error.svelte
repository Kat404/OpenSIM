<!--
  OpenSIM — Root error boundary.

  SvelteKit renders this when a load function throws or the user lands
  on a 404. Themed in the same surface tokens as the rest of the app
  so a thrown error doesn't drop the user into an unstyled fallback
  (audit mcode N19, Round 7).

  Status text is the page's <svelte:head><title>, not the visible
  body — keeping the visible copy generic avoids leaking internal
  state to the public error page.
-->
<script lang="ts">
import { Card } from "#lib/components/ui";
import { page } from "$app/state";

const status = $derived(page.status);
const message = $derived(page.error?.message ?? "");
const isNotFound = $derived(status === 404);
</script>

<svelte:head>
	<title>{status} — OpenSIM</title>
	<meta name="robots" content="noindex">
</svelte:head>

<main class="error" aria-labelledby="error-title">
	<Card padding="lg">
		<div class="error__inner">
			<p class="error__eyebrow" aria-hidden="true">Error {status}</p>
			<h1 id="error-title" class="error__title">
				{#if isNotFound}
					No encontramos esa página.
				{:else}
					Algo salió mal.
				{/if}
			</h1>
			<p class="error__sub">
				{#if isNotFound}
					Verifica la URL o vuelve al panel principal.
				{:else}
					Intenta de nuevo. Si el problema persiste, contacta a
					<a href="mailto:soporte.ds@morelia.tecnm.mx">soporte.ds@morelia.tecnm.mx</a>.
				{/if}
			</p>
			{#if !isNotFound && message}
				<details class="error__details">
					<summary>Detalle técnico</summary>
					<pre>{message}</pre>
				</details>
			{/if}
			<div class="error__actions">
				<a class="btn btn--primary btn--md" href="/dashboard">Volver al panel</a>
			</div>
		</div>
	</Card>
</main>

<style>
.error {
	min-height: 100dvh;
	display: grid;
	place-items: center;
	padding: var(--space-6) var(--space-4);
	background-color: var(--surface-0);
	font-family: var(--font-sans);
}

.error__inner {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	max-width: 480px;
}

.error__eyebrow {
	margin: 0;
	font-size: var(--text-xs);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--fg-tertiary);
}

.error__title {
	margin: 0;
	font-size: var(--text-2xl);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.error__sub {
	margin: 0;
	font-size: var(--text-base);
	color: var(--fg-secondary);
}

.error__sub a {
	color: var(--brand-700);
}

.error__details {
	margin-top: var(--space-2);
	padding: var(--space-2) var(--space-3);
	background-color: var(--surface-2);
	border-radius: var(--radius-2);
}

.error__details summary {
	cursor: pointer;
	font-size: var(--text-sm);
	color: var(--fg-secondary);
}

.error__details pre {
	margin: var(--space-2) 0 0;
	font-family: var(--font-mono);
	font-size: var(--text-xs);
	color: var(--fg-tertiary);
	white-space: pre-wrap;
	word-break: break-word;
}

.error__actions {
	margin-top: var(--space-2);
}

.error__actions .btn {
	text-decoration: none;
}
</style>

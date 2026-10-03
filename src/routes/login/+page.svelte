<script lang="ts">
	import { page } from '$app/state';
	import { Button, Card, Input } from '#lib/components/ui';

	// `form` is the SvelteKit action result. It is `null` on first
	// render and becomes the failure payload (from +page.server.ts)
	// when the form action returns `fail(...)`.
	let { form }: { form: { error?: string } | null } = $props();

	// `?reason=logged-out` lands here after POST /login/logout; show
	// a confirmation toast-style line. Anything else is ignored.
	const notice = $derived(page.url.searchParams.get('reason') === 'logged-out'
		? 'Sesión cerrada correctamente.'
		: null);
</script>

<svelte:head>
	<title>Iniciar sesión — OpenSIM</title>
	<meta name="description" content="Acceso al Sistema Integral Modular de TecNM Morelia." />
</svelte:head>

<main class="login">
	<div class="login__card">
		<Card padding="lg">
			<header class="login__header">
				<h1 class="login__title">Iniciar sesión</h1>
				<p class="login__sub">Sistema Integral Modular — TecNM Morelia</p>
			</header>

			<form method="POST" class="login__form" novalidate>
				{#if notice}
					<p class="login__notice" role="status">{notice}</p>
				{/if}
				<Input
					name="controlNumber"
					label="Número de control"
					placeholder="<NUMERO DE CONTROL PURGADO>"
					autocomplete="username"
					inputmode="numeric"
					required
				/>
				<Input
					name="password"
					type="password"
					label="Contraseña"
					placeholder="********"
					autocomplete="current-password"
					required
				/>

				{#if form?.error}
					<p class="login__error" role="alert">{form.error}</p>
				{/if}

				<Button type="submit" variant="primary" fullWidth>Entrar</Button>
			</form>

			<footer class="login__footer">
				<a class="login__link" href="/login/recuperar">Recordar contraseña</a>
			</footer>
		</Card>
	</div>
</main>

<style>
	.login {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: var(--space-6) var(--space-4);
		background-color: var(--surface-0);
		font-family: var(--font-sans);
	}

	.login__card {
		width: 100%;
		max-width: 380px;
	}

	.login__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-bottom: var(--space-5);
	}

	.login__title {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.login__sub {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
	}

	.login__form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.login__error {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-sm);
		color: var(--danger-700);
		background-color: var(--danger-50);
		border: 1px solid var(--danger-500);
		border-radius: var(--radius-2);
	}

	.login__notice {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-sm);
		color: var(--success-700, #15803d);
		background-color: var(--success-50, #f0fdf4);
		border: 1px solid var(--success-500, #22c55e);
		border-radius: var(--radius-2);
	}

	.login__footer {
		display: flex;
		justify-content: center;
		margin-top: var(--space-5);
	}

	.login__link {
		font-size: var(--text-sm);
		color: var(--brand-700);
		text-decoration: none;
	}

	.login__link:hover {
		text-decoration: underline;
	}
</style>

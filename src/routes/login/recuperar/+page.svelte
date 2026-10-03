<script lang="ts">
	import { Card } from '$lib/components/ui';
</script>

<svelte:head>
	<title>Recuperar contraseña — OpenSIM</title>
	<meta
		name="description"
		content="Cómo recuperar el acceso a tu cuenta del Sistema Integral Modular de TecNM Morelia."
	/>
</svelte:head>

<main class="recovery">
	<Card padding="lg">
		<header class="recovery__header">
			<h1 class="recovery__title">Recuperar contraseña</h1>
		</header>

		<section class="recovery__body">
			<p>
				OpenSIM no gestiona el restablecimiento de contraseñas por sí mismo. El acceso al Sistema
				Integral Modular está ligado a tu número de control y se administra a través de los
				procedimientos institucionales del TecNM Morelia.
			</p>

			<h2 class="recovery__sub">¿Cómo recuperar tu acceso?</h2>
			<ol class="recovery__list">
				<li>
					Envía un correo a <a class="recovery__link" href="mailto:soporte.ds@morelia.tecnm.mx"
						>soporte.ds@morelia.tecnm.mx</a
					>
					indicando tu número de control y una descripción breve del problema.
				</li>
				<li>
					Contacta al <strong>Coordinador de Carrera</strong> de Ingeniería en Sistemas
					Computacionales para validar tu identidad.
				</li>
				<li>
					Acude con el <strong>Jefe del Departamento Académico</strong> para solicitar el
					reestablecimiento de tu contraseña. Este paso es presencial y requiere identificación
					official vigente.
				</li>
			</ol>

			<p class="recovery__note">
				Por seguridad, nunca compartas tu contraseña actual por correo electrónico ni por
				mensajería instantánea.
			</p>
		</section>

		<footer class="recovery__footer">
			<a class="recovery__back" href="/login">← Volver al inicio de sesión</a>
		</footer>
	</Card>
</main>

<style>
	.recovery {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: var(--space-6) var(--space-4);
		background-color: var(--surface-0);
		font-family: var(--font-sans);
	}

	.recovery :global(.card) {
		width: 100%;
		max-width: 560px;
	}

	.recovery__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
	}

	.recovery__title {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.recovery__body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		color: var(--fg-secondary);
		font-size: var(--text-base);
		line-height: var(--leading-normal);
	}

	.recovery__sub {
		margin: var(--space-2) 0 0;
		font-size: var(--text-md);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
	}

	.recovery__list {
		margin: 0;
		padding-left: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.recovery__link {
		color: var(--brand-700);
		text-decoration: none;
	}

	.recovery__link:hover {
		text-decoration: underline;
	}

	.recovery__note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-sm);
		color: var(--warning-700);
		background-color: var(--warning-50);
		border-left: 3px solid var(--warning-500);
		border-radius: var(--radius-2);
	}

	.recovery__footer {
		display: flex;
		justify-content: center;
		margin-top: var(--space-5);
	}

	.recovery__back {
		font-size: var(--text-sm);
		color: var(--brand-700);
		text-decoration: none;
	}

	.recovery__back:hover {
		text-decoration: underline;
	}
</style>

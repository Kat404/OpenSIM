<!--
  OpenSIM — Public landing page.

  This is the front door of the app, so it says what OpenSIM is and
  what it is not. The previous version of this route was the UI
  component inventory: a gallery of atoms with hardcoded demo
  fixtures, reachable by anyone who opened the site. The inventory is
  still alive at /design-system; what changed is that the front door
  now describes the project instead of displaying its parts.

  The copy follows the README and the project's own rule: when a
  source is silent, the UI says so instead of filling the gap. Every
  number below is either published by the TecNM or stated as absent.
-->
<script lang="ts">
import { Card } from "#lib/components/ui";
</script>

<svelte:head>
	<title>OpenSIM — Rediseño libre del SIM del TecNM Morelia</title>
	<meta
		name="description"
		content="OpenSIM es un rediseño libre del Sistema Integral Modular del Instituto Tecnológico de Morelia. La versión 1 cubre la carrera de Ingeniería en Sistemas Computacionales (ISIC-2010-224)."
	>
</svelte:head>

<main class="landing">
	<header class="landing__header">
		<p class="landing__eyebrow">Rediseño libre · TecNM Morelia</p>
		<h1 class="landing__title">OpenSIM</h1>
		<p class="landing__lead">
			Una versión libre del Sistema Integral Modular, construida sobre el catálogo que el Instituto
			Tecnológico de Morelia publica — y sin inventar lo que no publica.
		</p>
		<div class="landing__actions">
			<a class="btn btn--primary btn--md" href="/login">Entrar con tu número de control</a>
			<a class="btn btn--ghost btn--md" href="/design-system">Ver el inventario de componentes</a>
		</div>
	</header>

	<section class="landing__section">
		<h2 class="landing__h2">Qué es real y qué no</h2>
		<p class="landing__text">
			El SIM es el sistema que administra la carrera. Publica parte de su información académica y
			ninguna de su planeación, así que una copia fiel es imposible por construcción. OpenSIM toma
			en serio la mitad publicada y declara la otra.
		</p>

		<div class="landing__grid">
			<Card title="Verificado del SIM" description="Lo que el TecNM publica">
				<ul class="landing__list">
					<li>Materias, códigos, créditos y prerrequisitos del plan ISIC-2010-224.</li>
					<li>El catálogo de oferta: 468 grupos.</li>
					<li>
						El temario publicado: 7 de 68 materias. La página del temario dice cuál es el ratio y
						por qué el portal no publica el resto.
					</li>
				</ul>
			</Card>

			<Card title="Fuera de alcance" description="Lo que no se inventa">
				<ul class="landing__list">
					<li>
						Horarios, salones y edificios: el portal no los publica hasta la inscripción, así que
						aquí no hay horarios inventados.
					</li>
					<li>Las demás carreras: sus datos no son obtenibles todavía.</li>
					<li>
						Los trámites: todavía no se guardan, y la pantalla lo dice antes del primer campo.
					</li>
				</ul>
			</Card>
		</div>
	</section>

	<section class="landing__section">
		<h2 class="landing__h2">Alcance de la versión 1</h2>
		<p class="landing__text">
			La versión 1 cubre una sola carrera: <strong>Ingeniería en Sistemas Computacionales</strong>
			(plan ISIC-2010-224). Las demás quedan fuera mientras sus datos no sean obtenibles. El alumno
			de demostración es un dato de ejemplo, no una persona real.
		</p>
	</section>

	<footer class="landing__footer">
		<p class="landing__text">
			Código bajo dominio público (The Unlicense). Los datos del catálogo provienen del portal
			público del TecNM Morelia.
		</p>
	</footer>
</main>

<style>
.landing {
	max-width: 960px;
	margin: 0 auto;
	padding: var(--space-8) var(--space-5);
	display: flex;
	flex-direction: column;
	gap: var(--space-8);
	font-family: var(--font-sans);
}

.landing__header {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.landing__eyebrow {
	margin: 0;
	color: var(--fg-tertiary);
	font-size: var(--text-sm);
	letter-spacing: 0.04em;
	text-transform: uppercase;
}

.landing__title {
	margin: 0;
	font-size: var(--text-3xl);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.landing__lead {
	margin: 0;
	max-width: 60ch;
	color: var(--fg-secondary);
	font-size: var(--text-lg);
	line-height: var(--leading-normal);
}

.landing__actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-3);
	margin-top: var(--space-2);
}

.landing__section {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding-bottom: var(--space-6);
	border-bottom: 1px solid var(--border-subtle);
}

.landing__h2 {
	margin: 0;
	font-size: var(--text-xl);
	font-weight: var(--weight-semibold);
	color: var(--fg-primary);
}

.landing__text {
	margin: 0;
	max-width: 70ch;
	color: var(--fg-secondary);
	font-size: var(--text-base);
	line-height: var(--leading-normal);
}

.landing__grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: var(--space-4);
	margin-top: var(--space-2);
}

.landing__list {
	margin: 0;
	padding-left: var(--space-5);
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	color: var(--fg-secondary);
	font-size: var(--text-sm);
	line-height: var(--leading-normal);
}

.landing__footer {
	color: var(--fg-tertiary);
}
</style>

<script lang="ts">
	import {
		Avatar,
		Badge,
		Button,
		Card,
		Dropdown,
		EmptyState,
		Input,
		Kbd,
		Modal,
		ProgressBar,
		Select,
		Skeleton,
		Stepper,
		Tabs,
		Tooltip,
		pushToast
	} from '#lib/components/ui';
	import { Search, Save, Trash2 } from 'lucide-svelte';

	const tabItems = [
		{ id: 'overview', label: 'Resumen' },
		{ id: 'kardex', label: 'Kardex' },
		{ id: 'reticula', label: 'Retícula' }
	];

	const stepperSteps = [
		{ id: 's1', label: 'Datos personales', description: 'Verifica tu información' },
		{ id: 's2', label: 'Selección de materias' },
		{ id: 's3', label: 'Confirmación' }
	];

	const selectOptions = [
		{ value: '1', label: 'Primero' },
		{ value: '2', label: 'Segundo' },
		{ value: '3', label: 'Tercero' }
	];

	const dropdownItems = [
		{ id: 'edit', label: 'Editar' },
		{ id: 'export', label: 'Exportar PDF' },
		{ id: 'delete', label: 'Eliminar', destructive: true, disabled: false }
	];

	let modalOpen = $state(false);
	let drawerOpen = false;
	let tabValue = $state('overview');

	function notify() {
		pushToast({ variant: 'success', title: 'Listo', description: 'Cambios guardados' });
	}
</script>

<main class="page">
	<header class="page__header">
		<h1>OpenSIM — Inventario de componentes UI</h1>
		<p class="page__sub">Verificación visual de los 18 átomos. WCAG 2.1 AA sobre tokens.</p>
	</header>

	<section class="page__section">
		<h2>Botones y entradas</h2>
		<div class="row">
			<Button>Primario</Button>
			<Button variant="secondary">Secundario</Button>
			<Button variant="ghost">Fantasma</Button>
			<Button variant="danger">Peligro</Button>
			<Button loading>Cargando</Button>
			<Button size="sm">Pequeño</Button>
			<Button size="lg">Grande</Button>
		</div>
		<div class="row">
			<Input label="Nombre" placeholder="Ada Lovelace" />
			<Select label="Semestre" options={selectOptions} placeholder="Elige" />
			<Input label="Con error" error="Campo obligatorio" />
		</div>
	</section>

	<section class="page__section">
		<h2>Estados y retroalimentación</h2>
		<div class="row">
			<Badge>Neutral</Badge>
			<Badge variant="brand">Marca</Badge>
			<Badge variant="success" dot>Aprobado</Badge>
			<Badge variant="warning" dot>Pendiente</Badge>
			<Badge variant="danger" dot>Reprobado</Badge>
			<Badge variant="info" dot>Info</Badge>
		</div>
		<div class="row">
			<ProgressBar value={68} label="Avance de carrera" showValue />
			<ProgressBar value={42} variant="warning" indeterminate label="Sincronizando" />
		</div>
		<div class="row">
			<Avatar name="Ada Lovelace" status="online" />
			<Avatar name="Alan Turing" size="lg" shape="square" status="busy" />
			<Avatar name="Grace Hopper" size="xl" />
			<Skeleton width="240px" height="16px" />
			<Skeleton shape="circle" width="40px" height="40px" />
		</div>
	</section>

	<section class="page__section">
		<h2>Organización</h2>
		<Stepper steps={stepperSteps} current={1} />
		<Tabs tabs={tabItems} bind:value={tabValue} />
		<div class="row">
			<Dropdown label="Acciones" items={dropdownItems} onSelect={(id: string) => notify()} />
			<Button onclick={() => (modalOpen = true)}>
				{#snippet startIcon()}<Search size={16} strokeWidth={1.75} />{/snippet}
				{#snippet children()}Abrir modal{/snippet}
			</Button>
		</div>
	</section>

	<section class="page__section">
		<h2>Tarjetas y atajos</h2>
		<div class="grid">
			<Card title="Kardex" description="Tu historial académico">
				<Badge variant="success" dot>Aprobado</Badge>
			</Card>
			<Card title="Retícula" description="Plan ISIC-2010-224" interactive>
				<p>Haz clic para ver el grafo DAG de prerrequisitos.</p>
			</Card>
			<Card title="Vacío" padding="lg">
				<EmptyState
					title="Sin notificaciones"
					description="Cuando recibas avisos nuevos aparecerán aquí."
				>
					{#snippet action()}
						<Button size="sm">Reintentar</Button>
					{/snippet}
				</EmptyState>
			</Card>
		</div>
		<div class="row">
			<Tooltip content="Guardar cambios">
				<Button>
					{#snippet startIcon()}<Save size={16} strokeWidth={1.75} />{/snippet}
					{#snippet children()}Guardar{/snippet}
				</Button>
			</Tooltip>
			<Tooltip content="Eliminar elemento" placement="right">
				<Button variant="danger">
					{#snippet startIcon()}<Trash2 size={16} strokeWidth={1.75} />{/snippet}
					{#snippet children()}Eliminar{/snippet}
				</Button>
			</Tooltip>
			<Kbd size="md">Ctrl</Kbd>
			<Kbd>+</Kbd>
			<Kbd>K</Kbd>
		</div>
	</section>

	<Modal bind:open={modalOpen} title="Confirmar reinscripción" description="Revisa tu selección antes de continuar.">
		<p>Esta acción registra tus materias para el período actual.</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (modalOpen = false)}>Cancelar</Button>
			<Button onclick={() => (modalOpen = false)}>Confirmar</Button>
		{/snippet}
	</Modal>
</main>

<style>
	.page {
		max-width: 960px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
		font-family: var(--font-sans);
	}

	.page__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.page__sub {
		margin: 0;
		color: var(--fg-tertiary);
		font-size: var(--text-sm);
	}

	.page__section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-bottom: var(--space-6);
		border-bottom: 1px solid var(--border-subtle);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-4);
	}
</style>
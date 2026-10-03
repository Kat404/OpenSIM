<!--
  OpenSIM — Sidebar nav for the (protected) layout.

  Collapsible on narrow screens, default-open on viewports >= 1024px
  (controlled by the parent LayoutShell via the `collapsed` prop +
  a manual toggle button). Nav items use the existing lucide-svelte
  icons; the active route is matched by the current `$page.url.pathname`
  prefix (with exact match for `/dashboard` so `/dashboard/whatever`
  does not always win).

  Items `Reinscripción` and `Trámites` currently point to `#` with
  Spanish placeholders; Phase 4 will wire them to the simulator and
  procedure stepper.
-->
<script lang="ts">
	import { page } from '$app/state';
	import {
		LayoutDashboard,
		CalendarDays,
		Network,
		ScrollText,
		PencilLine,
		FileText,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';

	interface NavItem {
		label: string;
		href: string;
		Icon: typeof LayoutDashboard;
		disabled?: boolean;
	}

	const items: NavItem[] = [
		{ label: 'Panel', href: '/dashboard', Icon: LayoutDashboard },
		{ label: 'Horario', href: '/horario', Icon: CalendarDays },
		{ label: 'Retícula', href: '/reticula', Icon: Network },
		{ label: 'Kardex', href: '/academico/kardex', Icon: ScrollText },
		{ label: 'Reinscripción', href: '#', Icon: PencilLine, disabled: true },
		{ label: 'Trámites', href: '#', Icon: FileText, disabled: true }
	];

	interface Props {
		collapsed: boolean;
		onToggle: () => void;
	}

	let { collapsed, onToggle }: Props = $props();

	function isActive(href: string, pathname: string): boolean {
		if (href === '#') return false;
		if (href === '/dashboard') return pathname === '/dashboard';
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

<aside class="sidebar" class:sidebar--collapsed={collapsed} aria-label="Navegación principal">
	<nav class="sidebar__nav" aria-label="Secciones">
		<ul class="sidebar__list">
			{#each items as item (item.label)}
				{@const active = isActive(item.href, page.url.pathname)}
				<li class="sidebar__item">
					{#if item.disabled}
						<span
							class="sidebar__link sidebar__link--disabled"
							aria-disabled="true"
							aria-label={collapsed ? item.label : undefined}
							title="Disponible próximamente"
						>
							<span class="sidebar__icon" aria-hidden="true">
								<item.Icon size={18} strokeWidth={1.75} />
							</span>
							{#if !collapsed}<span class="sidebar__label">{item.label}</span>{/if}
						</span>
					{:else}
						<a
							class="sidebar__link"
							class:sidebar__link--active={active}
							href={item.href}
							aria-label={collapsed ? item.label : undefined}
							aria-current={active ? 'page' : undefined}
						>
							<span class="sidebar__icon" aria-hidden="true">
								<item.Icon size={18} strokeWidth={1.75} />
							</span>
							{#if !collapsed}<span class="sidebar__label">{item.label}</span>{/if}
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>

	<button
		type="button"
		class="sidebar__toggle"
		onclick={onToggle}
		aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
		aria-expanded={!collapsed}
	>
		{#if collapsed}
			<ChevronRight size={16} strokeWidth={1.75} />
		{:else}
			<ChevronLeft size={16} strokeWidth={1.75} />
		{/if}
		{#if !collapsed}<span class="sidebar__toggle-label">Colapsar</span>{/if}
	</button>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		width: 240px;
		background-color: var(--surface-1);
		border-right: 1px solid var(--border-subtle);
		padding: var(--space-4) var(--space-3);
		font-family: var(--font-sans);
		transition: width var(--motion-duration-base) var(--motion-ease-standard);
		flex-shrink: 0;
	}

	.sidebar--collapsed {
		width: 64px;
	}

	.sidebar__nav {
		flex: 1;
	}

	.sidebar__list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.sidebar__item {
		margin: 0;
	}

	.sidebar__link {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-2);
		color: var(--fg-secondary);
		text-decoration: none;
		font-size: var(--text-base);
		font-weight: var(--weight-medium);
		transition:
			background-color var(--motion-duration-fast) var(--motion-ease-standard),
			color var(--motion-duration-fast) var(--motion-ease-standard);
		white-space: nowrap;
		overflow: hidden;
	}

	.sidebar__link:hover {
		background-color: var(--surface-2);
		color: var(--fg-primary);
		text-decoration: none;
	}

	.sidebar__link--active {
		background-color: var(--brand-50);
		color: var(--brand-700);
		border: 1px solid var(--brand-100);
	}

	.sidebar__link--active:hover {
		background-color: var(--brand-50);
		color: var(--brand-700);
	}

	.sidebar__link--disabled {
		opacity: 0.45;
		cursor: not-allowed;
		color: var(--fg-tertiary);
	}

	.sidebar__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 20px;
	}

	.sidebar__toggle {
		display: inline-flex;
		align-items: center;
		justify-content: flex-start;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		margin-top: var(--space-3);
		background-color: transparent;
		color: var(--fg-tertiary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-2);
		font: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
		transition:
			background-color var(--motion-duration-fast) var(--motion-ease-standard),
			color var(--motion-duration-fast) var(--motion-ease-standard);
		white-space: nowrap;
	}

	.sidebar__toggle:hover {
		background-color: var(--surface-2);
		color: var(--fg-primary);
	}

	.sidebar__toggle-label {
		font-weight: var(--weight-medium);
	}

	@media (max-width: 1024px) {
		.sidebar {
			width: 64px;
		}
		.sidebar__label,
		.sidebar__toggle-label {
			display: none;
		}
	}
</style>
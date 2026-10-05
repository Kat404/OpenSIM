<!--
  OpenSIM — Header strip for the (protected) layout.

  Renders:
    - OpenSIM brand mark
    - Cmd+K palette trigger (button + keyboard badge)
    - Theme toggle (persists choice on <html data-theme>)
    - User chip (avatar with initials + control number + full name)

  The theme is stored on `localStorage` so a reload restores the
  manual choice; when no value is stored we defer to the
  `prefers-color-scheme` media query (handled by tokens.css).
-->
<script lang="ts">
	import { Avatar } from '#lib/components/ui';
	import { Sun, Moon, Search } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface UserSummary {
		controlNumber: string;
		fullName: string;
	}

	interface Props {
		user: UserSummary;
		onOpenPalette: () => void;
	}

	let { user, onOpenPalette }: Props = $props();

	type Theme = 'light' | 'dark';
	let theme = $state<Theme>('light');

	onMount(() => {
		// Trust the data-theme attribute that app.html (or
		// theme.svelte.ts's matchMedia listener) already set; do NOT
		// re-read localStorage here. The previous version did, and
		// would re-apply a theme during hydration even when the
		// attribute was already correct, causing an SSR/CSR FOUC
		// flash (audit N3, Round 6). This single-line sync is
		// enough to seed the rune for aria-label + button state.
		theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
	});

	function applyTheme(t: Theme) {
		document.documentElement.setAttribute('data-theme', t);
	}

	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
		applyTheme(theme);
		try {
			localStorage.setItem('opensim-theme', theme);
		} catch {
			// localStorage may be unavailable (e.g. private mode); the
			// theme still applies for this session via the attribute.
		}
	}

	function handlePaletteKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			onOpenPalette();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handlePaletteKey);
		return () => window.removeEventListener('keydown', handlePaletteKey);
	});
</script>

<header class="header">
	<a class="header__brand" href="/dashboard">
		<span class="header__brand-mark" aria-hidden="true">▣</span>
		<span class="header__brand-text">OpenSIM</span>
	</a>

	<button
		type="button"
		class="header__search"
		onclick={onOpenPalette}
		aria-label="Abrir buscador (Ctrl + K)"
	>
		<Search size={16} strokeWidth={1.75} aria-hidden="true" />
		<span class="header__search-label">Buscar</span>
		<kbd class="header__kbd" aria-hidden="true">Ctrl K</kbd>
	</button>

	<button
		type="button"
		class="header__theme"
		onclick={toggleTheme}
		aria-label={theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
		title="Tema claro/oscuro"
	>
		<span class="header__theme-icon header__theme-icon--to-light">
			<Sun size={18} strokeWidth={1.75} aria-hidden="true" />
		</span>
		<span class="header__theme-icon header__theme-icon--to-dark">
			<Moon size={18} strokeWidth={1.75} aria-hidden="true" />
		</span>
	</button>

	<div class="header__user">
		<Avatar name={user.fullName} size="sm" shape="circle" />
		<div class="header__user-meta">
			<span class="header__user-name">{user.fullName}</span>
			<span class="header__user-id">{user.controlNumber}</span>
		</div>
	</div>

	<form method="POST" action="/login/logout" class="header__logout">
		<button type="submit" class="header__logout-btn" aria-label="Cerrar sesión">
			Cerrar sesión
		</button>
	</form>
</header>

<style>
	.header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-5);
		background-color: var(--surface-1);
		border-bottom: 1px solid var(--border-subtle);
		font-family: var(--font-sans);
		min-height: 56px;
	}

	.header__brand {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		text-decoration: none;
		color: var(--fg-primary);
		font-weight: var(--weight-semibold);
		font-size: var(--text-md);
	}

	.header__brand:hover {
		text-decoration: none;
		color: var(--brand-700);
	}

	.header__brand-mark {
		color: var(--brand-600);
		font-size: var(--text-lg);
	}

	.header__search {
		flex: 1;
		max-width: 360px;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		height: 36px;
		background-color: var(--surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-2);
		/* fg-secondary (body text) over fg-tertiary (helper): the search
		   trigger is interactive body copy, not meta/helper text, and
		   fg-tertiary (#6b7280) only reaches 4.27:1 on surface-2 — just
		   below the 4.5:1 WCAG AA threshold flagged by axe-core. */
		color: var(--fg-secondary);
		font: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
		transition:
			background-color var(--motion-duration-fast) var(--motion-ease-standard),
			border-color var(--motion-duration-fast) var(--motion-ease-standard);
	}

	.header__search:hover {
		background-color: var(--surface-3);
		border-color: var(--border-default);
	}

	.header__search-label {
		flex: 1;
		text-align: left;
	}

	.header__kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 var(--space-1);
		min-width: 1.5em;
		height: 20px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--fg-secondary);
		background-color: var(--surface-1);
		border: 1px solid var(--border-default);
		border-bottom-width: 2px;
		border-radius: var(--radius-2);
	}

	.header__theme {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-2);
		background-color: transparent;
		color: var(--fg-secondary);
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			background-color var(--motion-duration-fast) var(--motion-ease-standard),
			color var(--motion-duration-fast) var(--motion-ease-standard);
	}

	.header__theme:hover {
		background-color: var(--surface-2);
		color: var(--fg-primary);
	}

	/* Icon swap driven by <html data-theme> (set synchronously by
	   app.html) so SSR and the first client frame agree — no
	   flash of the wrong glyph (audit N5, Round 6). */
	.header__theme-icon--to-light {
		display: none;
	}
	.header__theme-icon--to-dark {
		display: inline-flex;
	}
	:global([data-theme='dark']) .header__theme-icon--to-light {
		display: inline-flex;
	}
	:global([data-theme='dark']) .header__theme-icon--to-dark {
		display: none;
	}

	.header__user {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-2);
		/* Avatar status dot (if/when status is ever passed) sits on the
		   --surface-1 header strip, so the ring should match that surface
		   — not the --surface-0 page background the default ring assumes.
		   Dormant today since the avatar is rendered without a status. */
		--avatar-ring: var(--surface-1);
	}

	.header__user-meta {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}

	.header__user-name {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--fg-primary);
	}

	.header__user-id {
		font-size: var(--text-xs);
		color: var(--fg-tertiary);
		font-family: var(--font-mono);
	}

	.header__logout {
		margin: 0;
	}

	.header__logout-btn {
		font: inherit;
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		padding: var(--space-1) var(--space-3);
		background: transparent;
		color: var(--fg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-2);
		cursor: pointer;
		transition:
			background-color var(--motion-duration-fast) var(--motion-ease-standard);
	}

	.header__logout-btn:hover {
		background-color: var(--surface-2);
		color: var(--fg-primary);
	}

	@media (max-width: 720px) {
		.header__search-label,
		.header__user-meta {
			display: none;
		}
		.header__search {
			max-width: none;
			flex: 0 0 auto;
		}
	}
</style>
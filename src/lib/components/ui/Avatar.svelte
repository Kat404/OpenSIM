<script lang="ts" module>
	export const STATUS_LABEL_ES = {
		online: 'en línea',
		offline: 'desconectado',
		busy: 'ocupado',
		away: 'ausente'
	} as const;

	export type AvatarStatus = keyof typeof STATUS_LABEL_ES;

	export function composeAltText(
		name: string,
		status: AvatarStatus | undefined,
		alt?: string
	): string {
		if (alt) return alt;
		if (!name) return 'Avatar';
		if (status) return `${name}, ${STATUS_LABEL_ES[status]}`;
		return `Avatar de ${name}`;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		name?: string;
		src?: string;
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		shape?: 'circle' | 'square';
		alt?: string;
		status?: AvatarStatus;
		children?: Snippet;
	}

	let { name = '', src, size = 'md', shape = 'circle', alt, status, children }: Props = $props();

	function initials(n: string): string {
		const parts = n.trim().split(/\s+/);
		if (parts.length === 0) return '?';
		if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
		return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
	}

	const initialsText = $derived(initials(name));
	const altText = $derived(composeAltText(name, status, alt));
</script>

<span class="avatar-frame">
	<span class="avatar avatar--{size} avatar--{shape}" role="img" aria-label={altText}>
		{#if src}
			<img {src} alt="" class="avatar__img" />
		{:else if children}
			{@render children()}
		{:else}
			<span class="avatar__initials" aria-hidden="true">{initialsText}</span>
		{/if}
	</span>
	{#if status}<span class="avatar__status avatar__status--{status}"></span>{/if}
</span>

<style>
	.avatar-frame {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
	}

	.avatar {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background-color: var(--brand-100);
		color: var(--brand-700);
		font-family: var(--font-sans);
		font-weight: var(--weight-semibold);
		overflow: hidden;
		user-select: none;
		flex-shrink: 0;
		--avatar-ring: var(--surface-0);
	}

	.avatar--circle {
		border-radius: 50%;
	}

	.avatar--square {
		border-radius: var(--radius-3);
	}

	.avatar--xs {
		width: 24px;
		height: 24px;
		font-size: 10px;
	}
	.avatar--sm {
		width: 32px;
		height: 32px;
		font-size: var(--text-xs);
	}
	.avatar--md {
		width: 40px;
		height: 40px;
		font-size: var(--text-sm);
	}
	.avatar--lg {
		width: 56px;
		height: 56px;
		font-size: var(--text-base);
	}
	.avatar--xl {
		width: 80px;
		height: 80px;
		font-size: var(--text-lg);
	}

	.avatar__img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.avatar__initials {
		text-transform: uppercase;
	}

	.avatar__status {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 25%;
		height: 25%;
		border-radius: 50%;
		border: 2px solid var(--avatar-ring);
		transform: translate(50%, 50%);
	}

	.avatar__status--online {
		background-color: var(--success-700);
	}
	.avatar__status--offline {
		background-color: var(--fg-tertiary);
	}
	.avatar__status--busy {
		background-color: var(--danger-500);
	}
	.avatar__status--away {
		background-color: var(--warning-700);
	}
</style>
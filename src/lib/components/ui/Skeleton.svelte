<script lang="ts">
	type Shape = 'text' | 'circle' | 'rect';

	interface Props {
		width?: string;
		height?: string;
		shape?: Shape;
		count?: number;
		gap?: string;
	}

	let {
		width = '100%',
		height = '1em',
		shape = 'text',
		count = 1,
		gap = 'var(--space-2)'
	}: Props = $props();
</script>

<div class="skeleton-stack" style:gap>
	{#each Array.from({ length: count }, (_, i) => i) as _ (count)}
		<span
			class="skeleton skeleton--{shape}"
			style:width
			style:height
			aria-hidden="true"
		></span>
	{/each}
</div>

<style>
	.skeleton-stack {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.skeleton {
		display: inline-block;
		background: linear-gradient(
			90deg,
			var(--surface-2) 0%,
			var(--surface-3) 50%,
			var(--surface-2) 100%
		);
		background-size: 200% 100%;
		animation: skeleton-shimmer 1.6s var(--motion-ease-standard) infinite;
	}

	.skeleton--text {
		border-radius: var(--radius-1);
	}

	.skeleton--rect {
		border-radius: var(--radius-2);
	}

	.skeleton--circle {
		border-radius: 50%;
	}

	@keyframes skeleton-shimmer {
		from {
			background-position: 200% 0;
		}
		to {
			background-position: -200% 0;
		}
	}
</style>
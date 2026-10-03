<!--
  OpenSIM — Single class block inside the weekly schedule grid.

  Positioned absolutely inside the day column; height is proportional
  to the time difference between `block.startTime` and `block.endTime`
  (60px per hour, derived in the parent and passed as `topPx` /
  `heightPx`). Color comes from the HSL hash so the same subject
  always paints with the same pastel, regardless of which page
  renders it.
-->
<script lang="ts">
	export interface ScheduleBlock {
		startTime: string;
		endTime: string;
		classroom: string;
	}

	export interface ScheduleSubject {
		code: string;
		name: string;
		canonicalId: string;
	}

	interface Props {
		subject: ScheduleSubject;
		block: ScheduleBlock;
		colorHsl: string;
		topPx: number;
		heightPx: number;
	}

	let { subject, block, colorHsl, topPx, heightPx }: Props = $props();

	const subtitle = $derived(
		heightPx >= 60
			? `${block.startTime} – ${block.endTime} · ${block.classroom}`
			: `${block.startTime} – ${block.endTime}`
	);
</script>

<div
	class="class-block"
	style:top="{topPx}px"
	style:height="{heightPx}px"
	style:background-color={colorHsl}
	role="group"
	aria-label="{subject.code} {subject.name} de {block.startTime} a {block.endTime} en {block.classroom}"
>
	<div class="class-block__inner">
		<span class="class-block__code">{subject.code}</span>
		{#if heightPx >= 48}
			<span class="class-block__name">{subject.name}</span>
		{/if}
		<span class="class-block__meta">{subtitle}</span>
	</div>
</div>

<style>
	.class-block {
		position: absolute;
		left: 4px;
		right: 4px;
		border-radius: var(--radius-2);
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-sans);
		color: var(--fg-primary);
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--fg-primary) 8%, transparent);
		transition:
			transform var(--motion-duration-fast) var(--motion-ease-standard),
			box-shadow var(--motion-duration-fast) var(--motion-ease-standard);
	}

	.class-block:hover {
		transform: translateY(-1px);
		box-shadow: var(--shadow-2);
		z-index: 1;
	}

	.class-block__inner {
		display: flex;
		flex-direction: column;
		gap: 1px;
		height: 100%;
		min-height: 0;
	}

	.class-block__code {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		color: var(--fg-primary);
		line-height: 1.2;
	}

	.class-block__name {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--fg-primary);
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.class-block__meta {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--fg-secondary);
		font-variant-numeric: tabular-nums;
		margin-top: auto;
	}
</style>
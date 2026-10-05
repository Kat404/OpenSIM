/**
 * OpenSIM — Icon component type shared across UI atoms.
 *
 * Lucide-svelte 1.0.1 exports icons as classes that extend
 * `SvelteComponentTyped` with strict prop / event / slot generics.
 * Re-declaring a permissive `Component<Props, ...>` shape does not
 * match those generics (the audit, L2 Round 4, hit this in
 * `TodayClasses.svelte` and the horario empty state). Using the
 * lucide `Icon` class as the canonical type — which is re-exported
 * from the package's main entry — makes every icon assignment pass
 * without a cast.
 *
 * Consumers that need to pass any lucide icon use this type as the
 * prop type. Default values in atoms (e.g. `EmptyState`'s `Inbox`
 * fallback) can be used directly with no `as never` /
 * `as unknown as` escape hatch.
 */

import type { Icon } from "lucide-svelte";

export type IconComponent = typeof Icon;

/**
 * OpenSIM — Icon component type shared across UI atoms.
 *
 * @lucide/svelte exports each icon as a component typed `LucideIcon`
 * (`Component<LucideProps>`). The package ALSO exports a generic
 * `Icon` component, but that one is a different animal: its props are
 * a union that REQUIRES either `icon` (icon data) or `iconNode` (the
 * node array), so `typeof Icon` is not the type of an icon component
 * and does not accept one.
 *
 * The type therefore comes from the package's own `LucideIcon`.
 *
 * History: with lucide-svelte 1.0.1 the icons extended
 * `SvelteComponentTyped` with strict prop / event / slot generics, and
 * re-declaring a permissive `Component<Props, ...>` shape did not match
 * those generics (the audit, L2 Round 4, hit this in
 * `TodayClasses.svelte` and the horario empty state). Using the package's
 * own type keeps every icon assignment passing without a cast.
 *
 * Consumers that need to pass any lucide icon use this type as the
 * prop type. Default values in atoms (e.g. `EmptyState`'s `Inbox`
 * fallback) can be used directly with no `as never` /
 * `as unknown as` escape hatch.
 */

import type { LucideIcon } from "@lucide/svelte";

export type IconComponent = LucideIcon;

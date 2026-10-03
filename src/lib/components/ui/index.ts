/**
 * OpenSIM — Atomic UI components barrel export.
 *
 * All components are pure Svelte 5 runes-driven, consume design tokens
 * exclusively via CSS custom properties, and expose Spanish UI copy in
 * their default slot contents / defaults.
 *
 * Import as:
 *   import { Button, Card, Modal } from '#lib/components/ui';
 */

export { default as Avatar } from './Avatar.svelte';
export { default as Badge } from './Badge.svelte';
export { default as Button } from './Button.svelte';
export { default as Card } from './Card.svelte';
export { default as Drawer } from './Drawer.svelte';
export { default as Dropdown } from './Dropdown.svelte';
export { default as EmptyState } from './EmptyState.svelte';
export { default as Input } from './Input.svelte';
export { default as Kbd } from './Kbd.svelte';
export { default as Modal } from './Modal.svelte';
export { default as ProgressBar } from './ProgressBar.svelte';
export { default as Select } from './Select.svelte';
export { default as Skeleton } from './Skeleton.svelte';
export { default as Stepper } from './Stepper.svelte';
export { default as Table } from './Table.svelte';
export { default as Tabs } from './Tabs.svelte';
export { default as Toast, pushToast, dismiss, toasts } from './Toast.svelte';
export { default as Tooltip } from './Tooltip.svelte';

export type { DropdownItem } from './Dropdown.svelte';
export type { Tab } from './Tabs.svelte';
export type { Step } from './Stepper.svelte';
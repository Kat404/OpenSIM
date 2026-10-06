/**
 * OpenSIM — Dev-only fixture gate for the avatar overlap Playwright suite
 * (Phase 6.1 / U3 acceptance criteria AC6–AC11).
 *
 * SvelteKit evaluates `dev` at build time and the `!dev` branch is
 * tree-shaken out of production bundles, so this route renders a 404 in
 * any non-dev environment regardless of client state. There is no
 * `import.meta.env.DEV_AVATAR_FIXTURE` lookup (Vite's `envPrefix` is
 * `VITE_` by default and SvelteKit does not override it — a previous
 * plan's `VITE_DEV_AVATAR_FIXTURE` env var was always undefined and the
 * gate silently no-op'd). Server-side gating is the belt-and-suspenders
 * fix from mcode R18 audit (blocker A6).
 */

import { error } from "@sveltejs/kit";
import { dev } from "$app/env";

export const load = () => {
	if (!dev) error(404, "Not found");
	return {};
};

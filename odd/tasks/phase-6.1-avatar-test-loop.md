# Phase 6.1 — Playwright AC6-AC11 Loop (U3 acceptance criteria closure)

**Feature:** `phase-6.1-avatar-test-loop`
**Branch:** `main` (continuing — same default as Phase 6)
**Goal:** Close the 6 open acceptance criteria (AC6-AC11) for the U3 Avatar status dot. AC1-AC5 (axe-detectable) already pass via `tests/e2e/axe/*.spec.ts`. AC6-AC11 require Playwright geometry + contrast + box-shadow assertions, none of which exist yet.
**Status:** Plan v2, refined per mcode R18 (4 blockers caught + 5 minor corrections applied). Pending user approval.

---

## Context

Phase 6 U3 shipped in 9 GPG-signed work-unit commits on main (post-`482a00e`). The U3 spec (`odd/tasks/phase-6-ui-polish.md:173-189`) defines AC1-AC11. mcode R11-R17 audit chain closed many issues, but **AC6-AC11 remain unimplemented**. Per mcode R11 finding #2 and the original spec line 189:

> "AC10 is mandatory — axe does not check non-text contrast (M1), so this is the only test that catches the fill contrast bug."

Per mcode R13 follow-up (`482a00e`), AC9 was rewritten from `borderTopColor` to `boxShadow` shorthand; AC8 needs an adjustment (box-shadow spread is NOT hit-testable — the probe point must clear the 2px halo OR the assertion relaxes to "dot or any descendant").

The 80-matrix = 5 sizes × 2 shapes × 4 statuses × 2 colorSchemes (light + dark). This is the gate that closes U3 end-to-end.

Working tree state: 15 commits ahead of origin/main, working tree dirty files preserved (axe reports, `.agents/`, `skills-lock.json`).

---

## R18 blockers caught (all applied to v2)

| # | Issue | Fix in v2 |
|---|---|---|
| **A6** | `import.meta.env.DEV_AVATAR_FIXTURE` is always `undefined` (Vite `envPrefix` default is `"VITE_"`; SvelteKit does not override). | Replace client gate with server `+page.server.ts` that returns 404 when `!dev`. No env var, no `app.d.ts` change. |
| **A5** | AC8 probe `dotBox.right + 3` is outside the dot's box (the dot extends `width/2` past the avatar's right edge via `translate(50%, 50%)`); test fails for all 80. | Probe at the **center** of the dot: `(dotBox.x + dotBox.width/2, dotBox.y + dotBox.height/2)`. >2px from any edge, inside the dot, inside the 2px halo. |
| **B1/E1** | AC9 has no test in v1 (the override spec was created then "skipped"); `getRgbFromComputed(..., 'boxShadow')` is an invalid signature (box-shadow is a string, not a color). | Add AC9 to the main spec as one `test()` per status: `expect(boxShadow).toContain(resolvedRingRgb)`. New helper `getBoxShadowRaw(page, selector): Promise<string>` returns the string; caller parses. |
| **C3** | 3 of 8 pre-flight contrast values are wrong (away light 5.02 vs plan's 3.6; online dark 12.58 vs plan's 9.0; busy light 3.76 vs plan's 3.9). | Recompute with WCAG formula; updated table below. |

Minor corrections (also applied): `addInitScript` must be followed by `page.reload()` to defeat `theme.svelte.ts:61`'s post-hydration `data-theme` stomp; `just test-e2e-avatar` drops `db-set-password` (public spec) and adds `--project` flags; `getRgbFromVar` accepts a locator to resolve cascaded CSS vars; commit count corrected from "2 SHAs" to "3 SHAs".

---

## Exploration findings (subagent handoff summary)

### A. Code surface

- `Avatar.svelte:52-65` — final DOM: `<span class="avatar-frame">` (wrapper, `position: relative; inline-flex; --avatar-ring: var(--surface-0)`) contains `<span class="avatar avatar--{size} avatar--{shape}" role="img" aria-label={altText}>` + sibling `<span class="avatar__status avatar__status--{status}"></span>` (only when status prop set).
- `Avatar.svelte:132-144` — dot CSS: `position: absolute; bottom: 0; right: 0; width: 25%; height: 25%; border-radius: 50%; box-shadow: 0 0 0 2px var(--avatar-ring); transform: translate(50%, 50%);`. The dot anchor is the `.avatar-frame` box (frame is `inline-flex` with no padding, so frame box equals inner avatar box).
- Sizes (Avatar.svelte:92-116): xs=24, sm=32, md=40, lg=56, xl=80 px. Shapes: `circle` (`border-radius: 50%`) vs `square` (`border-radius: var(--radius-3)`).
- Status fills (Avatar.svelte:140-152):
  - online → `--success-700` (light: `#047857`, dark: `#6ee7b7`)
  - offline → `--fg-tertiary` (light: `#6b7280`, dark: `#94a3b8`)
  - busy → `--danger-500` (light: `#ef4444`, dark: `#f87171`)
  - away → `--warning-700` (light: `#b45309`, dark: `#fcd34d`)
- Theme switching: `<html data-theme="dark">` attribute set via `LayoutHeader.svelte:46`. Test path: `page.addInitScript` to set `document.documentElement.setAttribute('data-theme', 'dark')` before navigation, **then `page.reload()`** to defeat `theme.svelte.ts:61`'s post-hydration `followOs(mq)` stomp (this is the R9 NUEVO-1 workaround from `_helpers.ts:49-54`).
- Auth setup: `tests/e2e/setup/auth.setup.ts:18-34` runs as `setup` project once. Logs in as `controlNumber=<NUMERO DE CONTROL PURGADO>`, `password=opensim-dev-2026`. Requires `just db-reset && just db-set-password` first. **Not used by the new spec** (the fixture is public).

### B. Test infrastructure

- Existing patterns: `tests/e2e/axe/dashboard.spec.ts` (auth-gated via `test.use({ storageState: 'playwright/.auth/storage.json' })`), `tests/e2e/axe/index.spec.ts` (public, no auth). Both use a single `test()` block per file.
- Helpers: only `scanForA11y` in `tests/e2e/axe/_helpers.ts:44-118`. No color/geometry helpers exist. The new file creates its own.
- Playwright projects (playwright.config.ts:60-107): 4 projects (setup + chromium + chromium-dark + chromium-data-theme-dark). The two dark-mode paths apply identical token values per `tokens.css:165-200`. Running the 80-matrix on all 3 projects doubles CI time for zero signal. **Recommend: chromium + chromium-data-theme-dark only.**
- `just test-e2e-avatar` recipe: does not exist. Recommend adding focused recipe (only the new spec, with `--project` flags for fast iteration).

### C. Specific concerns (recommendations applied as defaults below)

- **AC8 probe point (v2 fix)**: probe at the **center** of the dot `(dotBox.x + dotBox.width/2, dotBox.y + dotBox.height/2)`. Always inside the dot, >2px from any edge, no halo ambiguity. With the relaxed form (`elementFromPoint === dot || dot.contains(elementFromPoint)`), the box-shadow reality is handled.
- **AC6/AC7 tolerance**: use `expect(Math.abs(diff)).toBeLessThanOrEqual(1)` to match the spec's `±1px` literally. `toBeCloseTo(v, -1)` rounds to ±0.5 which is too tight for subpixel layout at xs (24px).
- **AC10 contrast**: manual WCAG relative-luminance formula in helper (~10 LOC, no dependency).
- **80-matrix structure**: `test.describe()` + nested `forEach` loops producing 80 named tests. **80 total**, not 160 (D14 limits to 2 projects, not 3; even with 3, that's 240 runs).
- **Coverage**: existing `+page.svelte:93-99` covers only 2 statuses (online + busy) in 2 sizes + 1 shape. **A fixture page is required for the full 80-matrix.**

---

## Findings (3, ordered by ROI)

### F1 — Test helpers module (math + Playwright wrappers)

**What:** NEW `tests/e2e/_helpers/avatar.ts` (~120 LOC). Exports:

```ts
export async function getDotBox(page: Page, avatar: Locator): Promise<{
  dotBox: { x: number; y: number; width: number; height: number; right: number; bottom: number };
  avatarBox: { right: number; bottom: number };
}>;

export async function getRgbFromVar(
  page: Page,
  varName: `--${string}`,
  scope?: Locator   // optional scope to read cascaded CSS var (e.g. .avatar-frame for --avatar-ring)
): Promise<[number, number, number]>;

export async function getRgbFromComputed(
  page: Page,
  selector: string,
  prop: 'backgroundColor'
): Promise<[number, number, number]>;

export async function getBoxShadowRaw(
  page: Page,
  selector: string
): Promise<string>;

export function parseRgbString(s: string): [number, number, number];

export function contrast(
  fg: [number, number, number],
  bg: [number, number, number]
): number;

export async function probeElementFromPoint(
  page: Page,
  x: number,
  y: number
): Promise<{ tagName: string; classes: string } | null>;

export async function getRingColor(
  page: Page,
  frame: Locator
): Promise<[number, number, number]>;
```

**Effort:** ~120 LOC, 1 file, 0 dependencies.

**Recommendation:** **A — fix now.**

---

### F2 — Fixture page + 80-matrix tests + AC9 + server gate

**What:**

1. **NEW `src/routes/_dev/avatars/+page.server.ts`** (~10 LOC, server-only — the gate fix from R18 A6):
   ```ts
   import { dev } from '$app/environment';
   import { error } from '@sveltejs/kit';
   export const load = () => {
     if (!dev) error(404, 'Not found');
     return {};
   };
   ```
   SvelteKit evaluates `dev` at build time (per `node_modules/@sveltejs/kit/src/runtime/server/page/load.js`); the `error(404)` is stripped from prod bundles, so the route is inert there. Belt-and-suspenders: no client-side gate, no env var, no `app.d.ts` change.

2. **NEW `src/routes/_dev/avatars/+page.svelte`** (~80 LOC): renders all 80 avatars in a 5×4×2 grid via `{#each}` loops.

   ```svelte
   <script lang="ts">
     import Avatar from '$lib/components/ui/Avatar.svelte';
     const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
     const SHAPES = ['circle', 'square'] as const;
     const STATUSES = ['online', 'offline', 'busy', 'away'] as const;
   </script>
   {#each SIZES as size}
     {#each SHAPES as shape}
       {#each STATUSES as status}
         <Avatar name="{size} {shape} {status}" size={size} shape={shape} status={status} />
       {/each}
     {/each}
   {/each}
   ```

   Plus a `data-testid="avatar-{size}-{shape}-{status}"` attribute on the outer `.avatar-frame` so Playwright can locate each cell deterministically.

3. **NEW `tests/e2e/avatar-overlap.spec.ts`** (~280 LOC): two `test.describe()` blocks — "light" + "dark" — each containing 40 named tests (5 sizes × 2 shapes × 4 statuses). Per test: navigate to `/_dev/avatars`, locate by testid, assert AC6 + AC7 + AC8 + AC9 + AC10.

   ```ts
   for (const size of SIZES) {
     for (const shape of SHAPES) {
       for (const status of STATUSES) {
         test(`${size} ${shape} ${status} light: AC6/AC7/AC8/AC9/AC10`, async ({ page }) => {
           await page.goto('/_dev/avatars');
           const frame = page.getByTestId(`avatar-${size}-${shape}-${status}`);
           const { dotBox, avatarBox } = await getDotBox(page, frame);

           // AC6: dotBox.right - avatarBox.right === dotBox.width / 2 (±1px)
           expect(Math.abs((dotBox.right - avatarBox.right) - dotBox.width / 2))
             .toBeLessThanOrEqual(1);
           // AC7: dotBox.bottom - avatarBox.bottom === dotBox.height / 2 (±1px)
           expect(Math.abs((dotBox.bottom - avatarBox.bottom) - dotBox.height / 2))
             .toBeLessThanOrEqual(1);
           // AC8 (relaxed per R13): probe at the center of the dot, >2px from any edge.
           const probed = await probeElementFromPoint(
             page,
             dotBox.x + dotBox.width / 2,
             dotBox.y + dotBox.height / 2
           );
           // assert probed is dot or descendant of frame (relaxes R13 box-shadow note)
           // ...
           // AC9: getComputedStyle(dot).boxShadow contains resolved --avatar-ring
           const ringColor = await getRingColor(page, frame);
           const boxShadow = await getBoxShadowRaw(page, `[data-testid="avatar-${size}-${shape}-${status}"] .avatar__status--${status}`);
           const ringRgb = `rgb(${ringColor[0]}, ${ringColor[1]}, ${ringColor[2]})`;
           expect(boxShadow).toContain(ringRgb);
           // AC10: contrast >= 3.0 between dot fill and ring
           const fillColor = await getRgbFromComputed(
             page,
             `[data-testid="avatar-${size}-${shape}-${status}"] .avatar__status--${status}`,
             'backgroundColor'
           );
           expect(contrast(fillColor, ringColor)).toBeGreaterThanOrEqual(3.0);
         });
       }
     }
   }
   ```

   The dark `test.describe()` uses the `addInitScript` + `page.reload()` pattern from `_helpers.ts:49-54`:
   ```ts
   test.beforeEach(async ({ page }) => {
     await page.addInitScript(() => {
       document.documentElement.setAttribute('data-theme', 'dark');
     });
     await page.goto('/_dev/avatars');
     await page.reload();
   });
   ```

   Project scope: 2 projects (chromium + chromium-data-theme-dark), enforced via `--project` in the recipe.

**Effort:** ~390 LOC across 3 new files (server load + fixture + spec). AC10 will catch the WCAG 1.4.11 regressions during pre-flight — verified the math (see Risks table below).

**Recommendation:** **A — fix now.**

---

### F3 — just recipe + docs + closeout

**What:**

1. **NEW `just test-e2e-avatar`** recipe in `justfile` (~10 LOC). **No `db-set-password` dependency** (spec is public, no auth).
   ```justfile
   [group('test')]
   [doc('Run Playwright AC6-AC11 avatar overlap suite (light + dark; uses dev fixture page).')]
   test-e2e-avatar:
       pnpm exec playwright test tests/e2e/avatar-overlap.spec.ts \
           --project=chromium --project=chromium-data-theme-dark
   ```

2. **UPDATE `docs/ci-local.md`** (~5 LOC change): add a row to the recipe table for `just test-e2e-avatar` (Phase 6.1 dev iteration).

3. **UPDATE `odd/tasks/phase-6-ui-polish.md`** Progress section — append "Progress (2026-10-05) Phase 6.1 closed" with the 3 SHAs and AC1-AC11 all-green confirmation.

**Effort:** 1 modified justfile, 1 modified docs file, 1 modified spec doc.

---

## Sequencing (3 work-unit commits)

1. **`test(e2e): add avatar test helpers + 80-matrix overlap suite (Phase 6.1 F1+F2)`**
   - NEW: `tests/e2e/_helpers/avatar.ts` (~120 LOC)
   - NEW: `src/routes/_dev/avatars/+page.server.ts` (~10 LOC, server-side dev gate)
   - NEW: `src/routes/_dev/avatars/+page.svelte` (~80 LOC, 80-cell grid)
   - NEW: `tests/e2e/avatar-overlap.spec.ts` (~280 LOC)
   - 4 files changed (4 new), +490 LOC, GPG-signed.

2. **`chore(ci): add just test-e2e-avatar recipe + docs (Phase 6.1 F3)`**
   - UPDATE: `justfile` — new recipe under `## ===== Tests =====`
   - UPDATE: `docs/ci-local.md` — recipe table row
   - 2 files changed, +~15 LOC, GPG-signed.

3. **`docs(odd): record Phase 6.1 closeout + U3 acceptance criteria complete (post-mcode-R18)`**
   - UPDATE: `odd/tasks/phase-6-ui-polish.md` Progress section — append "Progress (2026-10-05) Phase 6.1 closed" with the 3 SHAs and AC1-AC11 all-green confirmation
   - 1 file changed, +~20 LOC, GPG-signed.

Total: **3 commits**, 7 files (4 new), ~+525 LOC.

---

## Verification gates

After commit 1 (helpers + fixture + spec):
- `pnpm run check` → 0 errors
- `pnpm test` → 149/149 (no change; this is Playwright, not vitest)
- `pnpm exec biome ci` → exit 0 (Biome has overrides for tests/**/*.ts)
- `just qa-fast` → green
- **`just test-e2e-avatar`** → 80 tests pass (or surface any AC10 regressions; if a status fails the contrast check, fix the token first in a separate commit and re-run)
- `just test-e2e` → all green (existing axe suite + new avatar suite)
- `pnpm run build` → clean (the `+page.server.ts` gate must compile)

After commit 2 (recipe + docs):
- `just --list` → new recipe visible
- `just test-e2e-avatar` → same as commit 1 verification

After commit 3 (docs closeout):
- Manual: read `phase-6-ui-polish.md` and confirm AC1-AC11 all marked closed

After all:
- `git log --oneline -5` → 3 new commits on top of `cc0f8ee`, all GPG-signed
- No push to remote (human-owned)

---

## AC10 pre-flight math (corrected per R18)

| Status | Fill (light) | Fill (dark) | Ring (light `--surface-0`) | Ring (dark `--surface-0`) | Contrast (light) | Contrast (dark) |
|---|---|---|---|---|---|---|
| online | `#047857` (succ-700) | `#6ee7b7` (succ-700) | `#ffffff` | `#0b0f17` | **5.48** | **12.58** |
| offline | `#6b7280` (fg-tert) | `#94a3b8` (fg-tert) | `#ffffff` | `#0b0f17` | **4.83** | **7.48** |
| busy | `#ef4444` (dng-500) | `#f87171` (dng-500) | `#ffffff` | `#0b0f17` | **3.76** ⚠ | **6.93** |
| away | `#b45309` (wrn-700) | `#fcd34d` (wrn-700) | `#ffffff` | `#0b0f17` | **5.02** | **13.30** |

All 8 combinations exceed the AC10 threshold (3.0). **busy/light at 3.76 is the tightest margin** (0.76 over the threshold); the next token tweak in that direction would regress AC10 and the test would catch it. No token regression expected.

---

## Risks

- **AC8 relaxation**: the spec says `elementFromPoint === dot` strict; the test uses the relaxed form. Documented in the spec file's AC8 comment block citing R13.
- **`addInitScript` stomp**: `theme.svelte.ts:61` runs on hydration and overwrites `data-theme` based on OS preference when no localStorage override. Without `page.reload()` after `addInitScript`, dark tests run in light. **The plan uses the same workaround as `_helpers.ts:49-54`**.
- **Fixture page prod exposure**: with `+page.server.ts` returning 404 in non-dev, the route is inert in prod regardless of client-side state. Belt-and-suspenders: SvelteKit strips `dev === false` branches from production bundles.
- **`chromium-data-theme-dark` project wiring**: per `playwright.config.ts:94-100`, this project does **not** inject `data-theme` itself — the helper does. The new spec must use the `addInitScript` + reload pattern, not rely on the project name.
- **Recipe `--project` enforcement**: without `--project` flags, Playwright runs the spec in all 3 browser projects = 240 runs. The recipe restricts to 2 projects.
- **Test count (real)**: 80 tests × 2 projects = 160 test runs. CI time estimate: ~3 min. Within CI budget.

---

## Out of scope (parked)

- AC9 `LayoutHeader` override test (the `--avatar-ring: var(--surface-1)` path) — separate file, separate plan, auth-gated. Doesn't block U3 closure.
- Activating `project: "recommended"` Biome domain (separate decision; see memory observation `opensim/biome-domain-project-vs-types-tradeoff`)
- `types` Biome domain (defer until Phase 6.1 stabilizes)
- `chromium-dark` project coverage of the 80-matrix (zero signal vs `chromium-data-theme-dark`; documented in the plan)
- `results.json` growth (json reporter side effect, no impact on CI signal)

---

## Decisions to make before implementation

Orchestrator picks defaults if silent.

| # | Question | Default recommendation |
|---|---|---|
| **D13** | Fixture page location + gating | `src/routes/_dev/avatars/+page.svelte` + `+page.server.ts` returning 404 when `!dev` |
| **D14** | Project scope | `chromium` + `chromium-data-theme-dark` (skip `chromium-dark` for zero signal duplication) |
| **D15** | AC8 assertion | Relaxed: `elementFromPoint === dot || dot.contains(elementFromPoint)` with R13 reference |
| **D16** | `just test-e2e-avatar` scope | Only `tests/e2e/avatar-overlap.spec.ts` (not axe suite) with `--project=chromium --project=chromium-data-theme-dark` |

---

## Cross-reference

- U3 spec: `odd/tasks/phase-6-ui-polish.md` lines 173-189 (AC1-AC11)
- Avatar.svelte: `src/lib/components/ui/Avatar.svelte:52-65` (DOM) + `:132-144` (dot CSS)
- mcode R13 audit log: `/tmp/opencode/mcode-u3-cosmetic-audit.log`
- mcode R18 audit log: `/tmp/opencode/mcode-phase61-audit.log`
- Phase 6 closure doc: `odd/tasks/phase-6-u3-audit-closure.md`
- Last reviewed boundary: `cc0f8ee` (naming refactor, 2026-10-04)
- Plan version: v2 (post mcode-R18), 2026-10-05
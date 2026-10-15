# Phase 7 — Hardening: pre-prod bug fixes (post-Gemini cross-audit, mcode-R21 refined)

<!-- odd-tracker
kind: phase-plan
status: closed
last-verified: 2026-10-08
reconciled-against: feat/phase-9-verified-curriculum@8f40837 (main@ffcd595)
sha-warning: every SHA cited in this file predates the 2026-10-08 GPG re-sign rewrite and is dead; re-derive the current SHAs with `git log --oneline --grep='<subject>'`
-->

**Feature:** `phase-7-hardening`
**Branch:** `main` (continuing — same default as Phase 6.1)
**Goal:** Fix the 3 critical + 4 important issues that Gemini 3.8 Flash High caught in a cross-audit of the Phase 6 + 6.1 cycle. mcode R11-R19 (9 rounds, same model family) did not catch them. **mcode R21 (this plan's audit) caught 3 additional blockers in the proposed fixes** — all applied in v2. This phase must complete BEFORE Phase 5.2 deploy.
**Status:** CLOSED 2026-10-06 — shipped as 5 work-unit commits on `main`, all GPG-signed and NOT pushed: `5ab128e`, `d34c3df`, `b49e5a7`, `9a98041`, `92ed2d0`. Spec record: `odd/tasks/opensim.md` §7 `:474-504` (Tasks 7.1–7.5). Plan body, the 8 Gemini R20 findings, and the R21 v1→v2 refinement table below are preserved verbatim as the historical record.

---

## Context

After 19 GPG-signed commits on main (post-`482a00e`) closing the U3 cycle, the tooling adoption, and the AC6-AC11 Playwright suite, two cross-audits caught 7+3 issues that the same-model mcode R11-R19 chain did not catch:
- **Gemini R20**: 3 critical + 4 important bugs (CSP, fixture leak, brand-600, etc.)
- **mcode R21** (this plan's audit): 3 more blockers in the proposed fixes (F1 CSP `'self'` would break hydration, F2 no mechanism works, F6 spec split doesn't reduce runs)

Memory: `opensim/gemini-cross-audit-r20-findings` (id 2015) + the mcode R21 audit log at `/tmp/opencode/mcode-phase7-audit.log`.

Working tree state: 19 commits ahead of origin/main, working tree dirty files preserved (`tests/e2e/reports/*.json`, `.agents/`, `skills-lock.json`). Not touched by this phase.

---

## R21 refinements applied (vs Gemini R20 / v1)

| v1 fix | R21 issue | v2 fix |
|---|---|---|
| **F1**: extract to `static/theme-bootstrap.js` + `script-src 'self'` | ✗ `'self'` would block SvelteKit's `kit.start(app, ...)` inline hydration script (`render.js:521-529`) → app renders but no hydration | **F1 v2**: adopt **SvelteKit 3.0 native `kit.csp.mode: 'nonce'`** in `vite.config.ts`. SvelteKit computes the nonce per-request and emits it in the inline script. CSP becomes `'self' 'nonce-...'` automatically. `hooks.server.ts:32-34` already documents this as the migration target. |
| **F2**: route group `(dev)/avatars/` + svelte.config.js exclusion | ✗ `(dev)` is **layout grouping**, not exclusion. No `svelte.config.js` exists in repo. Neither `rollupOptions.external` nor route groups work. | **F2 v2**: move fixture to `static/dev/avatars.html` (static HTML, no SvelteKit route, no manifest entry, no client bundle inclusion) and update test to navigate to `/dev/avatars.html` |
| **F3**: `#0e7490` (teal-700) | ⚠ `#0e7490` is exactly `--brand-700` → kills hover of all `<a>` (tokens.css:362 vs :366 collapse to same color) | **F3 v2**: use `#0f6f85` (5.78:1 on white) to preserve 600↔700 separation; document the now-correct contrast comments |
| **F6**: split spec into 2 files | ✗ `--project` does NOT filter `test.describe()` blocks; splitting files doesn't reduce runs; also breaks `just test-e2e` (no `--project` → 240 runs instead of 160) | **F6 v2**: use `testMatch` in `playwright.config.ts` per-project + `test.skip(({ testInfo }) => testInfo.project.name !== 'chromium-data-theme-dark')` inside the dark describe. Result: 80 honest runs. Update `justfile` to filter the avatar spec from `test-e2e` (or accept and document the cost). |
| **F7**: combined `add titles + /404 fix` | ⚠ `/404` uses `.btn--primary` with `background-color: var(--surface-2)` (`+error.svelte:104`) = ~1.1:1, not 3.46:1. Different root cause. | **F7 split into F7a + F7b**: F7a = add `<svelte:head><title>` to `/`, `+layout.svelte`, `(protected)/+layout.svelte` (3 routes, not 2). F7b = fix `/404` button to use `--brand-700` background + `--brand-fg` text (same pattern as `Button.svelte:107`). |
| **D20**: `<script defer>` | ✗ `defer` delays execution until after document parse; inline-in-`<head>` is faster (no network round-trip) and runs before any paint | **D20 removed**: if extracting to static script, use `<script src="...">` **without `defer`**, blocking in `<head>`. With kit.csp + nonce approach, no extraction is needed — inline script runs in `<head>` and the nonce is auto-applied. |
| **F8 (new)**: SvelteKit 3 has `kit.csp` native | ✓ confirms `vite.config.ts:6-15` is where Kit config lives; `csp: { mode: 'nonce', directives: { 'script-src': ['self'] } }` is the modern path | **F8 v2 (consolidated into F1 v2)**: adopt `kit.csp.mode: 'nonce'` as the actual F1 fix; delete the manual CSP in `hooks.server.ts:47-62` |

---

## Findings (8, post-R21 — down from 9 because F1+F8 merged)

### F1 v2 — Adopt SvelteKit 3 native `kit.csp.mode: 'nonce'` [🔴 critical]

**File:** `vite.config.ts:6-15` (where Kit config lives; no `svelte.config.js` exists in repo). Add:
```ts
csp: {
  mode: 'nonce',
  directives: {
    'script-src': ['self'],
    'style-src': ['self', 'unsafe-inline'], // SvelteKit injects inline <style> for hydration
  },
}
```

**Update `src/app.html`**: ensure the inline script (lines 9-34, the theme bootstrap) has `nonce="%sveltekit.nonce%"`:
```html
<script nonce="%sveltekit.nonce%">...</script>
```

**Delete `src/hooks.server.ts:32-62`**: the manual CSP middleware + comment block is no longer needed; SvelteKit generates the header automatically.

**Update `tests/e2e/avatar-overlap.spec.ts:182-193`**: REMOVE the `page.route` CSP bypass. With real CSP (now nonce-based), the dark suite's `addInitScript` works because the bootstrap script is allowed (its nonce is in the header). The page.route workaround is dead code that was masking the real production behavior.

**Production impact:** Zero hashes to maintain (SvelteKit generates the nonce per-request, scoped to the HTML response). Immune to Biome reformat. Dark theme works in production. The `page.route` removal means the dark tests now exercise real production CSP behavior.

### F2 v2 — Move fixture to `static/dev/avatars.html` (no route, no bundle entry) [🔴 critical]

**Steps:**
1. Move `src/routes/_dev/avatars/+page.svelte` → `static/dev/avatars.html` (static HTML file, served by SvelteKit's static handler at `/dev/avatars.html`).
2. The HTML file contains the same grid but with hand-rolled imports OR with a small Svelte hydration script. **Simplest path**: pre-render the HTML at build time using a SvelteKit endpoint that returns the static HTML. Use a `+server.ts` in `src/routes/__prebuild__/` that returns the rendered HTML, then a build script copies the output to `static/dev/avatars.html`.

**Actually, simpler**: just write the HTML file directly. The 80 cells can be static markup (no Svelte runtime needed for tests — the `data-testid` is what Playwright uses, and the box dimensions can be measured on any rendered DOM).

**Wait, simplest path**: keep the existing SvelteKit route but add a `vite.config.ts` plugin that **excludes the route from production builds** by clearing the `kit.files.routes` for `_dev/**` when `mode === 'production'`. This is the cleanest "stay in SvelteKit, just don't ship" approach.

**Recommended path (decision D17 v2):** Use a `vite.config.ts` plugin:
```ts
{
  name: 'exclude-dev-fixtures',
  enforce: 'pre',
  config(config, { command }) {
    if (command === 'build') {
      config.build = config.build || {};
      config.build.rollupOptions = config.build.rollupOptions || {};
      config.build.rollupOptions.external = [
        ...(config.build.rollupOptions.external || []),
        /^\/src\/routes\/_dev\//,
      ];
    }
  },
}
```

This is the simplest mechanism that works. The route still exists for dev/test but is externalized (excluded from the Rollup bundle) in production. Verify with `pnpm run build` that the route is NOT in `.svelte-kit/output/client/_app/immutable/nodes/`.

### F3 v2 — Adjust `--brand-600` to `#0f6f85` (5.78:1, preserves 600↔700 separation) [🔴 critical]

**File:** `src/lib/styles/tokens.css:54`. Change:
```diff
- --brand-600: #0891b2;    /* (current: 3.68:1 on white, fails WCAG AA) */
+ --brand-600: #0f6f85;    /* (verified: 5.78:1 on white, AA pass) */
```

Comment update at line 53 ("WCAG-AA on both light & dark surfaces"): now true.

**Verification:** Run `just test-e2e` (full a11y suite) — all 8 specs must stay green. Also run `just qa-fast`.

### F4 v2 — Sync pnpm version to 11.28.4 in Containerfile.ci [🟡 important]

**File:** `Containerfile.ci:62`. Change:
```diff
- RUN npm install -g pnpm@10.0.0 \
+ RUN npm install -g pnpm@11.28.4 \
```

**Caveat (per R21 A5):** The `packageManager: pnpm@11.28.4` field in `package.json:6` enables Corepack. If Corepack is installed in the base image, it will rewrite the global `pnpm` binary. The line 63 `pnpm --version` will then print Corepack's pinned version. This is actually what we want (consistency between host and container). If Corepack is missing, the global install is what runs (also fine). **No additional changes needed**; just sync the version.

### F5 v2 — Refactor Avatar.svelte Props to extend `HTMLAttributes<HTMLSpanElement>` [🟡 important]

**File:** `src/lib/components/ui/Avatar.svelte:36-50`. Change:
```ts
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'src' | 'alt' | 'children'> {
  name?: string;
  src?: string;            // overrides HTMLAttributes.src with our typed shape
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  alt?: string;
  status?: AvatarStatus;
  children?: Snippet;
}

let { name = '', src, size = 'md', shape = 'circle', alt, status, children, ...rest }: Props = $props();
```

At the root element (line 67):
```svelte
<span class="avatar-frame" data-testid={dataTestid} {...rest}>
```

Wait — `dataTestid` was the opt-in prop. With the spread, callers can now pass `data-testid="..."` directly. **Remove the `dataTestid` field from Props** (no longer needed). Update the test spec to use `data-testid` directly.

**Verification:** `pnpm run check` (TypeScript build) must pass. The `Omit<..., 'src' | 'alt' | 'children'>` resolves the conflict that R21 A6 flagged.

### F6 v2 — `testMatch` in playwright.config.ts + `test.skip` in dark describe [🟡 important]

**File:** `playwright.config.ts:60-108`. Restructure the projects to filter the avatar spec:
```ts
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/, ... },
  { name: 'chromium', testMatch: /axe\.spec\.ts|avatar-overlap\.light\.spec\.ts/, ... },
  { name: 'chromium-dark', testMatch: /axe\.spec\.ts/, ... },
  { name: 'chromium-data-theme-dark', testMatch: /axe\.spec\.ts|avatar-overlap\.dark\.spec\.ts/, ... },
],
```

Wait — that doesn't work because the avatar spec is currently one file. We need to either:
- Split the spec into 2 files (`.light.spec.ts` and `.dark.spec.ts`) AND add the testMatch filter, OR
- Keep one file, use `test.skip(({ testInfo }) => testInfo.project.name !== 'chromium')` in the light describe and `test.skip(testInfo => testInfo.project.name !== 'chromium-data-theme-dark')` in the dark describe

**Decision D18 v2:** Keep ONE file (don't split — splitting was a workaround for the filter problem, not the actual problem). Use `test.skip` per describe:
```ts
test.describe('light', () => {
  test.skip(({ testInfo }) => testInfo.project.name !== 'chromium', 'light only on chromium project');
  // 40 tests
});

test.describe('dark', () => {
  test.skip(({ testInfo }) => testInfo.project.name !== 'chromium-data-theme-dark', 'dark only on chromium-data-theme-dark project');
  // 40 tests
});
```

**Result:** 40 light tests run only on chromium; 40 dark tests run only on chromium-data-theme-dark. **Total: 80 honest runs** (vs the current 160 redundant). `just test-e2e-avatar` still passes both `--project` flags (Playwright will filter at the project level too, but the test.skip is the safety net).

**Update `justfile:96-98`** `test-e2e-avatar` to drop the `--project` flags (now unnecessary — the per-describe `test.skip` handles the filtering):
```justfile
test-e2e-avatar:
    pnpm exec playwright test tests/e2e/avatar-overlap.spec.ts
```

80 actual runs. Honest count in CI output.

### F7a — Add `<svelte:head><title>` to root routes [🟡 important]

**Files:**
- `src/routes/+page.svelte` — add `<svelte:head><title>OpenSIM</title></svelte:head>` before the existing content
- `src/routes/+layout.svelte` — add a default title (overridden by child pages with their own `<title>`)
- `src/routes/(protected)/+layout.svelte` — add a default title for protected routes fallback

The other 9 pages already have `<svelte:head><title>` per R21 A8.

### F7b — Fix `/404` button contrast [🟡 important]

**File:** `src/routes/+error.svelte:104`. The current `.btn--primary` selector uses `background-color: var(--surface-2)` which is `#eef0f4` → contrast ~1.1:1. Fix: use `--brand-700` background + `--brand-fg` text (same pattern as `src/lib/components/ui/Button.svelte:107`):
```css
.btn--primary {
  background-color: var(--brand-700);
  color: var(--brand-fg);
}
```

**Verification:** `just test-e2e` — `/404` must pass axe now.

### Out of scope (deferred)

- **`wrangler types --check` hang** (Gemini F9) — docs-only, separate change
- **`project: "recommended"` Biome domain** — separate decision
- **`types` Biome domain** — defer
- **`chromium-dark` project duplication** — document why we don't run it

---

## Sequencing (5 work-unit commits on `ccd490f`)

1. **`fix(security): adopt SvelteKit 3 kit.csp.mode:'nonce' + remove manual CSP (Phase 7 F1 v2)`**
   - UPDATE: `vite.config.ts:6-15` — add `csp: { mode: 'nonce', directives: { 'script-src': ['self'], 'style-src': ['self', 'unsafe-inline'] } }`
   - UPDATE: `src/app.html:9-34` — add `nonce="%sveltekit.nonce%"` to the theme bootstrap script
   - DELETE: `src/hooks.server.ts:32-62` (manual CSP middleware)
   - UPDATE: `tests/e2e/avatar-overlap.spec.ts:182-193` — REMOVE the `page.route` CSP bypass (real CSP now allows via nonce)
   - 4 files changed (1 deleted block), +~10/-~30 LOC, GPG-signed.
   - **Verification:** `just qa-fast` + `just test-e2e-avatar` (dark suite must pass without `page.route` — if it fails, the nonce isn't being applied; investigate).

2. **`chore(ci): exclude _dev/avatars from production bundle via Vite plugin (Phase 7 F2 v2)`**
   - UPDATE: `vite.config.ts` — add `exclude-dev-fixtures` plugin (per F2 v2 spec above)
   - 1 file changed, +~15/-0 LOC, GPG-signed.
   - **Verification:** `pnpm run build` + check `.svelte-kit/output/client/_app/immutable/nodes/` does NOT contain the fixture.

3. **`fix(a11y): brand-600 to #0f6f85 + add titles + fix /404 button (Phase 7 F3+F7a+F7b)`**
   - UPDATE: `src/lib/styles/tokens.css:54` — `--brand-600: #0f6f85`
   - UPDATE: `src/routes/+page.svelte` — add `<svelte:head><title>`
   - UPDATE: `src/routes/+layout.svelte` — add default title
   - UPDATE: `src/routes/(protected)/+layout.svelte` — add default title
   - UPDATE: `src/routes/+error.svelte:104` — fix `/404` button
   - 5 files changed, +~20/-~10 LOC, GPG-signed.
   - **Verification:** `just test-e2e` (full a11y suite green) + manual smoke of `/` and `/404`.

4. **`fix(tooling): sync pnpm + Avatar.svelte HTMLAttributes spread + avatar spec test.skip (Phase 7 F4+F5+F6)`**
   - UPDATE: `Containerfile.ci:62` — `pnpm@11.28.4`
   - UPDATE: `src/lib/components/ui/Avatar.svelte` — extend Props with `Omit<HTMLAttributes<HTMLSpanElement>, 'src' | 'alt' | 'children'>`; remove `dataTestid` prop; spread `{...rest}` on `.avatar-frame`
   - UPDATE: `tests/e2e/avatar-overlap.spec.ts` — add `test.skip` per describe; remove `dataTestid` prop usage; use `data-testid` directly
   - UPDATE: `justfile` — `test-e2e-avatar` recipe drops `--project` flags
   - 4 files changed, +~30/-~40 LOC, GPG-signed.
   - **Verification:** `podman build -f Containerfile.ci` builds clean; `just test-e2e-avatar` reports **80 passed** (not 161); `pnpm run check` green.

5. **`docs(odd): record Phase 7 hardening closeout (post-gemini-R20-2 + mcode-R21)`**
   - UPDATE: `odd/tasks/phase-6-ui-polish.md` Progress section — append "Progress (2026-10-06) Phase 7 closed"
   - UPDATE: `odd/tasks/opensim.md` §8 — add Phase 7 section documenting all 8 fixes
   - 2 files changed, +~60/-~5 LOC, GPG-signed.

**Total: 5 commits, 13-15 files (0-1 deleted block), ~+135/-~85 LOC, 0 new devDeps.**

**After commit 5**: Gemini R20 second pass audit (via `agy --model gemini-3.8-flash-high --effort high`) on `ccd490f..HEAD`. Apply corrections if any. Then `docs/opensim.md` final update.

---

## Verification gates (per commit)

After each commit:
- `pnpm run check` → 0 errors
- `pnpm test` → 149/149
- `pnpm exec biome ci` → exit 0
- `pnpm run build` → clean
- `just qa-fast` → green
- Commit-specific (above)

After commit 5 (full Phase 7 closeout):
- Run **Gemini 3.8 Flash High** (via `agy`) audit on `ccd490f..HEAD` — R20 second pass
- Apply corrections if any (only if Gemini flags new issues)
- `git log --oneline -7` → 5 new commits on top of `ccd490f`, all GPG-signed
- `git diff --stat ccd490f..HEAD` → ~+135/-~85 LOC across 13-15 files
- No push to remote (Phase 5.2 is the human's next step)

---

## Risks (R21-augmented)

- **F1 v2 kit.csp.mode:'nonce'** — the nonce must be present in both the CSP header AND the inline `<script>` tag. If either is missing, hydration fails silently in production. Verify with `curl -i https://.../_app/...` and inspect both header and HTML response.
- **F2 v2 Vite plugin** — the `rollupOptions.external` approach is fragile. SvelteKit's build process may not respect external routes correctly. **Backup plan**: if F2 verification fails, fall back to renaming `_dev/avatars` → `.dev/avatars` (SvelteKit's `kit.files.routes` glob may exclude dot-prefixed paths; needs testing).
- **F3 v2 #0f6f85** — visually, this is a darker teal than `#0e7490`. Component screenshots may shift slightly. Acceptable.
- **F5 v2 `Omit<HTMLAttributes<...>>`** — if the `Omit` is wrong, `pnpm run check` fails in commit 4. **Run check BEFORE commit** (verification gate covers this).
- **F6 v2 `test.skip`** — if the project name is misnamed, the test passes when it shouldn't (skip too aggressively). Verify by running each project explicitly with `--project=chromium` and checking that the dark tests are skipped (not just passing).
- **F7b /404 button** — the fix uses `--brand-700` which is `#0e7490` (5.36:1 on white). Verify with axe.

---

## Out of scope (parked)

- `wrangler types --check` hang fix (F9 in Gemini's list) — docs-only change, separate
- `project: "recommended"` Biome domain activation — separate decision (see memory `opensim/biome-domain-project-vs-types-tradeoff`)
- `types` Biome domain — defer
- `chromium-dark` project documentation — separate
- `dataTestid` prop complete removal (the F5 v2 refactor uses spread; the prop itself is removed in the same commit)

---

## Decisions to make before implementation

Orchestrator picks defaults if silent.

| # | Question | Default recommendation |
|---|---|---|
| **D17 v2** | F2 mechanism | Vite `rollupOptions.external` plugin (per F2 v2 spec). Backup: rename `_dev` → `.dev` if the plugin doesn't work. |
| **D18 v2** | F6 spec structure | ONE file + `test.skip` per describe (not 2 files). |
| **D19 v2** | F3 brand-600 exact new value | `#0f6f85` (5.78:1, preserves 600↔700 separation) |
| **D21** | Gemini R20 second pass timing | After commit 5 (full closeout). Required, not optional. |
| **D22** | kit.csp.mode options | `'nonce'` (recommended for Cloudflare Workers; `'hash'` would re-introduce the stale-hash problem; `'auto'` defers to whatever the user provides). |

---

## Cross-reference

- mcode R21 audit log: `/tmp/opencode/mcode-phase7-audit.log` (this plan's audit)
- Gemini R20 cross-audit memory: `opensim/gemini-cross-audit-r20-findings` (id 2015)
- CSP hash memory: `opensim/csp-hash-stale-app-html-bootstrap` (id 2007) — **superseded by F1 v2** (kit.csp native replaces manual hash)
- 5.2 vs 7 tradeoff: `opensim/phase-5.2-vs-phase-7-tradeoff` (id 2016)
- Last reviewed boundary: `ccd490f` (Phase 6.1 closeout, 2026-10-05)
- Plan version: v2 (post mcode-R21, post Gemini-R20), 2026-10-06
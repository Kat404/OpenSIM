# Phase 6.5 — U3 Audit Closure + `just` Adoption + Local Podman CI + Biome (plan v5, post-mcode-R16 + Biome domains)

<!-- odd-tracker
kind: phase-plan
status: closed
last-verified: 2026-10-08
reconciled-against: feat/phase-9-verified-curriculum@8f40837 (main@ffcd595)
sha-warning: every SHA cited in this file predates the 2026-10-08 GPG re-sign rewrite and is dead; re-derive the current SHAs with `git log --oneline --grep='<subject>'`
-->

**Feature:** `phase-6.5-closure-and-just-adoption`
**Branch:** `main` (continuing — same default as Phase 6)
**Goal:** (1) close the U3 audit-cycle (R11/R12/R13) formally with a traceability doc; (2) bring `just` to full coverage in ODD recipes, reports, and the README; (3) eliminate the GitHub Actions workflow entirely (user-pivot: no cloud CI) and replace with **local Podman CI** recipes; (4) adopt **Biome 2.5.15** with explicit **domains** for svelte/drizzle/playwright/test — these domains were surfaced by the user mid-session as features worth verifying, and verification via official Biome docs confirms they apply to OpenSIM and add value.
**Status:** CLOSED 2026-10-04 — shipped as 7 work-unit commits on `main`: `72cddf5`, `d5e2109`, `dcd3e9e`, `6e67534`, `338ad07`, `0baf00b`, `cc0f8ee`. Spec record: `odd/tasks/opensim.md` §6.5 `:451-472` (Tasks 6.5.1–6.5.7). Plan body, the v4→v5 pivot rationale, and the Biome domain findings below are preserved verbatim as the historical record.

---

## User-pivot context (drives v5 vs v4)

The user surfaced **6 screenshots of Biome domains** (astro, drizzle, playwright, svelte) after locking D1, D2, D4, D6, D8 — "no sé si puedan ser útiles pero no pude evitar verlos". I verified each via `https://biomejs.dev/linter/domains/` (webfetch) and `context7 query-docs`. Findings:

- **Svelte, Drizzle, Playwright, and Test domains all auto-detect from `package.json` dependencies** in OpenSIM (`svelte 5.57.1`, `drizzle-orm 0.45.3`, `@playwright/test 1.63.0`, `vitest 5.0.3`).
- **`"recommended"` activates 0 rules for svelte/drizzle/playwright** because every rule in those domains is currently tagged `nursery` (per the docs). The docs explicitly say *"Since all rules in this domain are nursery rules, no rules will be activated when enabling the domain. You need to enable the single rules."* The screenshots show the same warning.
- **`"all"` activates all nursery rules in the domain**. For Svelte that's 8 rules, for Drizzle 2 rules, for Playwright 11 rules, for Test 13 (additive to 3 `recommended`).
- **OpenSIM doesn't use Astro** — that domain is irrelevant.

D5/D9/D10/D11/D3-alt decisions from prior turn all locked (local Miniflare + `just ci-drift`, `tab` indent, `always` semis, `double` quotes, `node:24-bookworm-slim` + apt-get chromium). v5 does not change those.

---

## v5 domain findings (per `https://biomejs.dev/linter/domains/`)

### Svelte domain — `recommended: 0 rules`, `all: 8 rules`

JS rules (4, all nursery):
- `noSvelteExportLet` — flags `export let x` in favor of `$props()` rune (Svelte 5 idiom)
- `noSvelteInspect` — flags `$inspect` (debug helper that should not ship to prod)
- `noSvelteUnnecessaryStateWrap` — flags `$state(value)` wrapping a primitive that doesn't need reactivity
- `useSvelteKitRuneImports` — flags `import { ... } from 'svelte/store'` in SvelteKit code (store API is deprecated in Svelte 5 runes mode)

HTML rules (4, all nursery):
- `noSvelteAtDebugTags` — flags `{@debug ...}` (debug-only directive)
- `noSvelteAtHtmlTags` — flags `{@html ...}` (XSS risk if misused)
- `noSvelteLegacyConst` — flags `const` syntax that should be `$state` in Svelte 5
- `useSvelteRequireEachKey` — flags `{#each ...}` blocks without a key

### Drizzle domain — `recommended: 0 rules`, `all: 2 rules` ⭐

JS rules (2, all nursery):
- **`noDrizzleDeleteWithoutWhere`** — flags `db.delete(table)` without `.where(...)`. **This is exactly the pattern that mcode R15 warned about**: a destructive query without WHERE clause can wipe a whole table. R15 said "if a remote D1 path ever lands in [the reset recipe] by accident, the destructive `rm -rf` runs against production." A `db.delete().execute()` without WHERE is the SQL-level equivalent.
- **`noDrizzleUpdateWithoutWhere`** — same pattern for updates.

These two rules are **the highest-value domain rules** for OpenSIM. mcode R15's risk analysis (destructive D1 ops) maps directly to these lint rules.

### Playwright domain — `recommended: 0 rules`, `all: 11 rules`

JS rules (11, all nursery):
- `noPlaywrightElementHandle` — anti-pattern; use locators (`page.locator(...)`) over `page.$(...)` / `page.$$(...)`
- `noPlaywrightEval` — avoid `page.evaluate(() => eval(...))`
- `noPlaywrightForceOption` — avoid `{ force: true }` on clicks (skips actionability checks)
- `noPlaywrightMissingAwait` — flags unawaited async Playwright API calls
- `noPlaywrightNetworkidle` — `networkidle` is deprecated and unreliable
- `noPlaywrightPagePause` — `page.pause()` shouldn't ship to CI
- `noPlaywrightUselessAwait` — flags `await` on already-non-Promise calls
- `noPlaywrightWaitForNavigation` — `waitForNavigation` deprecated; use `waitForURL`
- `noPlaywrightWaitForSelector` — `waitForSelector` deprecated; use locators + assertions
- `noPlaywrightWaitForTimeout` — hard timeouts are flaky; use auto-waiting locators
- `usePlaywrightValidDescribeCallback` — validates `test.describe()` callback signatures

### Test domain — `recommended: 3 rules`, `all: +10 nursery rules`

JS rules (3 `recommended`, 10 nursery):
- `recommended`: `noDuplicateTestHooks`, `noExportsInTest`, `noFocusedTests` — all stable, useful
- `nursery (with "all")`: `noExcessiveNestedTestSuites`, `noConditionalExpect`, `noIdenticalTestTitle`, `useConsistentTestIt`, `useExpect`, `useTestHooksInOrder`, `useTestHooksOnTop`, `useValidTestTitle`, `noExcessiveNestedTestSuites` (already counted), `noConditionalInTest`, etc.

The 3 `recommended` rules are valuable, low-noise.

### Project domain — `recommended: 1 rule`, performance cost

`recommended` activates `noPrivateImports`. **Caveat:** enabling Project rules triggers Biome to scan the entire module graph of the project — performance cost on first run. Worth it for OpenSIM's size; not worth it on huge monorepos.

### Types domain — `recommended: 16 nursery rules`

`recommended` activates `useArrayFind`, `noBaseToString`, `noFloatingPromises`, `noMeaninglessVoidOperator`, `noMisleadingReturnType`, `noMisusedPromises`, `noUnsafePlusOperands`, `noUselessTypeConversion`, `useAwaitThenable`, `useDisposables`, `useExhaustiveSwitchCases`, `useIncludes`, `useNullishCoalescing`, `useRegexpExec`, `useStrictBooleanExpressions`, `useStringStartsEndsWith`, `useConsistentEnumValueType`, `noUnnecessaryConditions`, `useArraySortCompare` (the rule says "recommended" in docs but they look mostly nursery — verify in implementation).

**Caveat:** Types rules require the type inference engine. Performance cost is significant on first run. **`noFloatingPromises` and `noMisusedPromises` are uniquely valuable** for OpenSIM since it uses async/await heavily (forms, action endpoints, D1 queries). **Worth enabling in a follow-up, not in this cycle** (R15 already flagged the perf cost).

### Astro domain — irrelevant

OpenSIM doesn't use Astro. Skip.

---

## v5 refined `biome.json` (draft)

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.15/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  },
  "json": {
    "formatter": { "indentStyle": "tab" }
  },
  "css": {
    "formatter": { "enabled": true }
  },
  "html": {
    "experimentalFullSupportEnabled": true,
    "formatter": { "enabled": true }
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": { "organizeImports": "on" }
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    },
    "domains": {
      "svelte": "all",
      "drizzle": "all",
      "playwright": "all",
      "test": "recommended"
      // "project": "recommended" — opt-in (perf cost); uncomment for cross-file analysis
      // "types": "recommended" — opt-in (perf cost + type inference); uncomment for type-aware linting
    }
  },
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "includes": ["**", "!**/.svelte-kit", "!**/node_modules", "!**/build"]
  },
  "overrides": [
    {
      "includes": ["*.svelte", "*.astro", "*.vue"],
      "linter": {
        "rules": {
          "style": { "useConst": "off", "useImportType": "off" },
          "correctness": { "noUnusedVariables": "off", "noUnusedImports": "off" }
        }
      }
    }
  ]
}
```

**Differences vs v4:**
- Added `linter.domains` block with 4 domains enabled (svelte/drizzle/playwright/test).
- Svelte/drizzle/playwright at `"all"` because their `recommended` is empty (all rules are nursery).
- Test at `"recommended"` because its 3 stable rules are valuable.
- `project` and `types` commented out with opt-in notes (perf cost warning).

---

## R15 critical findings still apply (carryover from v4)

1. **Migrating `package.json:22-25` (db:* scripts) to `just` is REJECTED.**
2. **Migrating `playwright.config.ts:103` `pnpm dev` → `just dev` is REJECTED.**
3. **`just deploy` (Pages recipe) is vestigial**; delete it.
4. **Recipe `axe` must use `--project=chromium` and depend on `db-set-password`**.
5. **Recipe `mcode` must use `{{quote(prompt)}}`**.
6. **Lines 21 and 237 of `phase-6-u3-cosmetic-followups.md` are historical evidence** — leave as `pnpm`.
7. **Typo `just test:e2e` → `just test-e2e`** in 3 locations.

---

## Findings (5, ordered by ROI)

### F1 — Formalize R11/R12/R13 traceability with a closure doc
*(same as v4)* `odd/tasks/phase-6-u3-audit-closure.md` (~60 lines).

### F2 — Migrate reports + README + typos to `just`
*(same as v4)* 4 files, ~+15/-3 LOC.

### F3 — Adopt Biome 2.5.15 + activate domains (svelte/drizzle/playwright/test)

**What (v5 addition vs v4):** Apply Biome 2.5.15 with the **refined `biome.json` including `linter.domains`** for svelte/drizzle/playwright/test. R15 caught that "0 devDependencies" was wrong; v5 finalizes the count at **1 new devDep** (`@biomejs/biome@2.5.15` pinned).

Changes:
1. **`pnpm add -D @biomejs/biome@2.5.15`** — exact version, no `^`.
2. **NEW `biome.json`** at repo root (see v5 refined draft above).
3. **`justfile` changes:**
   - Replace `just format` → `pnpm exec biome format --write .`
   - Replace `just format-check` → `pnpm exec biome ci`
   - Add `just lint` → `pnpm exec biome lint .`
   - Add `just biome` → `pnpm exec biome check --write .`
   - Repair `just precommit` → `precommit: check biome-check format-check test`
   - **DELETE** `just deploy` (canonical is `deploy-worker`)
4. **NEW `just biome-check`** — `pnpm exec biome ci` (no writes, exit nonzero on findings).

**Effort:** 1 new file (biome.json) + 1 modified package.json (+1 devDep) + 1 modified justfile (+~25/-~10 LOC).

**Decision needed:**
- **D12: Which domains to enable by default.** Default: **svelte + drizzle + playwright at `"all"`, test at `"recommended"`**. Project + types commented out (opt-in for follow-up cycle). Approve or override.

---

### F4 — Format-mass commit (mandatory between F3 and F5)

**What:** R15 caught that the existing repo uses tabs of width 1 / no semis vs Biome defaults. After enabling Biome + domains, `biome ci` would fail massively across `.ts/.svelte/.json/.css/.html`. Pre-format the repo in a dedicated commit.

**Note:** Biome domains may surface *additional* findings beyond format issues — e.g., `noDrizzleDeleteWithoutWhere` may flag existing code. **Mitigation:** the format-mass commit runs `biome format --write` only (NOT `biome lint --write`); lint findings are addressed case-by-case in follow-up commits so they get human review.

**Effort:** 1 commit, large diff (format changes only — no semantic).

---

### F5 — Eliminate GitHub Actions + add local Podman CI recipes

**What (same as v4):**
1. Delete `.github/workflows/e2e.yml` + empty `.github/`. Update `playwright.config.ts` comments `:1-22` and `:105`.
2. NEW `Containerfile.ci` (~70 lines; `node:24-bookworm-slim` + Chromium runtime deps + pnpm + just + `chromium` symlinked to `/usr/bin/chromium`).
3. Add 5 recipes to `justfile`: `ci-build`, `ci` (alias `ci-test`), `ci-shell`, `ci-e2e`, `ci-clean`. Plus `ci-drift` (per D5 decision).
4. Adopt `[group()]` in `justfile` (per R15 H2).
5. NEW `docs/ci-local.md` (~80 lines runbook). Mirrors `docs/deploy.md` format.

**Effort:** 5 files (2 new, 2 modified, 2 deleted) + ~6 new justfile recipes.

---

## Sequencing (4 work-unit commits)

1. **`docs(odd): close R11/R12/R13 audit cycle + adopt just in reports (U3 follow-up F1+F2)`**
   - 5 files (1 new), ~+72/-3 LOC.

2. **`chore(tooling): adopt Biome 2.5.15 + activate domains + repair precommit + drop vestigial deploy (U3 follow-up F3)`**
   - 3 files (1 new), +~45/-~10 LOC, +1 devDep.

3. **`chore(style): format repo with Biome 2.5.15 (gate repair)`**
   - 1 commit, large diff. Run `biome format --write .` only — lint findings deferred.

4. **`chore(ci): drop GitHub Actions + add local Podman CI recipes (U3 follow-up F5)`**
   - 5 files (2 new, 2 deleted, 1 modified), +~160/-~170 LOC.

Total: 4 commits, 13 files (4 new), +~357/-~183 LOC, **1 new devDep** (`@biomejs/biome@2.5.15` pinned).

---

## Verification (per commit)

After commit 1: `just check` 0/0; `just test` 149/149; grep sanity (only intentional pnpm references).
After commit 2: `pnpm exec biome --version` → 2.5.15; `just --list` shows new recipes; `just biome ci` **expected to fail** until commit 3.
After commit 3: `just biome ci` → 0 issues; `just precommit` → check + biome-check + test all green.
After commit 4: `podman --version` → 6.1.3; `just ci-build` succeeds; `just ci-shell` enters; `just ci` runs e2e inside container.

---

## Risks (v5 specific)

- **F3 Svelte domain `all` may flag existing Svelte 5 idiom as "legacy"** — e.g., `noSvelteLegacyConst` may flag `let foo` patterns where `$state` is preferred. Mitigation: domain at `"all"` is opt-in; can downgrade to `none` per rule if too noisy. Will not block commit 3 (format only).
- **F3 Drizzle domain `all` is high-value but may surface false positives** — `noDrizzleDeleteWithoutWhere` requires a `.where(...)` clause; some legitimate test setups use `delete()` without WHERE to clear test state. Mitigation: rule can be `off` per-line with `// biome-ignore` comment, or globally downgraded to `none`. Will not block commit 3.
- **F3 Playwright domain `all` may flag legitimate patterns** — `noPlaywrightNetworkIdle` may flag tests using deprecated patterns. Mitigation: same as Drizzle (per-rule `off`).
- **F3 Test domain `recommended` is low-noise** — `noFocusedTests` may flag `.only()` calls if present. Likely 0 violations in current codebase.

---

## Out of scope (parked, not this cycle)

- **`project` and `types` domains** — opt-in via biome.json comment; enable in a follow-up cycle when perf cost is acceptable.
- **Lint findings surfaced by the new domains** — handled case-by-case in follow-up commits so they get human review (not auto-fixed in the format-mass commit).
- **Migrate `package.json:22-25` (db:* scripts) to `just`** — REJECTED.
- **`just doc` recipe** — REJECTED.
- **Phase 6.1 Playwright AC6-AC11 loop** — separate feature.

---

## Decisions to make before implementation

Orchestrator picks defaults if silent.

| # | Question | Default recommendation |
|---|---|---|
| **D12** | Biome domains enabled by default | **`svelte: "all"`, `drizzle: "all"`, `playwright: "all"`, `test: "recommended"`**; `project` and `types` commented out (opt-in for follow-up) |

---

## Cross-reference

- mcode audit logs:
  - R11: `/tmp/opencode/mcode-u3-audit.log`
  - R12: `/tmp/opencode/mcode-u3-plan-audit.log`
  - R13: `/tmp/opencode/mcode-u3-cosmetic-audit.log`
  - R14: `/tmp/opencode/mcode-just-audit.log`
  - R15: `/tmp/opencode/mcode-biome-audit.log`
  - R16: (this turn) inline refinement — no separate audit file; analysis appended to R15 log
- Biome docs verified: `https://biomejs.dev/linter/domains/` (webfetch) + context7 `/biomejs/biome` queries on domains/rules/dependencies
- TallerAgentes precedent: `<HOME>/Proyectos/Taller-Agentes/Containerfile.ci`
- Last reviewed boundary: `482a00e` (R13 follow-up, 2026-10-04)
- Plan version: v5 (post user-pivot to Biome + domains verified per official docs), 2026-10-04
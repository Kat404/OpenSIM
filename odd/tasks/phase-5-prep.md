# Phase 5 Prep — Spec sync + audit backlog hardening

**Feature:** `phase-5-prep`
**Branch:** `feat/phase-1-foundation` (continuing — not on default; no new branch)
**Goal:** Close the spec/implementation drift and resolve the 10 non-blocking mcode M3.1 audit findings that the 6th round (Phase 4 audit) documented, so Tarea 5.1 (`@axe-core/playwright` WCAG 2.1 AA) and Tarea 5.2 (Cloudflare deploy) start from a clean floor.
**Status:** Draft — awaiting sign-off.

---

## Context (from Engram `obs-010b812e0b7ccc34` + direct repo inspection)

- OpenSIM v1.1 ships 4/5 phases on `feat/phase-1-foundation` (38 GPG-signed work-unit commits, working tree clean, no push).
- 115/115 tests passing, JS bundle 78.7 KB gz (budget 100), CSS 11.9 KB gz (budget 30).
- Stack: SvelteKit 3 + Svelte 5.57 (Runes) + Cloudflare D1 + Drizzle 0.45 + Valibot 1.5 + pdf-lib 1.17.
- Dev credential: `<NUMERO DE CONTROL PURGADO>` / `opensim-dev-2026`.

**Drift observed:**
- `odd/tasks/opensim.md` §8 still marks Tarea 4.1, 4.2, 4.3 as `[ ]` (pending). They are committed (cabeza `d15cacb feat(pdf)…`). Housekeeping.
- 10 non-blocking findings from the 6th mcode M3.1 audit round are documented but unaddressed. Listing with the evidence each maps to in the current tree:

| ID | Finding (verbatim) | File(s) affected | Proposed fix (one-line) |
| --- | --- | --- | --- |
| N2 | prefers-color-scheme block asymmetric | `src/app.html`, `src/lib/styles/tokens.css` | `app.html` only sets `data-theme` when localStorage has a stored value; otherwise leaves the attribute unset so `tokens.css` `@media (prefers-color-scheme)` owns the initial paint. |
| N3 | FOUC SSR residual | `src/lib/components/layout/LayoutHeader.svelte` | Drop the `onMount` re-read in `LayoutHeader`; trust `app.html` + `theme.svelte.ts`. |
| N4 | Lost OS reactivity | `src/lib/utils/theme.svelte.ts` | Add a `matchMedia('(prefers-color-scheme: dark)')` listener that toggles `data-theme` only when no manual override exists. |
| N5 | Toggle icon SSR flash | `src/lib/components/layout/LayoutHeader.svelte` | Render both `Sun` + `Moon` icons unconditionally; toggle visibility via `[data-theme]` CSS selector. |
| M4 | Combobox focus (re-open path) | `src/lib/components/layout/CmdKPalette.svelte` | Verify focus is restored to the input every time the palette opens (including second-open); confirm `aria-activedescendant` stays in sync after result list changes. |
| M6 | Deep-link one-way | `src/routes/(protected)/reticula/+page.svelte`, `src/lib/components/layout/CmdKPalette.svelte` | When retícula navigates away, clear the URL hash so back-button returns to the un-focused DAG; ensure `page.url.hash` reactivity handles in-page hash changes (not just route changes). |
| L1 | 4 doc lines out of date | `src/app.html` comments, `src/lib/styles/tokens.css` header | Update the inline comments to describe the new "stored override OR `prefers-color-scheme` at first paint, then live" behavior. |
| L3 | KardexTable copy vs STATUS_LABEL | `src/lib/components/kardex/KardexTable.svelte` (evalCell), `src/lib/utils/status-labels.ts` | Extract `EVALUATION_LABEL` (Ordinario / Repetición / Especial) next to `STATUS_LABEL`; replace inline `evalCell` map. |
| N7 | Day index unused | `src/lib/components/schedule/TimeGridSchedule.svelte` | Investigate which `day`/`dayIndex` is unused; remove or wire it. (Evidence: `byDay` map keys are `DayLetter`, template iterates `DAY_LETTERS` and uses `(letter)` key — the `i` index is currently dropped.) |
| N8 | Status label dedup | `src/lib/components/tramites/*`, `src/lib/components/layout/LayoutSidebar.svelte` | Audit hard-coded "Disponible"/"Bloqueado"/"Aprobada" strings; route them through `STATUS_LABEL` (or a sibling `PROCEDURE_STATE_LABEL`) to keep the single source of truth. |

**Out of scope for this feature (deferred to Tarea 5.1):**
- The full `@axe-core/playwright` WCAG sweep.
- Any new a11y findings that surface in 5.1.
- Cloudflare deploy (Tarea 5.2).

---

## Tasks (one work-unit commit per task)

### Task 1 — Spec sync: close Phase 4.0 / 4.1 / 4.2 / 4.3 in `odd/tasks/opensim.md`
- [ ] Mark `Task 4.1`, `4.2`, `4.3` as `[x]` in §8.
- [ ] Add a short sub-block "Phase 4.0 hardening" with the 7 pre-Phase-4 commits.
- [ ] Add a short sub-block "Phase 4 implementation" with the 4 Phase 4 commits + 1 N1 fix commit.
- [ ] Conventional Commit: `docs(spec): close Phase 4.0 + 4 tasks in §8 (work-unit)`.

### Task 2 — Theme system hardening (N2 + N3 + N4 + N5)
- [ ] `src/app.html`: only set `data-theme` if `localStorage.getItem('opensim-theme')` returned a valid stored value; otherwise leave the attribute unset and let the CSS `@media` block decide. Update the inline comment.
- [ ] `src/lib/utils/theme.svelte.ts`: register a `matchMedia('(prefers-color-scheme: dark)')` listener. When the OS theme flips AND no manual override is stored, update `data-theme` (which the existing `MutationObserver` already mirrors into the rune).
- [ ] `src/lib/components/layout/LayoutHeader.svelte`: drop the redundant `onMount` re-read; render both `Sun` and `Moon` icons unconditionally; toggle visibility via `header:has([data-theme="dark"]) .header__theme-sun { display: inline-flex }` and the inverse for moon. The click handler remains.
- [ ] Conventional Commit: `fix(theme): prefers-color-scheme symmetry + OS reactivity + SSR icon (audit N2/N3/N4/N5)`.

### Task 3 — Cmd+K palette polish (M4 + M6)
- [ ] `src/lib/components/layout/CmdKPalette.svelte`: ensure `inputEl?.focus()` runs on every `open` flip (the current `$effect` does this, but verify the queueMicrotask isn't racing the dialog mount in slow browsers). Add a test note in the comment.
- [ ] `src/routes/(protected)/reticula/+page.svelte`: subscribe to `page.url.hash` reactively so hash changes within the same route (e.g. Cmd+K → `reticula#calculo` → user types again in Cmd+K → `reticula#algebra`) update `focusedCanonicalId`. Also clear the hash when navigating away from `/reticula` so back-button returns to the un-focused DAG.
- [ ] Conventional Commit: `fix(palette): focus re-entry + retícula hash round-trip (audit M4/M6)`.

### Task 4 — Schedule + Kardex polish (N7 + L3 + N8)
- [ ] `src/lib/components/schedule/TimeGridSchedule.svelte`: audit the `day` / numeric index flow. Drop any unused variable. If `i` from `{#each DAY_LETTERS as letter, i}` is dropped intentionally, replace `(letter)` with `(i)` to keep the keyed-each contract.
- [ ] `src/lib/utils/status-labels.ts`: add `export const EVALUATION_LABEL: Record<EvaluationType, string> = { ORDINARIO: 'Ordinario', REPETICION: 'Repetición', ESPECIAL: 'Especial' }`.
- [ ] `src/lib/components/kardex/KardexTable.svelte`: replace the inline `evalCell` map with `EVALUATION_LABEL[t]`. Replace the inline `{#each [...] as opt}` filter buttons with a shared `EVALUATION_OPTIONS` constant (same source as the labels) so the filter UI and the cell renderer can never drift.
- [ ] `src/lib/components/tramites/ProcedureStepper.svelte`, `TramiteFormTitulacion.svelte`, `TramiteFormResidencia.svelte`, `TramiteFormServicioSocial.svelte`, `src/lib/components/layout/LayoutSidebar.svelte`: replace hard-coded "Disponible"/"Bloqueado" with a shared `PROCEDURE_STATE_LABEL` constant in `lib/utils/status-labels.ts` (or co-locate in `tramites/` if the labels are feature-specific — decide on first encounter).
- [ ] Conventional Commit: `refactor(labels): single-source EVALUATION_LABEL + PROCEDURE_STATE_LABEL (audit L3/N8)`.

### Task 5 — Docs sync (L1)
- [ ] `src/app.html`: rewrite the inline comment block above the IIFE to describe the new contract: "If the user has a stored override we apply it; otherwise we let the CSS `@media (prefers-color-scheme)` block own the initial paint, and the JS side mirrors the OS theme thereafter via `matchMedia`."
- [ ] `src/lib/styles/tokens.css`: update the "Auto-detect on first load when no explicit data-theme is set" comment to read "Auto-detect on first load when no explicit data-theme is set; JS overrides only when localStorage has a stored value." Adjust the four lines accordingly.
- [ ] Conventional Commit: `docs(theme): align comments with prefers-color-scheme symmetry fix (audit L1)`.

### Task 6 — Verify
- [ ] `just check` (svelte-kit sync + svelte-check + wrangler types).
- [ ] `just test` (Vitest 115/115 still green).
- [ ] Manual smoke: `just dev`, log in, toggle theme, change OS theme, open Cmd+K, deep-link a subject, reload the retícula, navigate away. No FOUC, no stale icon, no stuck focus, no lost hash.
- [ ] Conventional Commit: `chore(phase-5-prep): verify pass + work-unit close` (or fold into Task 5 if a small README line lands).

---

## Verification (run before close)

1. `cd <HOME>/Proyectos/OpenSIM`
2. `just check && just test`
3. `just dev` (manual smoke per Task 6 checklist)
4. `git log --oneline -10` to record the 5-6 new work-unit commits in this feature doc.

## Non-goals (explicit)

- Tarea 5.1 (full WCAG sweep).
- Tarea 5.2 (Cloudflare deploy).
- Renaming `feat/phase-1-foundation` branch (deferred to Phase 5 entry).
- Fixing N1 (already committed as Phase 4 commit 0).
- Touching production D1, push, or PR (user-owned per ODD step 6).

## Evidence (filled in at close)

**Work-unit commits on `feat/phase-1-foundation` (5 + 1 fix-up):**

| # | Commit | Task | Title |
| --- | --- | --- | --- |
| 1 | `59ef4f7` | 1 | `docs(spec): close Phase 4.0 + 4 tasks in §8 (work-unit)` |
| 2 | `1660256` | 2 | `fix(theme): prefers-color-scheme symmetry + OS reactivity + SSR icon (audit N2/N3/N4/N5)` |
| 3 | `d703a93` | 3 | `fix(palette): focus re-entry + retícula hash round-trip (audit M4/M6)` |
| 4 | `01984e6` | 4 | `refactor(labels): single-source EVALUATION_LABEL + PROCEDURE_STATE_LABEL (audit L3/N8) and drop unused day field (audit N7)` |
| 5 | `b447598` | 4-fix | `fix(kardex): move EVALUATION_TYPES to client-safe module` |
| 6 | `be1f65f` | 5 | `docs(theme): align comments with prefers-color-scheme symmetry fix (audit L1)` |

**Verification snapshot after Task 6:**

- `just check` — svelte-check: 0 errors, 0 warnings.
- `just test` — Vitest 5: 115/115 passing (9 files).
- `pnpm build` — production build green. Client JS ≈ 78 KB gz (budget 100; 22% headroom). CSS ≈ 12 KB gz (budget 30; 60% headroom). Unchanged from the Phase 4 baseline.
- Manual smoke (deferred to user): `just dev` → login as `<NUMERO DE CONTROL PURGADO>` / `opensim-dev-2026`. Verify (a) no FOUC on first paint with stored override, (b) OS theme change flips the app when no override exists, (c) toggle icon stays correct, (d) Cmd+K re-open lands focus on the input, (e) deep-link Cmd+K → `/reticula#<subject>` round-trips, (f) kardex filter pills and cells share the same label set, (g) procedure badges show `Disponible` / `Bloqueado` from the shared map.

**Findings closed:** N2, N3, N4, N5, M4, M6, L1, L3, N7, N8 — all 10 documented mcode M3.1 round-6 non-blocking findings are now resolved. Phase 5.1 (axe-core WCAG sweep) and Phase 5.2 (Cloudflare deploy) can start from a clean floor.

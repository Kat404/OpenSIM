# `odd/` — OpenSIM Project Bookkeeping Index

<!-- odd-tracker
kind: index
status: active
last-verified: 2026-10-08
reconciled-against: feat/phase-9-verified-curriculum@8f40837 (main@ffcd595)
sha-warning: every SHA cited in this file predates the 2026-10-08 GPG re-sign rewrite and is dead; re-derive the current SHAs with `git log --oneline --grep='<subject>'`
-->

OpenSIM (Open Source — Sistema Integral Modular) reached **Phase 7 complete**. The build,
the WCAG audit, the U1–U4 polish cycle and the hardening cycle are all closed and recorded
with commit SHAs. **Phase 9 (curriculum data foundation) is the active phase: T9.1 and T9.2 are
closed, T9.3–T9.14 are open.** This file is the index; `tasks/opensim.md` is the canonical spec.

> **Reconciled 2026-10-08.** Task 5.2 (production deploy) and the filed-not-started Phase 8
> item are both **closed** — see "Resolved 2026-10-08" below. Nothing is left waiting on an
> operator question.

## Quick answer

| Question | Answer |
| --- | --- |
| **What is done?** | Phases 1, 2, 3, 4.0, 4, 5, 6, 6.1, 6.2, 6.5, 7, 8 (a11y dark-theme contrast), 9.1–9.2. |
| **What is open?** | **Phase 9, T9.3–T9.14** — gated by blockers B2–B5 (see `tasks/phase-9-unblock.md`). |
| **What is next?** | **U5**, the `defer_foreign_keys` experiment in a throwaway D1 under `/tmp`. It decides the shape of U6–U8 and mutates nothing in the repo. |
| **Pushed?** | **Yes — both remotes.** `main` (`ffcd595`, 126 commits) and `feat/phase-9-verified-curriculum` (`8f40837`, 128 commits, +2 over `main`) are on GitHub and Codeberg. Force-pushed after the 2026-10-08 re-sign rewrite. |
| **Signed?** | **Yes — 126/126 on `main`, 128/128 on the feature branch**, GPG key `3335F4A0D9DBBA95`. Every SHA changed in the rewrite, so older SHAs cited anywhere in `odd/` are dead. |

## Phase table

| Phase | Status | Outcome | Record |
| --- | --- | --- | --- |
| 1 — Database Schema & Seeding | Closed | 12-table Drizzle schema + 42-subject `ISIC-2010-224` curriculum + idempotent D1 seed + dev-credential CLI. | `opensim.md` §8 Tasks 1.1–1.4 |
| 2 — Core Algorithms & Design System | Closed | 18 atomic UI components, DAG traversal + credit thresholds, HSL color hash, native single-file auth (0 npm auth deps). | `opensim.md` §8 Tasks 2.1–2.5 |
| 3 — Layout & Interactive Modules | Closed | Collapsible sidebar + Cmd+K, dashboard, proportional TimeGrid, interactive Bézier DAG retícula, unified kardex. | `opensim.md` §8 Tasks 3.1–3.5 |
| 4 — Simulator, Procedures & PDF | Closed | `/reinscripcion` split simulator with global signature, `/tramites` stepper with 182/208 credit gates, vectorial Carga Académica PDF. Preceded by the 7-correction 4.0 hardening block. | `opensim.md` §8 Tasks 4.0.1–4.0.7 + 4.1–4.3 |
| 5 — Audit, A11y & Edge Deploy | **Closed** | 5.1: axe-core WCAG 2.1 AA sweep, 14/14 specs green (7 routes × 2 themes), findings N9–N19 + N21–N22 closed. **5.2 resolved 2026-10-08** — Worker live, production D1 real, remote at `0008`. | `opensim.md` §8 Tasks 5.1–5.2; `tasks/phase-5.md` |
| 6 — UI/UX Polish + Audit + Tooling | Closed | U1–U4 shipped (`1294c91`, `5d7ac9c`, `e7facd3`, U3 in 6.1); mcode R11–R17 audit chain closed; Biome 2.5.15 adopted; GitHub Actions dropped for local Podman CI; `just qa`/`just qa-fast` naming. Tests 149/149 (Phase 6 closeout snapshot — **NOT VERIFIED** today). | `opensim.md` §6.0–6.5; `tasks/phase-6-ui-polish.md` |
| 7 — Hardening | Closed | CSP moved to SvelteKit `kit.csp.mode:'nonce'`; avatar fixture excluded from the production bundle; `--brand-600` contrast fix; `<title>` on root routes; `/404` button restored; pnpm pin synced. | `opensim.md` §7 (`5ab128e`, `d34c3df`, `b49e5a7`, `9a98041`, `92ed2d0`) |
| 8 — a11y dark-theme contrast | **Closed 2026-10-06** | The 3 `chromium-dark` axe contrast failures are fixed at the source, not per-hue. `SUBJECT_LIGHTNESS.dark` 28 → 20 (`e2708a1`), plus `--fg-tertiary` on the stepper's active button (`99c366a`). Gate is **114/114, 0 failed**. | `tasks/findings-remediation.md` §Phase 8 |
| 9 — Curriculum data foundation | **Active** | T9.1 + T9.2 closed (`6ca7c12`, `8f40837`): verified `ISIC-2010-224` dataset (68 subjects, 468 course groups, 32 units) + `seriation_state`/`component` columns. T9.3–T9.14 open, gated by B2–B5. | `tasks/phase-9-curriculum-data-foundation.md`; `tasks/phase-9-unblock.md` |

## Resolved 2026-10-08 — Task 5.2 (production deploy) and Phase 8

**Both closed. The historical contradiction is preserved below; neither record was deleted.**

### What the records used to say

| Record | Said (still true as history) |
| --- | --- |
| `tasks/phase-6-ui-polish.md` Context | App is **live at `https://opensim.jose-luis-rs.workers.dev`** as of 2026-10-03. |
| `tasks/opensim.md` §8 Task 5.2 | The **only unchecked box in the spec** — still open. |
| `tasks/phase-5.md:80-98` (5.2.1–5.2.5) | The deploy checklist — **never ran**. |
| This file, pre-2026-10-08 | *"The placeholder UUID in `wrangler.jsonc` is still `00000000-0000-0000-0000-000000000000`."* |

### What resolved it

| Premise | Verdict | Evidence |
| --- | --- | --- |
| Is there a real production D1? | **Yes.** | `wrangler.jsonc:36` → `"database_id": "390df78e-c4c2-4ace-94f4-6baebf1eb88f"`. Never the placeholder. `tasks/phase-5.md:83-85` already recorded this on 2026-10-06 — **this file was the stale one.** |
| Is the Worker live? | **Yes.** The production Worker URL is recorded in the Context block of `tasks/phase-6-ui-polish.md`. Workers Builds was relinked by the operator on 2026-10-08 after the repo was deleted and recreated; **the Worker itself was never deleted**. |
| Is the remote D1 current? | **Yes — B6 closed.** | `wrangler d1 migrations list opensim --remote` → `✅ No migrations to apply!`; `0006`–`0008` registered in `d1_migrations` (9 total). Row counts unchanged: subjects 42, `student_progress` 38, `course_groups` 8, `student_credentials` 1, `student_profiles` 1. |
| Which deploy produced the URL? | **A Workers deploy from outside the Phase 5 checklist**, and the checklist was effectively run piecemeal by the operator. | B7 (relink) closed 2026-10-08. |

**Still `NOT VERIFIED`:** the production **axe sweep against prod** (step 5.2.5) — no record of
it exists in any file. Do not read Task 5.2 as "verified green in production"; read it as
"the deploy exists and the data layer is current".

Full procedure: `docs/deploy.md`.

## Filed but not started — Phase 8 — **CLOSED 2026-10-06**

**Was:** 3 `chromium-dark` axe failures on `/horario`, `/reinscripcion`, `/tramites` — contrast
**~3.97:1** (`#cbd5e1` `--fg-secondary` on the HSL-hashed subject background `#31721d`,
fails AA 4.5:1). Gate was 271/274.

- **Pre-existing**, not introduced by Phase 7 `b49e5a7`: present at `ccd490f` HEAD.
- The same 3 specs **pass** on the `chromium` (light) and `chromium-data-theme-dark` projects.
- Consequence: the e2e gate is **271/274**, not 274/274.
- **No record exists yet.** It is cited only as prose in `tasks/opensim.md` §7 Task 7.3 and
  `tasks/phase-6-ui-polish.md` Progress 2026-10-06. Phase 8 has no feature doc — creating one
  is the next bookkeeping task.

**Now (2026-10-06, before this 2026-10-08 reconciliation):** all four of the above bullets are
historical. The 3 failures had **two** causes, not one, and both were fixed at the model level:

| Cause | Fix | Current SHA |
| --- | --- | --- |
| `getSubjectColor()`'s JSDoc claimed lightness 28/88 held ≥4.5:1 for every hue. **False** — at fixed 60% saturation relative luminance is not constant across hue; worst case is hue 60 in dark at **3.416:1**, worse than the 3.97 axe reported. | `SUBJECT_LIGHTNESS.dark` 28 → **20**. Measured 5.491:1 vs `--fg-secondary`, 7.672:1 vs `--fg-primary`. The background model is the correct lever; raising `--fg-secondary` would have *lowered* the ratio in the yellow band. | `e2708a1` |
| The "N CR" line in the stepper nav painted `--fg-tertiary` on the active button's `--brand-50` (#164e63 dark) = 3.55:1 — unrelated cause. | Scoped to `.proc__nav-meta` in `ProcedureStepper.svelte`, not the token: changing `--brand-50` or `--fg-tertiary` would have repainted six other consumers (Tabs, Badge, Sidebar, KardexTable). | `99c366a` |

Closeout commit: `8c70790` (`docs(odd): record Phase 8 closeout and the --fg-tertiary latent
finding`). Gate is now **114/114, 0 failed**. Phase 8 has a doc: `tasks/findings-remediation.md`
§Phase 8 (T8.1–T8.3 all `[x]`).

**Carried forward, not closed:** `--fg-tertiary` cannot be made AA-compliant against the
generated subject-block background at 60% saturation (3.17:1 light / 3.18:1 dark). axe does not
report it today, so it is not in the 27 findings. Recorded in
`tasks/findings-remediation.md` §"Latent finding" rather than silently dropped.

## Blockers — Phase 9

Full detail in `tasks/phase-9-unblock.md`. Summary as of 2026-10-08:

| ID | Blocker | Status |
| --- | --- | --- |
| B1 | RDD review rejected on the opencode runtime | **Resolved by decision** — RDD disabled at clone scope (`receipt-driven development: off (decided by clone_local)`); global still `on`. `gentle-ai 4.0.0` is the latest release; OpenCode is not an eligible immutable-review runtime for this build. |
| B2 | `subjects.area` → NULL is not applicable in D1 as-is | **Blocked, deferred** — needs the U5 `defer_foreign_keys` experiment first. |
| B3 | `pnpm db:seed:gen` red since T9.1 | **Blocked** — depends on B2. |
| B4 | 29 PII blobs alive in `refs/pull/1/head` | **Open** — GitHub Support only. |
| B5 | Teacher redaction is a manual step | **Open** — U2. |
| B6 | Remote D1 was 3 migrations behind | **Closed 2026-10-08** — `0006`–`0008` applied, zero row loss. |
| B7 | Cloudflare Workers Builds relink | **Closed 2026-10-08** — relinked by the operator; the Worker was never deleted. |
| B8 | GPG signatures missing after the PII rewrite | **Closed 2026-10-08** — all 128 commits back-signed; 126/126 on `main`, 128/128 on the feature branch. |

## Review-round ledger

| Round | Scope | Verdict | Where |
| --- | --- | --- | --- |
| **mcode R21** | Phase 7 plan v1 | `ship-with-fixes` — 3 blockers (CSP `'self'` breaks hydration; `(dev)` group is layout-grouping not exclusion; spec split doesn't reduce runs) → all applied to v2. | `/tmp/opencode/mcode-phase7-audit.log` |
| **Gemini R20-2** | Phase 7 post-implementation cross-audit | **Clean** — no corrections commit after `92ed2d0`. | `/tmp/opencode/agy-r20-2-audit.log` |
| Gemini R20 | Phase 6 + 6.1 cross-audit | 3 critical + 5 important (CSP hash stale, fixture bundle leak, brand-600, pnpm drift, `dataTestid` anti-pattern, `--project` filter, missing `<title>`, `/404` button). | `opensim.md` §7 |
| mcode R19 | Phase 6.1 closeout | `ship-with-fixes` — 1 blocker (dark suite inert) + 4 minors, folded into `ccd490f`. | `tasks/phase-6-ui-polish.md` Progress 2026-10-05 |
| mcode R18 | 80-matrix loop plan v2 | 4 blockers + 5 minor corrections applied to v2. | `tasks/phase-6.1-avatar-test-loop.md` |
| mcode R16/R17 | Phase 6.5 plan v5 + CI follow-ups | Applied as `6e67534` + `338ad07`. | `tasks/phase-6.5-closure-and-just-adoption.md` |
| mcode R11–R13 | U3 audit chain | `--avatar-ring` cascade bug, C1–C5 cosmetic follow-ups. | `d789930`, `5b05166`, `7fb89a7`, `e43caae`, `482a00e` |
| mcode M3.1 round 7 | Phase 5.1 axe audit | 14/14 green; findings closed. | `tasks/phase-5-mcode-reviews/5.1-round-7.md` |
| mcode M3.1 round 6 | Phase 5-prep backlog | 10 non-blocking findings closed. | `59ef4f7`–`be1f65f` |

**Latest is mcode R21, then Gemini R20-2 (clean).** mcode R11–R19 (same model family) did not
catch the 8 Gemini R20 issues — cross-model review is what surfaced them.

## Files in `odd/`

| File | Role | Status |
| --- | --- | --- |
| `README.md` | This index | Current |
| `tasks/opensim.md` | **Canonical spec v2.2** — §8 is the source of truth per task | Current |
| `audit.md` | Pre-implementation audit (2026-10-01). AG-1…AG-22, CF-1…CF-5. | **Superseded** — banner added, findings preserved verbatim |
| `cf-3-auth-comparison.md` | 4-option auth analysis | **Superseded/closed** — shipped as native single-file, Resend leg dropped |
| `tasks/phase-5.md` | Phase 5.1 axe audit + 5.2 deploy checklist | Closed. **5.2 resolved 2026-10-08** — deploy exists, `database_id` real, remote at `0008`. |
| `tasks/phase-5-prep.md` | 10-finding audit backlog | Closed; 2 boxes left open (manual smoke, verify commit) |
| `tasks/phase-6-ui-polish.md` | U1–U4 feature doc + all Progress blocks | Closed. Its "UNRESOLVED CONTRADICTION" banner is resolved 2026-10-08 — history preserved, resolution appended. |
| `tasks/phase-6.1-avatar-test-loop.md` | AC6–AC11 80-matrix Playwright loop | Closed |
| `tasks/phase-6.5-closure-and-just-adoption.md` | Audit closure + Biome + Podman CI | Closed |
| `tasks/phase-6-u3-audit-closure.md` | R11/R12/R13 traceability table | Closed |
| `tasks/phase-6-u3-cosmetic-followups.md` | U3 follow-ups C1–C5 | Closed. The "stale status line" note in this index was itself stale — the doc's status line reads `CLOSED`, not awaiting approval. |
| `tasks/phase-7-hardening.md` | Phase 7 hardening plan | Closed |
| `tasks/phase-5-mcode-reviews/` | External review captures | Frozen archive. Has its own `README.md` since 2026-10-08. |
| `tasks/odd-bookkeeping-sync.md` | The 2026-10-06 bookkeeping pass (this index's own plan) | Closed |
| `tasks/findings-remediation.md` | 27-findings remediation plan, Phases 1–10 | **Active.** Phase 8 shipped 2026-10-06 (114/114). Its header "Plan v1 — awaiting go-ahead" and its Progress "Not started" are stale. |
| `tasks/phase-9-curriculum-data-foundation.md` | Phase 9 data-foundation plan (T9.1–T9.14) | **Active** — T9.1, T9.2 closed |
| `tasks/phase-9-unblock.md` | Phase 9 unblock plan B1–B8 | **Active** — B1, B6, B7, B8 closed; B2–B5 open. Untracked as of 2026-10-08. |

## Canonical spec

**`tasks/opensim.md` (v2.2) is canonical.** Per-task state lives in its §8; commit SHAs and
verification snapshots live in its Phase 6 and §7 sections. Every other file in this tree is a
feature report, a plan, or a historical record — useful for *why*, never for *what is done*.
When the two disagree, §8 wins. The Task 5.2 contradiction, the one documented exception, was
resolved on 2026-10-08 and the original claim is preserved above.

**Tracker convention (established 2026-10-08).** Every document in `odd/` opens with an
`<!-- odd-tracker ... -->` block carrying `kind`, `status`, `last-verified` and
`reconciled-against`. Grep `odd-tracker` to enumerate the tree. Status vocabulary is closed:
`active` · `closed` · `superseded`.

> **SHA warning, applies to every row above.** The 2026-10-08 re-sign rewrite changed **every**
> commit SHA in the repository. All 54 unique 7-hex SHAs cited in `odd/` before that date are
> dead — `git cat-file -e <sha>` fails on every one of them. Old `main` HEAD was `285475d`; the
> current `main` is `ffcd595`. **Do not trust any SHA in this tree without re-deriving it:**
> `git log --oneline --grep='<subject>'` is the reliable way back, since the subjects survived
> and only the hashes changed.
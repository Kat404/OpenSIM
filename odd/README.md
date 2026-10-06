# `odd/` — OpenSIM Project Bookkeeping Index

OpenSIM (Open Source — Sistema Integral Modular) reached **Phase 7 complete**. The build,
the WCAG audit, the U1–U4 polish cycle and the hardening cycle are all closed and recorded
with commit SHAs. **One task is genuinely open — Phase 5.2, the Cloudflare production deploy** —
and it carries a recorded contradiction that only the operator can settle. This file is the
index; `tasks/opensim.md` is the canonical spec.

## Quick answer

| Question | Answer |
| --- | --- |
| **What is done?** | Phases 1, 2, 3, 4.0, 4, 5.1, 6, 6.1, 6.2, 6.5, 7. |
| **What is open?** | **Task 5.2 only** — production deploy. Plus one filed-not-started Phase 8 item. |
| **What is next?** | Operator answers the deploy question below, then runs the `phase-5.md:80-98` checklist with their Cloudflare credentials. |
| **Pushed?** | **No.** 24 commits ahead of `origin/main`, all GPG-signed (key `3335F4A0…`). Push is human-owned. |

## Phase table

| Phase | Status | Outcome | Record |
| --- | --- | --- | --- |
| 1 — Database Schema & Seeding | Closed | 12-table Drizzle schema + 42-subject `ISIC-2010-224` curriculum + idempotent D1 seed + dev-credential CLI. | `opensim.md` §8 Tasks 1.1–1.4 |
| 2 — Core Algorithms & Design System | Closed | 18 atomic UI components, DAG traversal + credit thresholds, HSL color hash, native single-file auth (0 npm auth deps). | `opensim.md` §8 Tasks 2.1–2.5 |
| 3 — Layout & Interactive Modules | Closed | Collapsible sidebar + Cmd+K, dashboard, proportional TimeGrid, interactive Bézier DAG retícula, unified kardex. | `opensim.md` §8 Tasks 3.1–3.5 |
| 4 — Simulator, Procedures & PDF | Closed | `/reinscripcion` split simulator with global signature, `/tramites` stepper with 182/208 credit gates, vectorial Carga Académica PDF. Preceded by the 7-correction 4.0 hardening block. | `opensim.md` §8 Tasks 4.0.1–4.0.7 + 4.1–4.3 |
| 5 — Audit, A11y & Edge Deploy | **Split** | 5.1 closed: axe-core WCAG 2.1 AA sweep, 14/14 specs green (7 routes × 2 themes), findings N9–N19 + N21–N22 closed. **5.2 still open.** | `opensim.md` §8 Tasks 5.1–5.2; `tasks/phase-5.md` |
| 6 — UI/UX Polish + Audit + Tooling | Closed | U1–U4 shipped (`1294c91`, `5d7ac9c`, `e7facd3`, U3 in 6.1); mcode R11–R17 audit chain closed; Biome 2.5.15 adopted; GitHub Actions dropped for local Podman CI; `just qa`/`just qa-fast` naming. Tests 149/149. | `opensim.md` §6.0–6.5; `tasks/phase-6-ui-polish.md` |
| 7 — Hardening | Closed | CSP moved to SvelteKit `kit.csp.mode:'nonce'`; avatar fixture excluded from the production bundle; `--brand-600` contrast fix; `<title>` on root routes; `/404` button restored; pnpm pin synced. | `opensim.md` §7 (`5ab128e`, `d34c3df`, `b49e5a7`, `9a98041`, `92ed2d0`) |

## The one open task — Task 5.2 (production deploy)

**Two records contradict each other. Both are true in the docs; neither was deleted.**

| Record | Says |
| --- | --- |
| `tasks/phase-6-ui-polish.md` Context | App is **live at `https://opensim.jose-luis-rs.workers.dev`** as of 2026-10-03. |
| `tasks/opensim.md` §8 Task 5.2 | The **only unchecked box in the spec** — still open. |
| `tasks/phase-5.md:80-98` (5.2.1–5.2.5) | The deploy checklist — **never ran**. |

**Operator question that settles it:** which deploy actually produced the live URL (a Workers
deploy from outside the Phase 5 checklist?), and does a **production D1 with a real
`database_id`** exist in `wrangler.jsonc`? The placeholder UUID in `wrangler.jsonc` is still
`00000000-0000-0000-0000-000000000000`.

Do not close Task 5.2 from either side. Full procedure: `docs/deploy.md`.

## Filed but not started — Phase 8

**3 `chromium-dark` axe failures** on `/horario`, `/reinscripcion`, `/tramites` — contrast
**~3.97:1** (`#cbd5e1` `--fg-secondary` on the HSL-hashed subject background `#31721d`,
fails AA 4.5:1).

- **Pre-existing**, not introduced by Phase 7 `b49e5a7`: present at `ccd490f` HEAD.
- The same 3 specs **pass** on the `chromium` (light) and `chromium-data-theme-dark` projects.
- Consequence: the e2e gate is **271/274**, not 274/274.
- **No record exists yet.** It is cited only as prose in `tasks/opensim.md` §7 Task 7.3 and
  `tasks/phase-6-ui-polish.md` Progress 2026-10-06. Phase 8 has no feature doc — creating one
  is the next bookkeeping task.

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
| `tasks/phase-5.md` | Phase 5.1 axe audit + 5.2 deploy checklist | 5.1 closed; **5.2 unrun** |
| `tasks/phase-5-prep.md` | 10-finding audit backlog | Closed; 2 boxes left open (manual smoke, verify commit) |
| `tasks/phase-6-ui-polish.md` | U1–U4 feature doc + all Progress blocks | Closed |
| `tasks/phase-6.1-avatar-test-loop.md` | AC6–AC11 80-matrix Playwright loop | Closed |
| `tasks/phase-6.5-closure-and-just-adoption.md` | Audit closure + Biome + Podman CI | Closed |
| `tasks/phase-6-u3-audit-closure.md` | R11/R12/R13 traceability table | Closed |
| `tasks/phase-6-u3-cosmetic-followups.md` | U3 follow-ups C1–C5 | **Stale status line** — still reads as awaiting user approval although the work shipped as `5b05166`/`7fb89a7`/`e43caae`/`482a00e` |
| `tasks/phase-7-hardening.md` | Phase 7 hardening plan | Closed |
| `tasks/phase-5-mcode-reviews/` | External review captures | Archive |
| `tasks/odd-bookkeeping-sync.md` | The 2026-10-06 bookkeeping pass (this index's own plan) | Closed |

## Canonical spec

**`tasks/opensim.md` (v2.2) is canonical.** Per-task state lives in its §8; commit SHAs and
verification snapshots live in its Phase 6 and §7 sections. Every other file in this tree is a
feature report, a plan, or a historical record — useful for *why*, never for *what is done*.
When the two disagree, §8 wins, except for the Task 5.2 contradiction above, which is
deliberately left open.
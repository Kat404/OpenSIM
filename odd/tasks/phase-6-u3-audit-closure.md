# Phase 6 — U3 Audit Closure (R11/R12/R13)

<!-- odd-tracker
kind: phase-plan
status: closed
last-verified: 2026-10-08
reconciled-against: feat/phase-9-verified-curriculum@8f40837 (main@ffcd595)
sha-warning: every SHA cited in this file predates the 2026-10-08 GPG re-sign rewrite and is dead; re-derive the current SHAs with `git log --oneline --grep='<subject>'`
-->

**Feature:** `phase-6-u3-audit-closure`
**Branch:** `main` (continuing — same default as Phase 6)
**Goal:** Close the U3 audit cycle (mcode R11 → R12 → R13) formally with a traceability document and a lessons-learned section, so the next cycle starts with a known ceiling rather than re-discovering the same findings.
**Status:** Closure shipped (this doc). Audit cycle R11/R12/R13 is closed; lessons operationalized.

---

## Context

- Phase 6 U3 (Avatar status dot, WhatsApp-style overlap) shipped on `main` in 5 GPG-signed work-unit commits (`a90ba55`–`d789930`).
- Three audit rounds (R11 cross-audit, R12 cross-audit of the U3 follow-up plan, R13 cosmetic-audit) collectively caught: 1 cascade CSS bug, 1 production bug in `initials()`, 1 spec defect in C5, and 1 cosmetic-symmetry gap in C3.
- mcode is the canonical RDD reviewer (R15 confirmed; M3.1-Flash-Preview, max tokens, fresh agent each round).

---

## Resumen ejecutivo

The U3 cycle shipped clean in 5 work-unit commits, but mcode caught 3 real defects that the implementer (me) and the original mcode R11 round both missed. R11 caught the cascade bug post-merge; R12 caught the `initials('')` production bug and the C5 spec defect by re-reading the spec; R13 caught the C3 cosmetic-symmetry gap (status silently dropped when name is empty) by re-running the function with edge inputs. The cycle took 4 audit rounds (R11 pre-merge, R12 plan, R13 post-merge) to reach a clean state.

**Net shipped:** 8 commits on top of `3099f24` (5 original + 3 U3 follow-ups `7fb89a7`–`482a00e`). 0 outstanding findings at R13 close.

---

## Traceability

| Round | Finding | Fix commit | Evidence |
|---|---|---|---|
| **R11** | `.avatar__status` border cascades from global `box-sizing: border-box`; at xs/sm the 2 px ring eats the 25 % fill, leaving a 2–4 px visible dot | `d789930` (cascade CSS bugfix) | `/tmp/opencode/mcode-u3-audit.log` §Issues menores #2 |
| **R11** | Dead/inert `position: relative` + `flex-shrink: 0` on inner `.avatar` (frame already owns both) | (folded into `482a00e` C2) | `/tmp/opencode/mcode-u3-audit.log` §Issues menores #1 |
| **R12** | `initials('')` returns `''` not `'?'`; the `parts.length === 0` branch is unreachable because `''.trim().split(/\s+/)` returns `['']` (length 1) | `e43caae` (initials guard) | `/tmp/opencode/mcode-u3-plan-audit.log` §Refinement #1 |
| **R12** | C5 spec defect: AC9 still asserts `borderTopColor` but C1's `border → box-shadow` change removed the border | `482a00e` (C5 spec close) | `/tmp/opencode/mcode-u3-plan-audit.log` §Refinement #5 |
| **R12** | C3 cosmetic symmetry: `composeAltText('', 'online')` returns `'Avatar'` and silently drops status (exported function, public API) | `7fb89a7` (composeAltText keeps status) | `/tmp/opencode/mcode-u3-plan-audit.log` §Refinement #2 |
| **R13** | (cosmetic) AC9 needs the new `boxShadow` assertion path, not the deleted `borderTopColor` | (folded into `482a00e` C5) | `/tmp/opencode/mcode-u3-cosmetic-audit.log` §Cosmetic #1 |

---

## Lessons operationalized

### L1 — Re-run the function, don't just re-read the spec

**What happened:** R11 flagged `initials()` had "no test coverage". R12 went one step further and ran the function in Node with edge inputs (`''`, `'   '`, `'Grace Hopper'`). The R11 finding turned out to be a production bug, not a coverage gap.

**Operationalization:** mcode's RDD prompt now explicitly asks for **empirical re-runs of any public function in scope** (not just static reads). The cost is 30 seconds; the payoff is the difference between "ship a coverage test" and "ship a real fix".

### L2 — Re-read the spec, don't just trust the implementer's plan

**What happened:** R12 caught the C5 spec defect (`borderTopColor` no longer matches the code) by re-reading the AC line and the code together. The implementer (me) had updated the code and noted the spec drift in the plan but missed updating the spec itself.

**Operationalization:** mcode's RDD prompt now requires a **spec↔code diff pass** for every finding — for each AC line in scope, verify the assertion still matches the current code.

### L3 — Re-test the public API with edge inputs

**What happened:** R13 caught the C3 cosmetic-symmetry gap (`composeAltText('', 'online')` returns `'Avatar'`, drops status) by re-running the function with the empty-name + present-status combo. All 3 current call sites happened to omit `status` or pair it with `name`, so no test caught the regression.

**Operationalization:** Every public-exported function in `Avatar.svelte` (initials, composeAltText) now has explicit edge-input test cases covering the empty/whitespace boundary. The 6 initials tests + 3 composeAltText tests survive as living documentation of the contract.

### L4 — The cascade is the harder bug, not the surface

**What happened:** The 1 px visual artifact at xs/sm (R11's cascade bug) was the only finding the implementer would not have caught by re-reading the code. It required a fresh agent to read `.avatar__status` + `tokens.css:299-303` (global `box-sizing: border-box`) + the call site context together. The implementer had read all 3 separately.

**Operationalization:** mcode's RDD prompt now requires **cross-file trace** for every visual finding — the static CSS, the global rule, and the visual proof must all be cited. A visual finding without a cross-file trace is treated as incomplete.

---

## Cross-references

- mcode audit logs:
  - R11: `/tmp/opencode/mcode-u3-audit.log`
  - R12: `/tmp/opencode/mcode-u3-plan-audit.log`
  - R13: `/tmp/opencode/mcode-u3-cosmetic-audit.log`
- Memory observations (engram):
  - `opensim/phase-6-u3-audit-mcode-r11` — R11 cascade bug + L4 origin
  - `opensim/phase-6-u3-audit-mcode-r12` — R12 production bug + L1/L2 origin
  - `opensim/phase-6-u3-audit-mcode-r13` — R13 cosmetic symmetry + L3 origin
- Spec: `odd/tasks/phase-6-ui-polish.md` (U3 phase A/B/C) + `odd/tasks/phase-6-u3-cosmetic-followups.md` (C1–C5)
- Last reviewed boundary: `482a00e` (R13 follow-up close, 2026-10-04)
- Next cycle: `odd/tasks/phase-6.5-closure-and-just-adoption.md` (just-adoption + local CI + Biome)

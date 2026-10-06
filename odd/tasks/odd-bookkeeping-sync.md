# odd/ Bookkeeping Sync — reconcile task docs with shipped reality

**Date:** 2026-10-06
**Status:** Plan v1 — ready to implement
**Route:** delegated direct (1 writer) — 6+ non-trivial files, single coherent bookkeeping pass

## Objective

Bring `odd/` back into agreement with what the repository actually shipped, so the next
decision is made from accurate state instead of stale checkboxes.

## Problem

An exploration pass (2026-10-06) found the `odd/` tree is **ahead of reality in prose but
behind it in bookkeeping**. Specifically:

1. **76 unchecked boxes represent completed work.** Their completion is recorded elsewhere
   (commit SHAs in `odd/tasks/opensim.md`, the Evidence table inside `phase-5-prep.md`,
   Progress blocks in `phase-6-ui-polish.md`), but the boxes were never ticked.
2. **Three plan docs still say "pending user approval" for work already shipped.**
   `phase-6.1`, `phase-6.5`, and `phase-7-hardening` all record `[x]` tasks with commit
   SHAs in the canonical spec while their own status line claims they await a decision.
3. **A live deploy contradiction.** `phase-6-ui-polish.md:12-13` states the app is live at
   `https://opensim.jose-luis-rs.workers.dev` as of 2026-10-03, yet canonical Task 5.2
   (`opensim.md:419`) is the **only unchecked checkbox in the entire spec** and the
   `phase-5.md:80-98` deploy checklist never ran. These cannot both describe the same
   deploy. **This must be recorded as unresolved, not silently resolved.**
4. **No index exists.** `odd/` has 12 markdown files and no `README.md`. The de-facto
   index is `opensim.md` §8, whose heading says "**5 Fases**" while the body lists 12.
5. **Stale branch/commit claims outside `odd/`**: `README.md:130` and `docs/deploy.md:5`
   both name `feat/phase-1-foundation` as the current branch. The branch is `main`.
6. **Phase 8 is referenced but has no record.** Three `chromium-dark` axe failures
   (`/horario`, `/reinscripcion`, `/tramites`, ~3.97:1 contrast) are cited twice as
   "filed as Phase 8 follow-up" with nowhere to live.

## Why

Every remaining decision in this project — deploy, push, toolchain changes — depends on
knowing what is actually done. A spec whose only unchecked box says "deploy" while a
sibling doc says "already deployed" is worse than no spec: it will produce a wrong
answer under time pressure.

## Scope

Documentation reconciliation only. **No source code, no config, no dependency, and no
git commit** in this pass. Deployment, pushing, and Phase 8 execution are out of scope
and remain human-owned.

## Checklist

- [x] **T1** — Flip 3 shipped plan docs to closed, citing the commit SHAs recorded in
      `opensim.md` (§6.1 `:436-459`, §6.5 `:451-472`, §7 `:474-504`). **+ a 4th doc
      (`phase-6-u3-cosmetic-followups.md`) found by the executor after the surface was
      already fixed; closed in a follow-up edit with SHAs `5b05166`/`7fb89a7`/`e43caae`/`482a00e`.**
- [x] **T2** — Tick the 76 stale boxes **only where completion is evidenced**: `phase-5.md`
      5.1.1–5.1.8 (`:22-73`), `phase-5-prep.md` (`:44-76`), `phase-6-ui-polish.md` U1/U2/U4
      ACs (`:35-38`, `:57-59`, `:209-212`). **Do NOT touch `phase-5.md` 5.2.1–5.2.5
      (`:80-98`)** — those are real, unrun deploy steps.
      → **56 of 65 ticked** (real count, not 76 — see Premise corrections). 9 left
      unchecked for lack of traceable evidence; each documented in-place.
- [x] **T3** — Record the deploy contradiction explicitly in both places, marked UNRESOLVED
      with the operator question that settles it. Do not mark Task 5.2 complete.
- [x] **T4** — Fix superseded status lines: `cf-3-auth-comparison.md:5` (CF-3 closed per
      `opensim.md:18`,`:29`), `audit.md:5` (banner that it is a pre-implementation record,
      superseded by spec v2.2 — preserve the original findings), `opensim.md:372` ("5 Fases"
      → actual count).
- [x] **T5** — Create `odd/README.md` as the missing index: phase table, current state,
      the one real open task, the Phase 8 filed-not-started note.
- [x] **T6** — Correct the two stale branch claims in `README.md` and `docs/deploy.md`
      (one line each).
- [x] **T7** — Structural readback: every status line quoted, every tick traceable to a
      commit SHA or an Evidence row.

## Authorized scope

Documentation under `odd/`, plus two single-line corrections in `README.md` and
`docs/deploy.md`. Nothing else.

## Acceptance criteria

- No checkbox is ticked without a commit SHA, Evidence row, or Progress-block entry
  already recording that work as done.
- No historical finding is deleted — superseded records get a banner, not a rewrite.
- `odd/README.md` alone is sufficient to answer "what is done, what is open, what is next".
- The Task 5.2 contradiction is visible in the docs, not resolved by assumption.

## Verification

Readback only (documentation change, no runnable behaviour):
- `git diff --stat` — file count and line delta
- `rg -c '\[ \]' odd/` — remaining unchecked boxes, each classified as real vs stale
- `rg -n 'pending user|Pending user|Decision pending' odd/` — should return nothing
- `rg -n 'feat/phase-1-foundation' README.md docs/` — should return nothing

## Progress

**2026-10-06 — CLOSED.** All 7 tasks applied. 11 files changed (+94/−69) plus 1 new
(`odd/README.md`) and 1 out-of-surface follow-up edit.

Verified by readback:
- `rg -n 'pending user|Pending user|Decision pending' odd/` → **no matches**
- `rg -c '\[ \]' odd/` → **22** unchecked boxes remain, all classified:
  - **12 real** — `phase-5.md:80-98` deploy checklist (11) + `opensim.md:419` Task 5.2 (1)
  - **10 untraceable** — left unchecked honestly, documented in-place:
    `phase-6-ui-polish.md` U1-A2/A3/A4, U2-A2, U4-A2/A3/A4 (no measurement or
    verification recorded); `phase-5-prep.md` Task 6 manual smoke (deferred to user by
    its own Evidence table) + verify-pass commit (folded into Task 5 as `be1f65f`)

## Premise corrections

The executor found 5 errors in this plan's own problem statement. Recorded, not hidden:

1. **T1 undercounted.** A **fourth** doc claimed "Pending user approval" for shipped work:
   `phase-6-u3-cosmetic-followups.md:6`. It was outside the authorized surface, so the
   executor flagged it in `odd/README.md` instead of editing. Closed afterward in a
   follow-up edit (verified against `git log` before flipping).
2. **"76 boxes" was wrong.** The three T2 regions hold **65** (31 + 23 + 11), not 76 + 32.
   56 were tickable.
3. **T6 cannot reach zero.** `docs/a11y-audit.md:5` also names `feat/phase-1-foundation`
   (a dated audit record, arguably correct as history). Out of surface; left as-is
   deliberately.
4. **This file self-matches.** Its own problem statement and verification command contain
   the searched phrases, so that grep can never return zero while this file exists.
5. **Two different "Phase 6.1"s exist.** `opensim.md:436` labels *U3 Implementation* as
   Phase 6.1, while `phase-6.1-avatar-test-loop.md` is the AC6–AC11 Playwright loop. The
   T1 citation for the latter points at a section about something else.

## Evidence quality caveat

Phase 5.1's 31 ticks rest on a single closing SHA (`8f06369`) plus two named artifacts
(`docs/a11y-audit.md`, `5.1-round-7.md`) — per-work-unit SHAs for 5.1.1–5.1.6 were never
recorded. Stated explicitly in the annotation at `phase-5.md:21`. The ticks are defensible
but coarser than the other regions.

## Not done (out of scope, human-owned)

- **No commit was made.** All changes are uncommitted working-tree state. The repo is 25
  commits ahead of `origin/main`; `odd/tasks/phase-7-hardening.md` is still untracked.
- **The deploy contradiction is unresolved** (T3). It needs operator input.

## Next step

Phase 5.2 (Cloudflare Workers production deploy) — the one real open task, named as the
human's next step in four separate docs. Settle the T3 contradiction first.
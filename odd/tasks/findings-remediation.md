# Findings Remediation — 27 findings, 6 phases

**Date:** 2026-10-06
**Status:** Plan v1 — awaiting go-ahead + one product decision
**Route:** delegated direct per phase (each phase is one bounded writer)
**Source:** Codegraph application-surface audit, 2026-10-06. All 27 findings are `pre-existing`.

## Objective

Close every finding from the Codegraph audit completely — no deferred re-opens, no silent
partial fixes. Each finding maps to exactly one task below.

## Why

The Phase 7 audit returned a ship-safe verdict on a *hardening* phase. This audit covers the
whole application surface and found 2 BLOCKER, 3 CRITICAL, 14 WARNING, 8 SUGGESTION — including
a verified open redirect and two 500-producing PK collisions in the enrolment route. The prior
verdict did not cover this scope; shipping was never wrong, it was **unexamined**.

Two BLOCKERs and two of three CRITICALs share one file and one cause class: *the server action
does not validate what the UI implies*. That is why they ship as one phase, not four.

## Blocking decision — required before Phase 10

`student_progress` PRIMARY KEY is `(student_control_number, subject_canonical_id)` with
`period` outside the key (`drizzle/0000_tough_scalphunter.sql:63-64`). A student therefore
holds **at most one row per subject, forever**. Consequences:

- Re-taking a `REPETICION` (failed) subject is impossible
- Re-enrolling the same subject in a later period is impossible
- 32 of the 38 seed progress rows are `APPROVED` and permanently block re-enrolment
- The multi-value INSERT at `+page.server.ts:284-293` raises an unhandled PK violation → **500**

Three options, all defensible:

| Option | Change | Cost | Consequence |
| --- | --- | --- | --- |
| **A. PK includes `period`** | Drizzle migration; D1 table rebuild | Prod migration, seed churn | Semantically correct. History preserved. |
| **B. Keep PK, reject any subject with any row** | App-level guard only | ~10 lines | Simplest. But a reprobada subject stays permanently un-enrollable. |
| **C. Keep PK, UPDATE in place on re-enrolment** | App-level upsert | ~15 lines | No migration. Loses per-period history. |

The repo is a FOSS tool for a real school; re-enrolment after a failed subject is a real
workflow. **A is recommended**, but B is the honest lazy option if period-scoped history is not
required. **This is the maintainer's call — do not start Phase 10 without it.**

## Phase 8 — a11y dark-theme contrast
*Findings: the 3 known e2e failures. Independent of everything else.*

The only currently-red checks: `color-contrast`, ratio **3.97**, on `/horario`,
`/reinscripcion`, `/tramites` under `chromium-dark`. WCAG AA needs 4.5:1. Recorded in
`odd/README.md` as Phase 8 filed-not-started; this phase gives it a doc.

- [ ] **T8.1** — Locate the failing foreground/background pair per route
- [ ] **T8.2** — Raise `--fg-secondary` (or the offending token) to ≥4.5:1 in dark only
- [ ] **T8.3** — Verify: `just test-e2e` reaches **114/114, 0 failed**

**Gate for the whole program: e2e must be fully green before any later phase starts.**

## Phase 9 — security hardening
*Findings: 1 CRITICAL + 4 WARNING. Independent of every other phase.*

- [ ] **T9.1 (CRITICAL, verified)** — `safeInternalRedirect` open redirect.
      `src/lib/utils/redirect.ts:45` checks the **raw** string for `//`; line 60 returns the
      **normalised** `url.pathname`. `new URL("/..//evil.com", sentinel)` normalises the path to
      `//evil.com` while `url.origin` still equals the sentinel, so the guard at :57 passes and
      normalization reintroduces the exact prefix that was rejected.
      Verified against the real export: `/..//evil.com/x`, `/a/..//evil.com`, `/./..//evil.com`,
      `/%2e%2e//evil.com` all return a protocol-relative URL.
      **RED first:** add all four vectors to `tests/unit/redirect.test.ts`, observe failure.
- [ ] **T9.2** — Re-check the normalised pathname for a leading `//` before returning
- [ ] **T9.3** — `hashIp`: unsalted SHA-256 is brute-forceable across the whole IPv4 space.
      Add a per-install server-side secret pepper (`env`), or drop the privacy claim in the
      schema comment at `schema.ts:213-215` and say plainly that IPs are pseudonymous, not
      anonymous.
- [ ] **T9.4** — Session revocation: no code path deletes `auth_sessions` by
      `student_control_number`, though `schema.ts:219-221` claims `idx_auth_sessions_student`
      supports it. Add the bulk-delete primitive and wire it to logout.
- [ ] **T9.5** — Sliding session: `validateSessionToken` returns `expiresAt` and never extends
      it, so a student is hard-logged-out at exactly 30 days with no renewal.
- [ ] **T9.6** — Timing-equalisation dummy at `login/+page.server.ts:117` runs **100 000**
      iterations vs production's `PBKDF2_ITERATIONS = 10 000`, and decodes a 3-byte salt from
      `"AAAA"`. The branches differ measurably in both work and input size.

## Phase 10 — enrolment route correctness
*Findings: 2 BLOCKER + 2 CRITICAL, all in one file. Gated on the decision above.*

Route: `src/routes/(protected)/reinscripcion/+page.server.ts`

- [ ] **T10.0** — Resolve the PK decision (A / B / C) and record it here
- [ ] **T10.1** — BLOCKER: PK collision on any subject with a prior-period row → 500.
      `:213-230` filters `status = 'ENROLLED' AND period = <current>`, so the guard cannot see
      the 32 `APPROVED` rows. **RED first:** a test that enrols a subject the student already
      completed, expecting a clean `fail()`.
- [ ] **T10.2** — BLOCKER: `groupId` is deduped at `:185-186`; the resolved
      `subjectCanonicalId` never is. Two groups of one subject → two rows, one PK → 500.
- [ ] **T10.3** — CRITICAL: `:271` calls `findConflicts(candidateBlocks, enrolledBlocks)` only.
      `SchedulePreview.svelte:67` proves candidate-vs-candidate is a known pattern, but it exists
      only client-side and does not gate submit. The JSDoc at `:168-169` claims the action
      fails on overlap.
- [ ] **T10.4** — CRITICAL: first-enrolment deadlock. `getCurrentPeriod`
      (`src/lib/server/enrollment.ts:63-79`) reads existing `ENROLLED` rows; `load` returns an
      empty catalog at `:80-91` before the offer query at `:112`, and the action 400s at
      `:193-196`. A student with no enrolment can never create one.
- [ ] **T10.5** — Constraint for the tests: `enroll` guards `locals.user` explicitly at
      `:172-180` because a SvelteKit 3 action runs **before** any layout `load`, so the layout
      middleware does not cover form actions. Tests must exercise the exported action directly.

## Phase 11 — coverage of the request layer
*Findings: 2 WARNING. The structural gap.*

`tests/unit/` covers pure utils plus crypto and rate-limit helpers. **Zero** tests import
`hooks.server.ts`, `login/+page.server.ts`, `logout/+server.ts`, `api/export/carga/+server.ts`,
or any `(protected)/**/+page.server.ts`. 149 tests pass while the entire request-level auth gate
and every loader and form action are untested. Codegraph's own blast radius for `createSession`
reports "no tests found within 3 caller hops".

- [ ] **T11.1** — `hooks.server.ts:53` `handle`: locals.user, stale-cookie deletion, the six
      security headers
- [ ] **T11.2** — `login/+page.server.ts`: rate-limit branch, timing branch, redirect target,
      failure payloads
- [ ] **T11.3** — Session lifecycle: `createSession`, `validateSessionToken`, `invalidateSession`,
      `getUserFromSessionToken`, `getCredential`
- [ ] **T11.4** — `logout/+server.ts` and `api/export/carga/+server.ts`
- [ ] **T11.5** — Remaining `(protected)/**` loaders: horario, dashboard, reticula, kardex, tramites

Tests land **with** the fixes in Phases 9–10 as well; this phase closes the surface those
phases do not already cover.

## Phase 12 — stub honesty
*Findings: 3 WARNING. Independent.*

Three separate surfaces promise capability that does not exist:

- [ ] **T12.1** — The three Trámites forms (`ProcedureStepper.svelte:94-98`) collect input;
      the action at `tramites/+page.server.ts:227-251` reads the FormData and discards it,
      returning `fail(202, { notice: "Trámite en desarrollo" })`. Either implement persistence or
      disable the inputs and say plainly in the UI that the flow is not available.
- [ ] **T12.2** — The public homepage (`src/routes/+page.svelte`) is a component gallery with 15
      hardcoded demo fixtures and is the **sole consumer** of Toast, Tabs, Skeleton, Tooltip, Kbd,
      Modal, Dropdown and ProgressBar. Either give the atoms real consumers or accept the
      homepage is a design-system page and document it as such.
- [ ] **T12.3** — `/login/recuperar` ships a complete card UI with **no `+page.server.ts`**
      (`route_meta_data.json` records `[]`) and no reset-token table anywhere in the schema.
      There is no self-service recovery path. Decide: build the token flow, or make the page say
      "contacta a soporte" without pretending to be a form.

## Phase 13 — dead code
*Findings: 8 SUGGESTION. Zero risk. Independent; do last.*

All verified zero-caller:

- [ ] **T13.1** — `annotateConflicts` (`schedule-conflict.ts:107-113`) — test-only
- [ ] **T13.2** — `clearSessionCookieOptions` (`auth.ts:497-504`) — both clear sites hand-roll
      `cookies.delete(...)`; either adopt it or delete it
- [ ] **T13.3** — `pruneExpiredSessions` (`auth.ts:406-418`) — the cron injects equivalent raw
      SQL; not even tested, unlike its sibling
- [ ] **T13.4** — `subject_units` table — never selected, absent from `seed.sql`
- [ ] **T13.5** — `subject_aliases` — written by `seed.ts:188`, never read
- [ ] **T13.6** — `Drawer.svelte` — barrel re-export, zero consumers
- [ ] **T13.7** — `MAX_GRADE` / `MIN_GRADE` — test-only
- [ ] **T13.8** — `horario/+page.server.ts:83` — unknown day letters dropped by a silent
      `continue`; add a log or throw instead

## Finding traceability

| # | Sev | Finding | Task |
|---|---|---|---|
| 1 | BLOCKER | reinscripcion PK collision → 500 | T10.1 |
| 2 | BLOCKER | no dedup of resolved subject → 500 | T10.2 |
| 3 | CRITICAL | candidate-vs-candidate not checked server-side | T10.3 |
| 4 | CRITICAL | first-enrolment deadlock | T10.4 |
| 5 | CRITICAL | open redirect in `safeInternalRedirect` (verified) | T9.1–T9.2 |
| 6 | WARNING | redirect suite lacks dot-segment vectors | T9.1 |
| 7 | WARNING | hashIp unsalted | T9.3 |
| 8 | WARNING | no bulk session revocation | T9.4 |
| 9 | WARNING | no sliding session | T9.5 |
| 10 | WARNING | timing dummy 10x iterations | T9.6 |
| 11 | WARNING | request layer untested | T11.1–T11.4 |
| 12 | WARNING | session lifecycle untested | T11.3 |
| 13 | WARNING | Trámites forms discard input | T12.1 |
| 14 | WARNING | homepage is a component gallery | T12.2 |
| 15 | WARNING | `/login/recuperar` has no backend | T12.3 |
| 16 | WARNING | `ponytail:` global rate-limit counter | T12.4 — **unassigned, see below** |
| 17 | WARNING | `ponytail:` minute-truncated bucket key | T12.4 — **unassigned** |
| 18 | WARNING | `ponytail:` unbounded bucket rows | T12.4 — **unassigned** |
| 19 | WARNING | `ponytail:` inject-scheduled-handler patch | T12.4 — **unassigned** |
| 20 | WARNING | horario drops unknown day letters silently | T13.8 |
| 21 | SUGGESTION | `annotateConflicts` dead | T13.1 |
| 22 | SUGGESTION | `clearSessionCookieOptions` dead | T13.2 |
| 23 | SUGGESTION | `pruneExpiredSessions` dead | T13.3 |
| 24 | SUGGESTION | `subject_units` dead table | T13.4 |
| 25 | SUGGESTION | `subject_aliases` never read | T13.5 |
| 26 | SUGGESTION | `Drawer.svelte` dead | T13.6 |
| 27 | SUGGESTION | `MAX_GRADE`/`MIN_GRADE` test-only | T13.7 |

**Honest gap:** findings 16–19 are the four `ponytail:` debt markers. They are *documented
deliberate shortcuts with named ceilings*, not defects — they are correct as they stand and
carry no test requirement. There is no task for them yet because closing any of them means
accepting the cost the comment explicitly defers (sharding, bucket redesign, a build-time
dependency). **That is a maintainer decision, not remediation.** They need an owner and a
horizon, not a checkbox.

## Test policy

Applicable and enforced: **RED → GREEN → REFACTOR** per task. The reproductions are cheap —
T9.1 has four failing vectors, T10.1 has one enrolment collision, T10.3 has one self-overlapping
submit. No task may ship with a fix and no failing-then-passing test.

Baseline: `just qa` green; `just test-e2e` **111 passed / 3 failed / 160 skipped**.
Target at T8.3: **114 passed / 0 failed**.

## Verification

Per task: the named test, plus `just qa-fast` (check + biome + vitest). Per phase: `just qa`
and `just test-e2e`. Program exit: e2e fully green and every finding row above checked off.

## Constraints

- Each phase is one bounded writer over one edit surface. No phase writes outside its own files.
- No commit or push without explicit instruction. Work-unit commits on `main` follow the
  existing repo convention.
- A D1 migration (option A) requires the operator's Cloudflare credentials; the writer stops
  and reports rather than running it.
- Findings 16–19 stay open until the maintainer assigns them an owner.

## Progress

_Not started._

## Next step

Answer the blocking decision, then run Phase 8 first — it is independent, it is the only
currently-red check, and it establishes the all-green baseline the rest of the program needs.
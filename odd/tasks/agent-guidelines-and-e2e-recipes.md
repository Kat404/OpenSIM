# Agent guidelines & e2e recipes — exact just commands, non-destructive seeding

<!-- odd-tracker
kind: task
status: active
feature: agent-guidelines-and-e2e-recipes
branch: feat/phase-9-verified-curriculum
created: 2026-10-10
-->

## Objective

Make the agent-facing guidelines (`AGENTS.md`) and the operator-facing recipes (`justfile`)
tell the same, verifiable truth: every command an agent is told to run must exist, and no
command an agent is told to run may silently destroy local state.

## Problem

1. `AGENTS.md` tells agents to run "`qa`, `e2e` and tests". There is no `e2e` recipe
   (`test-e2e` / `test-e2e-ui` / `test-e2e-avatar` are), and `qa` (`justfile:232`) does not
   include any e2e. An agent following the file literally has no command to run.
2. `just test-e2e` runs `db-reset` on every invocation (`justfile:120`): it deletes
   `.wrangler/state/v3/d1`, re-migrates and re-seeds. That is a full local database rebuild
   for a test run, and it is undocumented at the `AGENTS.md` level.
3. The reseed fragility has a known root cause and a known fix, documented as a defect in
   `scripts/README.md:18-40`: `insertStudentProfile` (`src/lib/server/db/seed.ts:502`) emits
   `INSERT OR REPLACE`, which SQLite executes as DELETE + INSERT, and
   `student_credentials` declares `ON DELETE CASCADE` on `student_profiles`. The test
   credential survives reseeding today only because its control number (`99999999`) differs
   from the enrolment fixture's (`12345678`). Provision `just db-set-password 12345678` and
   every reseed destroys the login.
4. The agentic `e2e` runner (`e2e.config.ts`, MiniMax-M3 driving a real browser) has no
   recipe at all — it is reachable only through `pnpm test:e2e`.
5. `AGENTS.md` has no stack summary, no observable threshold for the audit subagent, and no
   prohibition on the remote D1 / deploy recipes that the `justfile` itself marks ⚠.

## Why

An agent guideline file is executable specification. Every drift between it and the `justfile`
is a command an agent runs that does not exist, does more than the file says, or destroys
state the file never mentions. The credential cascade is the sharpest edge: it produces a
login failure that reads like an auth bug.

## Scope

In scope: `justfile`, `AGENTS.md`, `src/lib/server/db/seed.ts`, the generated
`src/lib/server/db/seed.sql`, `scripts/README.md`.

Out of scope: production D1 data, any remote execution, the Playwright suite's assertions,
the e2e config's target definitions, Codegraph policy (maintainer-owned, unchanged by
decision of the maintainer).

## Constraints

- No remote recipe runs. No `wrangler ... --remote`, no `just deploy-worker`. Local D1 only.
- `seed.sql` is tracked and consumed by `db-seed-remote`; it must be regenerated, not
  hand-edited.
- Artifact language: `AGENTS.md` and `scripts/README.md` stay in Spanish; `justfile` comments
  and code comments stay in English; commit messages in English.
- Least change: no new dependency, no new abstraction, no new config surface.

## Tasks

### T1 — justfile: non-destructive e2e + agentic e2e recipes

- [x] `test-e2e` becomes `db-migrate db-set-password` (both idempotent: a re-applied
      migration is a no-op, a set-password run re-upserts the credential). Local D1 survives.
- [x] New `test-e2e-fresh: db-reset db-set-password` — the explicit pristine-database path.
- [x] New `e2e-dev` — headless `e2e run`, depends on `db-set-password` (the agent signs in as
      the demo student), target is the single `web()` target the runner owns.
- [x] New `e2e-web` — same run with `--headed`, for debugging with a visible browser.
- [x] Update the `test-e2e` comment block: the current text claims the `db-reset` →
      `db-set-password` ordering is load-bearing. After T2 it is not; say what is true.

### T2 — seed.ts: real upsert, credential survives a reseed

- [x] `insertStudentProfile` emits `INSERT INTO student_profiles (...) VALUES (...) ON
      CONFLICT(control_number) DO UPDATE SET ...` covering every column the insert lists, so
      the row is updated in place and no DELETE fires.
- [x] Regenerate `src/lib/server/db/seed.sql` with `pnpm run db:seed:gen`; do not hand-edit.
- [x] Rewrite the "Seeds y credenciales" section of `scripts/README.md`: the cascade
      scenario it documents no longer reproduces, and the "orden obligatorio" caveat goes
      away with it. State the new guarantee and keep the ⚠ destructive framing for
      `db:reset` itself.

### T3 — AGENTS.md: exact commands, observable thresholds, remote prohibition

- [x] Open with a short context + stack line block (SvelteKit 3 + Svelte 5, Cloudflare
      Workers + D1/SQLite, Drizzle, pnpm, Biome, vitest, Playwright + axe-core, agentic
      `e2e` runner, Codegraph).
- [x] Replace "usa los comandos de `qa`, `e2e`" with the recipes that exist and what each
      one does, including the destructive path made explicit.
- [x] Audit-subagent threshold becomes observable: diff touches `drizzle/**`, auth or
      credential code, `wrangler.jsonc` / remote recipes, or ≥2 non-trivial files / ~400
      authored lines. Name what the audit must produce.
- [x] Remote prohibition: `db-migrate-remote`, `db-seed-remote`, `db-set-password-remote`,
      `deploy-worker` require explicit maintainer authorization, every time.
- [x] Codegraph section: unchanged, by maintainer decision.

## Authorized scope (edit surfaces)

```
justfile
AGENTS.md
src/lib/server/db/seed.ts
src/lib/server/db/seed.sql
scripts/README.md
odd/tasks/agent-guidelines-and-e2e-recipes.md
```

## Acceptance criteria

- `just --list` shows every recipe `AGENTS.md` names, and every recipe `AGENTS.md` names
  exists. No recipe named in `AGENTS.md` is missing.
- `grep` for `e2e`, `qa`, `db-reset` in `AGENTS.md` matches the `justfile` reality.
- After `pnpm run db:set-password 12345678` (the fixture's own control number) followed by
  `just db-seed`, `student_credentials` still holds the row. The `just` form
  (`just db-set-password 12345678`) does **not** work — `just` reads the second token as a
  recipe name and exits 1 with ``error: justfile does not contain recipe `12345678` ``.
  The recipe declares no parameters, so the positional form only exists on the pnpm script.
- `just db-seed` does not touch another student's rows: with a second student holding an
  enrolment group and a schedule block, a reseed leaves both in place.
- `pnpm run db:seed:gen` output is byte-stable across two consecutive runs.
- `just qa-fast` green.

## Checks

| Check | Command | Purpose |
| --- | --- | --- |
| Recipes parse | `just --list` | justfile syntax + inventory |
| Unit + lint + types | `just qa-fast` | `check biome-check test` |
| Upsert is real | `rg -n 'ON CONFLICT' src/lib/server/db/seed.sql` | generated SQL, not the source builder |
| Cascade regression | `just db-migrate && pnpm run db:set-password 12345678 && just db-seed` then count `student_credentials` | the scenario `scripts/README.md` documents as broken |
| Seed is stable | `pnpm run db:seed:gen` twice, diff | determinism of the generated file |
| Agent docs match | manual read of `AGENTS.md` against `just --list` | the whole point of T3 |
| Seed blast radius | add a second student + group + block, `just db-seed`, recount | the reseed must touch the fixture student only |
| Avatar suite auth | `pnpm exec playwright test tests/e2e/avatar-overlap.spec.ts --list` | the spec pulls in `[setup]`, so it is not auth-free |
| Recipe wiring | `just --dry-run test-e2e-avatar e2e-dev e2e-web` | each recipe's dependencies are what its comment claims |

## Progress

- **T1 closed** — `justfile`: `test-e2e` non-destructive, `test-e2e-fresh` / `e2e-dev` /
  `e2e-web` added, all four in `[group('test')]` with `[doc(...)]`.
- **T2 closed** — `insertStudentProfile` emits a real `ON CONFLICT ... DO UPDATE`; the
  cascade regression reproduced before the fix and does not after it.
- **T3 closed** — `AGENTS.md` names only recipes that exist, states what each does, and
  sets an observable audit threshold plus a per-occasion remote prohibition.

## Next step

All three tasks closed. Follow-up task T4 closed the documentation drift the writer found
outside its authorized surfaces: `README.md` still described the removed cascade and still
documented `just db-set-password 12345678`, which `just` cannot pass because the recipe
declares no parameters.

## T4 — close the documentation drift left by T2

- [x] `README.md:22-25` — the `db-reset` warning kept its true claim (the recipe deletes the
      whole local database, credential included) and lost the false reason (the cascade).
- [x] `README.md:137-144` — the control-number table now answers "survives `db:seed`?"
      instead of "survives `db:reset`?"; both rows are `yes`, and `db-reset` is called out as
      the one case that still needs `db-set-password` afterwards.
- [x] `README.md:149` — the positional form corrected to `pnpm run db:set-password`, with the
      env-var form kept as the supported alternative.
- [x] `src/lib/server/db/seed-password.ts:56-77` — the comment justifying the `99999999`
      default no longer claims the cascade makes it mandatory; it states the two reasons that
      survive.

## Verification evidence

### T1 — `ddb665e` `fix(justfile): default e2e to non-destructive, add agentic recipes`

```
$ just --list
exit 0 — all four recipes land under [test]:
  e2e-dev, e2e-web, test-e2e, test-e2e-fresh (plus the pre-existing test-e2e-avatar)

$ just --dry-run test-e2e-fresh
echo "⚠  Deleting local D1 state + reapplying migrations + seeding..."
rm -rf .wrangler/state/v3/d1
just db-migrate
just db-seed
pnpm run db:set-password
pnpm exec playwright test

$ just --dry-run e2e-dev
pnpm run db:set-password
pnpm exec e2e run

$ just --dry-run e2e-web
pnpm run db:set-password
pnpm exec e2e run --headed

$ just --dry-run test-e2e          # the non-destructive default
pnpm run db:migrate:apply          # no `rm -rf` anywhere in the chain
pnpm run db:set-password
pnpm exec playwright test
```

### T2 — `788cdf4` `fix(db): upsert the test student profile so reseeding keeps its credential`

```
$ pnpm run db:seed:gen             # "seed.sql generated (1 career, 68 subjects, …)"
$ md5sum src/lib/server/db/seed.sql   (run twice)
b526331af135b1039c6619f0382b0d02
b526331af135b1039c6619f0382b0d02   → byte-stable
$ git diff --exit-code src/lib/server/db/seed.sql   (after staging)
exit 0, no output

$ rg -n 'ON CONFLICT' src/lib/server/db/seed.sql
1208:INSERT INTO student_profiles (…) VALUES (…) ON CONFLICT(control_number) DO UPDATE SET …
```

Cascade regression, on the fixture's own control number:

```
$ just db-migrate
✅ No migrations to apply!

$ pnpm run db:set-password 12345678     # NOT `just db-set-password 12345678` — see below
Done.
$ pnpm exec wrangler d1 execute opensim --local --command "SELECT control_number FROM student_credentials"
12345678, 99999999

$ just db-seed
Done.
$ pnpm exec wrangler d1 execute opensim --local --command "SELECT control_number FROM student_credentials ORDER BY control_number"
12345678, 99999999          ← the credential the old statement destroyed
```

The check is not vacuous. Re-running the **old** statement by hand, after clearing
the student's children (what `deleteEnrollmentChildren` does), reproduces the bug.
The statement only succeeds once those NO ACTION children are gone — which is also
why a first attempt at it was refused with `FOREIGN KEY constraint failed`:

```
$ pnpm exec wrangler d1 execute opensim --local --command "SELECT control_number FROM student_credentials ORDER BY control_number"
99999999                    ← 12345678 gone
```

Local D1 restored afterwards: 7 enrollments, 14 schedule blocks, credential
`99999999` only — the state it was found in.

### T3 — `8645ce6` `docs(agents): point agents at recipes that exist, with hard thresholds`

```
$ for r in $(rg -o -N 'just ([a-z][a-z0-9-]+)' AGENTS.md -r '$1' | sort -u); do … just --list … done
16 recipes named in AGENTS.md, 16 OK, 0 MISSING
(db-migrate, db-migrate-remote, db-seed, db-seed-remote, db-set-password,
 db-set-password-remote, deploy-worker, e2e-dev, e2e-web, qa, qa-fast, test,
 test-e2e, test-e2e-avatar, test-e2e-fresh, test-e2e-ui)
```

### Whole-plan gate

```
$ just qa-fast
svelte-check found 0 errors and 0 warnings
Checked 135 files … No fixes applied.
Test Files  19 passed (19)   Tests  326 passed (326)
✓ pre-commit checks passed
```

No pre-existing failures: `qa-fast` covers the maintainer's six dirty files too and
is fully green.

## T5 — independent verification pass: ten findings

A verification pass over T1–T4 found ten defects, several of them corrections to
claims T1–T4 themselves had made. All ten are closed. `9be85ef` is the parent.

| # | Finding | Resolution | Commit |
| --- | --- | --- | --- |
| F1 | HIGH — the documented reason `99999999` survives a reseed was false. `seed-password.ts` writes that `student_profiles` row itself; three surfaces claimed it had none. Conclusion was right, reason was wrong. | Rewrote the reason in `seed-password.ts`, `README.md` (table cell + prose) and `auth.setup.ts`: `seed.sql` never names this control number, and the profile write it does emit is an upsert, so no DELETE and no cascade can reach it. | `16ac8f6` |
| F2 | HIGH — `db-seed` silently destroyed every other student's schedule blocks. `deleteEnrollmentChildren` deleted blocks for **all** enrolment groups but re-inserted only the fixture student's. | Scoped that DELETE to the control number the function already takes. Regenerated `seed.sql`. Corrected the four "safe to re-run" claims. | `b16bcb2`, `88aa384`, `a433f1c` |
| F3 | MEDIUM-HIGH — the false cascade warning was baked into the shipped `seed.sql`, which `db-seed-remote` applies straight to production D1. | Corrected the file header in `seed.ts` and the SQL header block it emits; regenerated. | `66d0ba2` |
| F4 | MEDIUM — `test-e2e-avatar` needs auth: both projects it runs under declare `dependencies: ["setup"]`. Two places called it auth-free. | Added the `db-set-password` dependency; corrected `justfile` and `AGENTS.md`. | `894c33f` |
| F5 | MEDIUM — `playwright.config.ts` and `auth.setup.ts` still told readers to run `just db-reset`. `test-e2e` never runs it. | Pointed both at `db-migrate` + `db-set-password`, named `test-e2e-fresh` as the destructive path. | `068b0b9` |
| F6 | LOW-MED — the audit threshold's "≥2 archivos no triviales" is not evaluable from a diff. | Replaced with a mechanical rule: ≥2 code files under `src/`, `tests/`, `drizzle/` or executable config, excluding comments and `docs/`. | `1cdd19c` |
| F7 | LOW — "Todo lo demás es local" was false: `just logs` tails the deployed Worker's production logs and `just push-mirror` publishes `main` to GitHub **and** Codeberg. | Corrected the sentence; both named as remote actions needing authorization. | `1cdd19c` |
| F8 | LOW — `auth_sessions` grows by one row per e2e run (measured 3 → 4) and nothing prunes it. **Not fixed by design.** | One-line `shortcut:` comment in the `test-e2e` block recording the limit and when to upgrade. | `9d6a7b7` |
| F9 | LOW — the agentic recipes provision from `OPENSIM_TEST_PASSWORD` but the runner signs in with `E2E_USER_ALUMNO_PASSWORD`; nothing couples them. | Comment states the two are independent; added a `db-migrate` dependency so the recipes work unmigrated; one `AGENTS.md` line. No coupling invented, no value printed. | `e584f8a` |
| F10 | LOW — the acceptance criteria specified `just db-set-password 12345678`, which fails: `just` reads the second token as a recipe name. | Corrected both acceptance criteria and the check table to the working `pnpm run db:set-password` form, documented the failure mode, added three checks. | this commit |

### F2 — reproduction and proof

The old statement, run by hand against a second student:

```
$ python3 d1q.py "DELETE FROM course_schedule_blocks WHERE group_id IN
    (SELECT id FROM course_groups WHERE student_control_number IS NOT NULL)"
# rows=0 rc=0
$ python3 d1q.py "SELECT cg.student_control_number, COUNT(*) AS blocks FROM
    course_schedule_blocks b JOIN course_groups cg ON cg.id=b.group_id
    GROUP BY cg.student_control_number"
# rows=0 rc=0          ← all 15 blocks gone: the fixture student's 14 and the other's 1
$ python3 d1q.py "SELECT student_control_number, COUNT(*) FROM enrollments GROUP BY 1"
student_control_number=12345678 c=7
student_control_number=55555555 c=1      ← enrolment survives, pointing at an empty group
student_control_number=99999999 c=1
```

The same scenario after the fix (`just db-seed` with the regenerated `seed.sql`):

```
$ python3 d1q.py "SELECT cg.student_control_number, COUNT(*) AS blocks FROM
    course_schedule_blocks b JOIN course_groups cg ON cg.id=b.group_id
    GROUP BY cg.student_control_number"
student_control_number=12345678 blocks=14    ← fixture student restored from the fixture
student_control_number=55555555 blocks=1     ← untouched
```

The probe rows were deleted afterwards and the local database is back where it was
found: `student_profiles` 2, `course_groups` 475, `course_schedule_blocks` 14,
`enrollments` 8, `student_credentials` 2, `auth_sessions` 4.

### F4 — the auth-free claim, disproved

```
$ pnpm exec playwright test tests/e2e/avatar-overlap.spec.ts --list | grep setup
  [setup] › setup/auth.setup.ts:50:1 › authenticate as test student 99999999
Total: 241 tests in 2 files

$ just --dry-run test-e2e-avatar
pnpm run db:set-password
pnpm exec playwright test tests/e2e/avatar-overlap.spec.ts
```

### F10 — the criterion that could not execute

```
$ just db-set-password 12345678
error: justfile does not contain recipe `12345678`
EXIT=1
```

### Whole-verification gate (after T5)

```
$ pnpm run db:seed:gen && git diff --exit-code src/lib/server/db/seed.sql
EXIT=0 — byte-stable, matches the source builder
$ md5sum src/lib/server/db/seed.sql   (run twice)
d14008b83f6e1a1728a6eefbafeb13c1
d14008b83f6e1a1728a6eefbafeb13c1

$ rg -n 'INSERT OR REPLACE INTO student_profiles|cascad' seed.ts seed.sql README.md AGENTS.md justfile scripts/README.md
  → no `INSERT OR REPLACE INTO student_profiles` anywhere; every remaining
    `cascad` mention is a true statement (scripts/README.md:25, justfile:195,
    seed.ts:29,463,468,499, seed.sql:11)

$ just db-migrate            → ✅ No migrations to apply!
$ pnpm run db:set-password 12345678   → Done.
$ d1q "SELECT control_number FROM student_credentials"    → 12345678, 99999999
$ just db-seed               → Done.
$ d1q "SELECT control_number FROM student_credentials"    → 12345678, 99999999
                                     ← the credential the old statement destroyed
$ just db-set-password       → Done.  (default 99999999 credential restored)

$ just qa-fast
svelte-check found 0 errors and 0 warnings
Checked 135 files … No fixes applied.
Test Files  19 passed (19)   Tests  326 passed (326)
✓ pre-commit checks passed
EXIT=0
```

### Not run

`just e2e-dev` and `just e2e-web` were verified with `--dry-run` only. Both spawn
`pnpm dev` and drive a real model gateway; running them is a remote operation and
was not authorized. The Playwright suites (`test-e2e`, `test-e2e-fresh`) were not
executed either — `test-e2e-fresh` deletes the local database and `test-e2e`
spawns a browser against it; neither was needed to establish any acceptance
criterion here. `--list` was used instead of a run to prove F4's premise.

`just e2e-dev` and `just e2e-web` were verified with `--dry-run` only. Both spawn
`pnpm dev` and drive a real model gateway; running them is a remote operation and
was not authorized. The Playwright suites (`test-e2e`, `test-e2e-fresh`) were not
executed either — `test-e2e-fresh` deletes the local database and `test-e2e`
spawns a browser against it; neither was needed to establish any acceptance
criterion here.
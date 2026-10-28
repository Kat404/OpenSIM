# OpenSIM — Sistema Integral Modular (FOSS)

A FOSS redesign of TecNM Morelia's academic management system, built as a working demo.

This is **not** a replica of the SIM and not a data mirror. The institution publishes some
of its academic data and none of its scheduling, so a faithful copy is impossible by
construction — scraping classmates would not close the gap either, because the schedule of
an offered group simply does not exist until the SIM assigns it at enrolment (see
`odd/tasks/phase-9-ui-integration.md`, finding H11). So OpenSIM takes the published half
seriously and declares the other half.

| Verified from the SIM | Design invention of this project |
| --- | --- |
| Subjects, codes, credits, seriation | Classrooms, buildings, schedules |
| The offering catalogue (468 groups) | The demo student's name and curriculum |
| The published syllabus (7 of 68 subjects — see `/temario`) | The 25 specialty credits that carry no syllabus |

Coverage is stated on screen rather than hidden: `/temario` names its real 7-of-68 ratio and
explains that the gap comes from the portal publishing only the active period, not from the
institution lacking the syllabus. When a source is silent, the UI says so instead of filling
the gap.

**v1 covers one career: ISIC-2010-224 (Ingeniería en Sistemas Computacionales).** The other
programmes are out of scope until their data is obtainable.

- **Stack:** SvelteKit `3.1.0` + Svelte `5.57.2` (Runes) + Cloudflare D1 + Drizzle ORM `0.45.4` + TypeScript `6.0.3` + Vite+ `1.4.0` (`vp`: format, lint, test, build)
- **UI language:** Spanish (es-MX)
- **Code language:** English
- **A11y target:** WCAG 2.1 AA

## Quick start

```bash
pnpm install
just db-reset            # nuke local D1 state, apply all migrations, reseed
just db-set-password     # provision test credential (see "Auth" below — read it first)
just dev                  # SvelteKit + local D1 via wrangler
```

Visit `http://localhost:5173`, log in with the test credentials below, and `/dashboard` will load the student's KPIs and the today's classes widget.

> **`db-reset` deletes the whole local database**, credential included — it removes
> `.wrangler/state/v3/d1` before re-migrating and re-seeding. Run `db-set-password` after it;
> `just test-e2e-fresh` already chains them in that order.
>
> A plain `just db-seed` no longer costs you a credential. The seed upserts `student_profiles`
> with `ON CONFLICT(control_number) DO UPDATE`, which updates the row in place, so the
> `ON DELETE CASCADE` that `INSERT OR REPLACE` used to fire into `student_credentials` never
> happens. `db-migrate` and `db-set-password` are idempotent outright; `db-seed` is
> deterministic for the fixture student (`12345678`) and non-destructive for credentials,
> but it still **rewrites** that student's rows — it is not a no-op on a database where you
> have since edited them by hand.

## Scripts

| Script                 | What it does                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `just dev`             | Vite+ dev server (`vp dev`)                                                              |
| `just build`           | Wrangler types check + Vite+ production build for Cloudflare                             |
| `just preview`         | Wrangler dev against the built Worker                                                    |
| `just check`           | svelte-kit sync + svelte-check + wrangler types                                          |
| `just test`            | Unit tests (single run) through `vp test`                                                |
| `just db-generate`     | Drizzle Kit — generate SQL migrations from schema diff (codegen only)                    |
| `just db-seed`         | Generate + apply `seed.sql` in one step (Drizzle codegen + `wrangler d1 execute --file`) |
| `just db-set-password` | Provision test student credential (dev only)                                             |

> **Deprecated / dead code:** `pnpm db:migrate` (Drizzle Kit) is intentionally NOT the canonical path. The canonical migrator is `wrangler d1 migrations apply` (via `just db-migrate`). See `docs/drizzle-migrations-and-data.md` for the rationale.

## justfile recipes

Run `just` (or `just --list`) to see all 30+ recipes. Key ones:

- `just dev`, `just build`, `just check`, `just test`, `just qa`, `just qa-fast`
- `just db-reset` (full local D1 reset + migrate + seed)
- `just db-set-password` (provision test credential)
- `just db-migrate-remote` (apply migrations to production D1)

## Project layout

```text
src/
  app.html
  app.d.ts
  lib/
    components/ui/        # 18 atomic Svelte 5 components
    server/
      auth.ts             # Native auth: PBKDF2 + sessions in D1
      db/
        schema.ts         # Drizzle schema (14 tables) + domain unions
        data/             # Verified curriculum JSON (68 subjects) + demo fixture
        index.ts          # Drizzle client wired to D1 binding
        seed.ts           # Idempotent seed script (catalog + demo student)
        seed-password.ts  # Dev credential provisioner
        seed.sql          # Generated by seed.ts; applied via d1 execute --file
      utils/              # DAG traversal, HSL color hash, redirect helper
    styles/tokens.css     # CSS custom properties (light + dark)
  routes/
    +layout.svelte                       # Root layout, theme provider
    +page.svelte                         # Demo route
    (protected)/
      +layout.server.ts                  # Auth gate (requires session)
      +layout.svelte                     # Protected layout wrapper
      dashboard/
        +page.svelte                      # Placeholder dashboard
        +page.server.ts                  # Loads user KPIs
    login/
      +page.svelte                       # Login form
      +page.server.ts                    # Form action: validate, createSession
      recuperar/
        +page.svelte                     # Informational view (soporte.ds@morelia.tecnm.mx)
      logout/
        +server.ts                       # POST logout endpoint
odd/
  README.md                # Index: phase table, current state, open task, review ledger
  tasks/opensim.md         # Canonical spec (v2.2)
  audit.md                 # Pre-implementation audit (SUPERSEDED — banner at top)
  cf-3-auth-comparison.md  # Auth library analysis (SUPERSEDED — closed as single-file native)
docs/
  drizzle-migrations-and-data.md  # Canonical D1 + Drizzle workflow
  odd-protocol.md                  # Full ODD reference
  odd-protocol-chat.md             # Chat-AI optimized ODD
tests/
  unit/
    auth.test.ts          # PBKDF2 + hashToken tests
    color.test.ts         # HSL hash tests
    dag.test.ts           # DAG traversal tests
    redirect.test.ts      # safeInternalRedirect tests
drizzle/
  0000…0005                         # academic + auth schema, token hashing, rate limiter
  0006_lush_wild_pack.sql           # student_progress PK gains period
  0007_fast_scarlet_witch.sql       # auth_attempts unique index
  0008_wealthy_kitty_pryde.sql      # subjects.seriation_state + component
  0009_subjects-rebuild.sql         # subjects rebuilt, area/semester/ht/hp nullable
                                    #   hand-written: drizzle-kit's rebuild is inapplicable on D1
  0010…0013                         # subject_units + course_groups columns, complementary
                                    #   activities, course_groups.student_control_number
justfile                  # 30+ recipes for build, check, test, db, deploy
```

## D1 (local + production)

Local D1 runs via Miniflare. The canonical migration flow is:

1. Edit `src/lib/server/db/schema.ts`
2. `just db-generate` — produces SQL in `./drizzle/`
3. `just db-migrate` — applies via `wrangler d1 migrations apply --local` (each file in a transaction)
4. `just db-seed` — generates `seed.sql` from the catalog and applies it via `d1 execute --file` (data only; the recipe is the collapsed `db:seed:apply`)
5. `just db-migrate-remote` — same runner, `--remote` binding

The rule: **`wrangler d1 execute --file` is for DATA only; DDL always goes through the migration runner.** See `docs/drizzle-migrations-and-data.md`.

## Auth (dev credentials)

`just db-set-password` provisions this credential by default — the control number comes
from `DEFAULT_CONTROL_NUMBER` in `src/lib/server/db/seed-password.ts`, not from here:

```
controlNumber: 99999999
password:      opensim-dev-2026
```

**That password is the fallback, not the truth.** `src/lib/server/db/seed-password.ts`
resolves it as *positional argument → `OPENSIM_TEST_PASSWORD` → the value in `.env` → this
default*, and it loads `.env` **before** the check that refuses the default on the remote
target. So when your `.env` sets `OPENSIM_TEST_PASSWORD`, that is the password the seeder
writes — locally **and** in the deployed Worker, whose demo answers to it. The remote guard
only fires when the environment carries no password at all.

Check what the seeder actually wrote before trusting a login:

```bash
just db-set-password        # prints "Password: ******** (not echoed)"
```

Two control numbers exist and they are **not** interchangeable:

| Number | What it is | Survives `db:seed`? |
| --- | --- | --- |
| `99999999` | the seeded credential, written by `db-set-password` | yes — `seed.sql` never names this control number, and the profile write it does emit is an upsert, so no `DELETE` and no `ON DELETE CASCADE` can reach the credential |
| `12345678` | the demo student in `enrollment-fixture.json` | yes — its profile is upserted in place, so a reseed keeps the credential |

So log in with **`99999999`**. The demo student's own data is still what the pages render,
because the fixture profile is seeded as `12345678`; the credential is a separate login shell
provisioned against its own control number, which the catalog seed never writes.

`db-reset` is the exception: it deletes the local database outright rather than upserting
into it, so the credential has to be provisioned again afterwards.

Override either value when you need to:

```bash
pnpm run db:set-password 12345678 "tu-contrasena"        # positional (the just recipe takes no arguments)
OPENSIM_TEST_CONTROL_NUMBER=12345678 OPENSIM_TEST_PASSWORD=… just db-set-password
```

DO NOT use these credentials in any deployed environment. `db-set-password-remote` refuses
the default password outright — but only when the environment does not already carry one,
so a `.env` with `OPENSIM_TEST_PASSWORD` reaches the remote database without the guard
ever firing.

## The local gate (git hook)

Cloudflare's Workers Builds integration **builds and deploys** on every merge to `main`: the
PR #11 merge was live 41 seconds after the merge commit. `main` has no branch protection and
no rulesets, so the last place a human can stop a regression is this machine, before the
push.

The repo ships a versioned pre-push hook that runs the gate. Enable it once per clone:

```bash
vp hooks enable      # installs the dispatcher, sets core.hooksPath
vp hooks status      # what is active in this clone
```

`VP_GIT_HOOKS=0 git push …` skips it on purpose. The hook runs `just qa-fast` (types + lint +
unit tests); the e2e suite stays a manual step (`just test-e2e`) because it needs the local D1
and a dev server.

## Demo data

The demo student in `src/lib/server/db/data/enrollment-fixture.json` carries an invented
name and an invented CURP. **No field in that file identifies a real person** (Phase 10, S5).

The schedule blocks and classroom names in the same file came from a real capture of the
SIM's carga académica. They are kept because they are installation names, not personal
data, and they are what makes the weekly grid credible. If you would rather the fixture be
entirely synthetic, that is a one-file change.

## Conventions

- English: code, components, props, types, comments, commits
- Spanish: UI copy (button labels, error messages)
- Conventional Commits on `main` (current branch)
- No Tailwind, no Lenis, no Motion.dev — pure Svelte 5 + CSS tokens
- WCAG 2.1 AA contrast on text
- Subpath imports `#lib/*` (SvelteKit 3 future); `$lib/*` still works as fallback

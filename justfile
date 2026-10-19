# OpenSIM — Open Source - Sistema Integral Modular
# OpenSIM rewrite in SvelteKit 3 + Svelte 5 + Cloudflare D1.
# Run `just` (or `just help`) to list recipes.
# Maintainer: Kat404 <Kat404@users.noreply.github.com>

set dotenv-load := true
set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

# Show all available recipes
default:
    @just --list --unsorted

# ===== Setup =====

# Install dependencies from lockfile (CI-safe)
install:
    pnpm install --frozen-lockfile

# Sync local main to both GitHub and Codeberg (origin has 2 push URLs).
# Run after every PR merge or when you want Codeberg to catch up.
push-mirror:
    git push origin main

# Update dependencies within semver ranges
update:
    pnpm update

# Regenerate pnpm-lock.yaml (use after adding deps)
lock:
    pnpm install --lockfile-only

# ===== Development =====

# Run dev server (SvelteKit + local D1 via wrangler)
dev:
    pnpm run dev

# Preview built worker locally
preview:
    pnpm run preview

# ===== Build & Check =====

# Build for Cloudflare Workers (wrangler types + vite build)
build:
    pnpm run build

# Type-check + svelte-check (strict TS)
check:
    pnpm run check

# Watch-mode type-check
check-watch:
    pnpm run check:watch

# Regenerate Cloudflare worker types (after wrangler.toml change)
gen-types:
    pnpm run gen

# ===== Format =====

# Format all files with Biome
[group('check')]
format:
    pnpm exec biome format --write .

# Verify formatting (CI mode, no writes)
#
# Biome 2.x removed `biome format --check`; the flag only ever worked
# under Prettier, and the 2026-10-04 Biome 2.5.15 migration carried the
# Prettier spelling over verbatim. Nothing ran this recipe, so it sat
# broken for five days. `biome ci` with the linter and the import assist
# disabled is the format-only equivalent and exits non-zero on a diff.
[group('check')]
format-check:
    pnpm exec biome ci --formatter-enabled=true --linter-enabled=false --assist-enabled=false

# Run Biome ci (format + lint + organizeImports, no writes) — CI gate
[group('check')]
biome-check:
    pnpm exec biome ci

# Run Biome linter only (no format check, no writes)
[group('check')]
lint:
    pnpm exec biome lint .

# ===== Tests =====

# Unit tests (vitest, single run)
test:
    pnpm test

# Unit tests in watch mode
test-watch:
    pnpm run test:unit

# Run Playwright AC6-AC11 avatar overlap suite (40 light + 40 dark;
# uses dev fixture page). The per-describe test.skip in the spec scopes
# light to chromium and dark to chromium-data-theme-dark, so the just
# recipe no longer needs --project flags.
#
# The spec itself needs no auth, but the run is not auth-free: both
# projects it runs under declare `dependencies: ["setup"]`, so
# auth.setup.ts signs in as the test student first and the credential
# must exist. That is why this recipe depends on `db-set-password`.
[group('test')]
[doc('Run Playwright AC6-AC11 avatar overlap suite (40 light + 40 dark; total 80 honest runs). Authenticates as the test student via the shared setup project.')]
test-e2e-avatar: db-set-password
    pnpm exec playwright test tests/e2e/avatar-overlap.spec.ts

# End-to-end tests (Playwright + axe-core), non-destructive.
#
# Both dependencies are idempotent, so a run leaves local D1 as it found
# it: re-applying already-applied migrations is a no-op, and
# `db-set-password` upserts the one credential row the suite signs in
# with. No state is deleted, so the run sees whatever data is already
# local — reach for `test-e2e-fresh` when the suite must start from a
# pristine database.
#
# The webServer block auto-spawns pnpm dev and tears it down on exit.
#
# shortcut: each run signs in through auth.setup and leaves one more
# `auth_sessions` row behind — measured 3 -> 4 across a single run.
# Local-only and harmless while the count is in the tens; if it ever
# matters, prune expired rows (add a DELETE ON the expiry column to
# db-set-password, which already touches the credential tables).
[group('test')]
[doc('Run the Playwright + axe-core suite against the existing local D1 (non-destructive: migrate + credentials, no reset). Use test-e2e-fresh for a pristine database.')]
test-e2e: db-migrate db-set-password db-set-password-alumno
    pnpm exec playwright test

# Same suite from a pristine database. `db-reset` deletes local D1 state,
# re-migrates and re-seeds, so local-only data is gone; `db-set-password`
# runs after it so the credential the suite signs in with exists again.
[group('test')]
[doc('DESTRUCTIVE: delete local D1 state, re-migrate, re-seed, provision the credential, then run the Playwright + axe-core suite.')]
test-e2e-fresh: db-reset db-set-password db-set-password-alumno
    pnpm exec playwright test

# Run E2E with UI mode (interactive; assumes DB is ready). `db-set-password`
# runs first so the credential exists before the browser asks for it.
test-e2e-ui: db-set-password
    pnpm exec playwright test --ui

# Agentic end-to-end tests: MiniMax-M3 driving a real browser.
#
# The runner owns the dev server — e2e.config.ts pins its single `web()`
# target to localhost and gives it `pnpm dev` as the app command — so
# nothing needs to be running first. It signs in as the demo student, so
# a migrated database with that credential provisioned is the setup it
# needs.
#
# `db-set-password` reads OPENSIM_TEST_PASSWORD from the environment and
# falls back to the `.env` file; the runner signs in with
# E2E_USER_ALUMNO_PASSWORD from `.env`. They are two variables in the
# same file and nothing enforces that they hold the same value, so if
# they ever disagree the run fails at login — which reads like broken
# auth and is not.
#
# A run drives a real model gateway: it costs tokens and is far slower
# than the Playwright suite. Reach for it for flows that selectors
# cannot honestly assert, not as the default check.
[group('test')]
[doc('Run the agentic e2e suite (MiniMax-M3 driving a real browser; the runner spawns and owns the local dev server).')]
e2e-dev: db-migrate db-set-password db-set-password-alumno
    pnpm exec e2e run

# Same run with the browser visible, for watching the agent work.
[group('test')]
[doc('Run the agentic e2e suite with --headed so the browser is visible (debugging).')]
e2e-web: db-migrate db-set-password db-set-password-alumno
    pnpm exec e2e run --headed

# ===== Database (D1 / Drizzle) =====

# Generate Drizzle migration from schema diff
db-generate:
    pnpm run db:generate

# Apply migrations to local D1 (Miniflare)
db-migrate:
    pnpm run db:migrate:apply

# Apply migrations to remote D1 (⚠ production)
db-migrate-remote:
    wrangler d1 migrations apply opensim --remote

# Seed remote D1 with the catalog only (NO test student — that's dev only)
db-seed-remote:
    wrangler d1 execute opensim --remote --file=./src/lib/server/db/seed.sql

# Seed local D1 (regenerates seed.sql + applies)
#
# Safe to re-run for CREDENTIALS: the enrolment profile is written with
# ON CONFLICT(control_number) DO UPDATE, so it is updated in place and
# fires no cascade — `student_credentials` keeps its row. `db-set-password`
# is a dependency of the e2e recipes only to guarantee the credential
# exists, not because this recipe would drop it.
#
# Not a no-op, though. Every delete it emits is keyed to the fixture
# student's own control number (12345678), and the rows it rewrites are
# that student's, so a reseed restores whatever the fixture says and
# discards hand edits to those rows. Other students' data is untouched.
# Rewrite the fixture student from data/enrollment-fixture.json.
db-seed:
    pnpm run db:seed

# Set the default test student password (dev only — see seed-password.ts header)
#
# This is the PLACEHOLDER student (99999999), the one the Playwright suite
# signs in with, on purpose: it owns no `student_progress` rows, so the
# deterministic suite can assert the empty state.
db-set-password:
    pnpm run db:set-password

# Set the CATALOGUE student's password (dev only — see seed-password.ts header)
#
# 12345678 is the student the fixture describes: 175 approved credits, 49
# rows in `student_progress`, 3 complementary credits. The agentic lane
# signs in as this one, because a judgment about DATA needs a student who
# has data — with the placeholder every screen renders an empty state and
# the tests can only assert things that cannot fail.
#
# Both recipes are idempotent upserts of one credential row each, and the
# password comes from the same `.env` the test setups read.
[group('db')]
[doc('Set the catalogue student (12345678) password on the local D1 — the student the agentic lane signs in with.')]
db-set-password-alumno:
    pnpm run db:set-password 12345678

# Set the test student password on the REMOTE D1 (⚠ production).
#
# Reads OPENSIM_TEST_PASSWORD from .env — `dotenv-load := true` is set at the
# top of this file, so no inline env var is needed:
#     just db-set-password-remote
# seed-password.ts refuses the dev default ("opensim-dev-2026") when
# OPENSIM_D1_TARGET=remote, so .env must define the key. An inline
# `OPENSIM_TEST_PASSWORD=...` still works as a one-off override.
db-set-password-remote:
    OPENSIM_D1_TARGET=remote pnpm run db:set-password

# Drizzle Studio (visual DB explorer at localhost:4983)
db-studio:
    pnpm run db:studio

# Full local D1 reset (delete state + migrate + seed)
#
# ⚠  Destructive: it deletes `.wrangler/state/v3/d1` outright, so
# everything local that is not in the seed or the migrations is gone —
# every student, not just the fixture's. `db-seed` at the end only
# rewrites the fixture student — see above — so re-run `db-set-password`
# afterwards to get a credential back.
# DESTRUCTIVE: delete local D1 state, re-migrate, re-seed.
db-reset:
    @echo "⚠  Deleting local D1 state + reapplying migrations + seeding..."
    rm -rf .wrangler/state/v3/d1
    just db-migrate
    just db-seed

# ===== Deploy =====

# Deploy to Cloudflare Workers (Tarea 5.2)
[doc('See docs/deploy.md for the full procedure (auth, D1 create, migrations, seed, deploy). Requires wrangler login (or CLOUDFLARE_API_TOKEN env var) and the production database_id set in wrangler.jsonc.')]
deploy-worker:
    pnpm build
    wrangler deploy

# Tail Cloudflare Worker logs (live)
logs:
    wrangler tail

# ===== Maintenance =====

# Clean build artifacts
clean:
    rm -rf .svelte-kit build .wrangler dist node_modules/.cache .vite

# Deep clean (also removes node_modules + lockfile)
nuke:
    rm -rf node_modules pnpm-lock.yaml .svelte-kit build .wrangler dist node_modules/.cache .vite

# Remove Playwright run artefacts: failed-test screenshots/traces
# (test-results/, ~2.4 MB), the HTML report (~5.3 MB) and the regenerated
# JSON runs (results.json alone reaches ~19 MB of pure telemetry). The
# durable a11y narrative lives in docs/a11y-audit.md, not in these files.
#
# Separate from `clean` on purpose: `clean` removes regenerable build
# output that carries no information, while this dir holds audit evidence.
# Fusing them makes `just clean` silently destroy the a11y trail.
#
# Deliberately NOT `playwright/`: that holds .auth/storage.json, the
# session state protected specs load via `test.use({ storageState })`.
# It regenerates on the next auth.setup run, but deleting it breaks a bare
# `playwright test` invocation, and at ~8 KB it is not an accumulation
# problem. Separate `clean-e2e` is the build-artifact cleanup; this is the
# test-artifact one.
clean-e2e:
    rm -rf test-results tests/e2e/reports/html tests/e2e/reports/*.json

# ===== Pipelines =====

# Full pre-push QA gate: check + biome-check + test + build
qa: check biome-check test build
    @echo ""
    @echo "✓ all green — ready to push"

# Fast pre-commit QA gate: check + biome-check + test (no build)
qa-fast: check biome-check test
    @echo ""
    @echo "✓ pre-commit checks passed"

# ===== CI (Podman local) =====

# Build the opensim-ci container image from Containerfile.ci.
# First-time setup; rebuild when Containerfile.ci or dependencies change.
[group('ci')]
[doc('Build the opensim-ci container image from Containerfile.ci.')]
ci-build:
    podman build -f Containerfile.ci -t opensim-ci:latest .

# Run the fast pre-commit QA gate inside the opensim-ci container.
# bind-mounts the repo to /repo; --userns=keep-id preserves host UID
# for bind-mounted artifacts (playwright-report, test-results);
# -e HOME=/tmp because npm/pnpm need HOME and the kept host UID
# may not exist in /etc/passwd inside the container. The container's
# default CMD (`just qa-fast`) runs the in-image fast QA gate.
# NOTE: the in-image gate is `just qa-fast` (check + biome-check + test).
# It does NOT run the axe-core e2e suite — for that, run `just test-e2e`
# on the host (it needs system Chromium and local D1 state).
[group('ci')]
[doc('Run `just qa-fast` (check + biome-check + test) inside opensim-ci container. For axe-core e2e suite, run `just test-e2e` separately.')]
ci: ci-build
    podman run --rm \
        --userns=keep-id \
        -v "$(pwd)":/repo \
        -w /repo \
        -e HOME=/tmp \
        opensim-ci:latest

# Interactive shell inside the opensim-ci container. For debugging.
[group('ci')]
[doc('Interactive bash shell inside opensim-ci container.')]
ci-shell:
    podman run --rm -it \
        --userns=keep-id \
        -v "$(pwd)":/repo \
        -w /repo \
        -e HOME=/tmp \
        opensim-ci:latest bash

# Remove the opensim-ci container image.
[group('ci')]
[doc('Remove the opensim-ci container image.')]
ci-clean:
    podman rmi opensim-ci:latest

# Migration re-apply smoke test (opt-in, quarterly). Snapshots the
# local D1 state, re-applies the migrations directory, and diffs
# the result. Re-applying already-applied migrations is a no-op, so
# "no diff" only proves migrations are idempotent on this state —
# it does NOT compare migrations vs the Drizzle schema. Use as a
# cheap "did migrations break anything since last apply" signal,
# not as a true drift detector.
# Pure local; does NOT touch remote Cloudflare D1 (destructive
# risk per mcode R15 audit).
[group('ci')]
[doc('Migration re-apply smoke test (opt-in, quarterly): snapshot local D1, re-migrate, diff. NOT a real schema-drift detector.')]
ci-drift:
    #!/usr/bin/env bash
    set -euo pipefail
    SNAP=.wrangler/state/v3/d1.snapshot
    # `cp -r src dst` copies INTO dst when dst exists, so a snapshot left
    # over from an aborted run nests a `d1/` directory that every later run
    # then reports as drift. Clear first, unconditionally.
    rm -rf "$SNAP"
    trap 'rm -rf "$SNAP"' EXIT
    if [ ! -d .wrangler/state/v3/d1 ]; then
        echo "no .wrangler/state/v3/d1 — run `just db-migrate` first"
        exit 1
    fi
    cp -r .wrangler/state/v3/d1 "$SNAP"
    pnpm run db:migrate:apply
    # Miniflare keeps -wal and -shm beside the database and rewrites them
    # on any read, so a bare `diff -r` reported drift on every run no matter
    # what the migrations did. They are scratch, not state.
    #
    # `diff | head` under `pipefail` aborts the script the moment head
    # closes the pipe, which skipped the cleanup and made the failure
    # self-perpetuating. Capture the diff, then truncate it for display.
    if diff -r -x '*-wal' -x '*-shm' -x '*.sqlite-journal' "$SNAP" .wrangler/state/v3/d1 > /tmp/ci-drift.diff; then
        echo "no drift"
    else
        echo "DRIFT DETECTED — investigate migrations:"
        head -50 /tmp/ci-drift.diff
        exit 1
    fi
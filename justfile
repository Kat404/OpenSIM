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
# uses dev fixture page). Public spec — no auth required. The per-
# describe test.skip in the spec scopes light to chromium and dark
# to chromium-data-theme-dark, so the just recipe no longer needs
# --project flags.
[group('test')]
[doc('Run Playwright AC6-AC11 avatar overlap suite (40 light + 40 dark; total 80 honest runs).')]
test-e2e-avatar:
    pnpm exec playwright test tests/e2e/avatar-overlap.spec.ts

# End-to-end tests (Playwright + axe-core).
#
# Order matters and is already correct: `just` runs recipe dependencies
# sequentially in written order, so `db-reset` (which re-runs `db-seed`)
# completes before `db-set-password` writes the credential. The ordering
# is load-bearing: `db-seed` destroys a credential belonging to the
# enrolment's control number (see the `db-seed` comment above), so
# re-running it without re-running `db-set-password` afterwards leaves the
# suite unable to log in. It only happens to be safe today because
# `db:set-password` defaults to a different control number than the
# enrolment fixture — see seed-password.ts and .env.example.
[doc('Full pipeline: reset D1, provision the test student credential, then run the Playwright + axe-core suite. The webServer block auto-spawns pnpm dev and tears it down on exit.')]
test-e2e: db-reset db-set-password
    pnpm exec playwright test

# Run E2E with UI mode (interactive; assumes DB is ready). `db-set-password`
# is a dependency for the same reason as in `test-e2e`: a `db:seed` run
# between here and login would drop the credential.
test-e2e-ui: db-set-password
    pnpm exec playwright test --ui

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
# ⚠  Invalidates the student credential. The seed upserts the enrolment
# profile with INSERT OR REPLACE, which in SQLite is a DELETE plus an
# INSERT; that DELETE cascades into `student_credentials`. A credential
# provisioned for the enrolment's control number is destroyed here, so
# `db-set-password` must run afterwards. A credential belonging to any
# other control number is untouched. Re-running this recipe is otherwise
# idempotent — same rows, same counts.
db-seed:
    pnpm run db:seed

# Set the default test student password (dev only — see seed-password.ts header)
db-set-password:
    pnpm run db:set-password

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
# Ends with `db-seed`, so it carries the same credential caveat: follow it
# with `db-set-password` if the credential belongs to the enrolment's
# control number. `test-e2e` already sequences them in that order.
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
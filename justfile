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
[group('check')]
format-check:
    pnpm exec biome format --check .

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

# End-to-end tests (Playwright + axe-core).
# Full pipeline: reset D1, provision the test student credential,
# then run the suite. The Playwright `webServer` block auto-spawns
# `pnpm dev` for the test and tears it down on exit.
test-e2e: db-reset db-set-password
    pnpm exec playwright test

# Run E2E with UI mode (interactive; assumes DB is ready)
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
db-seed:
    pnpm run db:seed

# Set the default test student password (dev only — see seed-password.ts header)
db-set-password:
    pnpm run db:set-password

# Drizzle Studio (visual DB explorer at localhost:4983)
db-studio:
    pnpm run db:studio

# Full local D1 reset (delete state + migrate + seed)
db-reset:
    @echo "⚠  Deleting local D1 state + reapplying migrations + seeding..."
    rm -rf .wrangler/state/v3/d1
    just db-migrate
    just db-seed

# ===== Deploy =====

# Deploy to Cloudflare Workers (Tarea 5.2)
# See docs/deploy.md for the full procedure (auth, D1 create, migrations, seed, deploy).
# Requires wrangler login (or CLOUDFLARE_API_TOKEN env var) and the production
# database_id set in wrangler.jsonc.
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

# ===== Pipelines =====

# Full verification: check + build + test
verify: check build test
    @echo ""
    @echo "✓ all green — ready for commit"

# Pre-commit checklist: check + biome-check + test
precommit: check biome-check test
    @echo ""
    @echo "✓ pre-commit checks passed"

# ===== CI (Podman local) =====

# Build the opensim-ci container image from Containerfile.ci.
# First-time setup; rebuild when Containerfile.ci or dependencies change.
[group('ci')]
[doc('Build the opensim-ci container image from Containerfile.ci.')]
ci-build:
    podman build -f Containerfile.ci -t opensim-ci:latest .

# Run the full pre-push QA session inside the opensim-ci container.
# bind-mounts the repo to /repo; --userns=keep-id preserves host UID
# for bind-mounted artifacts (playwright-report, test-results);
# -e HOME=/tmp because npm/pnpm need HOME and the kept host UID
# may not exist in /etc/passwd inside the container. The container's
# default CMD (just precommit) runs the in-image QA gate.
[group('ci')]
[doc('Full pre-push QA session (axe + unit tests + biome ci) inside opensim-ci container.')]
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

# Schema drift detection (opt-in, quarterly). Snapshots the
# local D1 state, re-applies migrations, diffs the schema.
# Pure local; does NOT touch remote Cloudflare D1 (destructive
# risk per mcode R15 audit).
[group('ci')]
[doc('Schema drift check: snapshot local D1, re-migrate, diff. Opt-in, quarterly.')]
ci-drift:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d .wrangler/state/v3/d1 ]; then
        echo "no .wrangler/state/v3/d1 — run `just db-migrate` first"
        exit 1
    fi
    cp -r .wrangler/state/v3/d1 .wrangler/state/v3/d1.snapshot
    pnpm run db:migrate:apply
    if diff -r .wrangler/state/v3/d1.snapshot .wrangler/state/v3/d1 > /dev/null; then
        echo "no drift"
        rm -rf .wrangler/state/v3/d1.snapshot
    else
        echo "DRIFT DETECTED — investigate migrations:"
        diff -r .wrangler/state/v3/d1.snapshot .wrangler/state/v3/d1 | head -50
        rm -rf .wrangler/state/v3/d1.snapshot
        exit 1
    fi
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

# Format all files (requires `pnpm add -D prettier prettier-plugin-svelte`)
format:
    pnpm exec prettier --write .

# Verify formatting (CI mode, no writes)
format-check:
    pnpm exec prettier --check .

# ===== Tests =====

# Unit tests (vitest, single run)
test:
    pnpm test

# Unit tests in watch mode
test-watch:
    pnpm run test:unit

# End-to-end tests (Playwright)
test-e2e:
    pnpm exec playwright test

# Run E2E with UI mode (interactive)
test-e2e-ui:
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

# Deploy to Cloudflare Pages
deploy:
    wrangler pages deploy

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

# Pre-commit checklist: check + format-check + test
precommit: check format-check test
    @echo ""
    @echo "✓ pre-commit checks passed"
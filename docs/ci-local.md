# OpenSIM — Local CI (Podman, post-GitHub-Actions)

Fecha: 2026-10-04
Target: reproducible CI gate that runs anywhere Podman runs.
Branch: `main`, post-`.github/` deletion.

---

## Why no cloud CI

The previous pipeline (`.github/workflows/e2e.yml`) ran the Playwright + axe-core suite on GitHub Actions. The user pivoted to **no cloud CI** during Phase 6.5 planning: the pipeline is reproducible on any host that has Podman + just + pnpm, and the project carries no per-host secrets to a remote runner. The `opensim-ci` container image (built from `Containerfile.ci`) is the single source of truth for the runtime.

This trades:

- **Cost:** free-tier Actions minutes → local CPU cycles on the developer's machine.
- **Convenience:** push-to-trigger runs → a one-liner (`just ci`).
- **Reproducibility:** ephemeral cloud VM → a pinned image (`node:24-bookworm-slim` + apt-pinned Chromium + pnpm@10.0.0).

The trade is worth it for a one-person FOSS project whose CI is 7 axe-core routes + 149 vitest cases (~3 minutes on a modern laptop).

## Prerequisites on the operator's machine

- `podman` ≥ 5.0 (verified: 6.1.3 on Arch). Rootless mode is fine; `just ci` uses `--userns=keep-id` to preserve the host UID for bind-mounted artifacts.
- `just` ≥ 1.58.0 (the recipe runner). Verified: 1.58.0.
- `pnpm` IS required on the host for **a clean clone**: the `opensim-ci` image never runs `pnpm install` — it bind-mounts the host's `node_modules/` into `/repo/node_modules/`. A fresh checkout must run `pnpm install --frozen-lockfile` (or `just install`) on the host before `just ci`, otherwise the in-image gate will fail at the first `import`.

> **TODO (future Option B):** add `pnpm install --frozen-lockfile` to `Containerfile.ci` as a build step. Trade-off: ~+300 MB in the image, but the image becomes self-contained (any host with Podman can run the gate without a pre-installed `node_modules/`). Tracked as a follow-up — mcode R17 §A5(b).

## Build the image

```bash
just ci-build
# or: podman build -f Containerfile.ci -t opensim-ci:latest .
```

First build pulls `node:24-bookworm-slim` (~250 MB) and apt-installs Chromium + the Playwright runtime deps (~300 MB). Subsequent builds are cached.

## Run the suite

```bash
just ci
```

The recipe:

1. Builds the image (skipped if up-to-date).
2. Runs `podman run --rm --userns=keep-id -v "$(pwd)":/repo -w /repo -e HOME=/tmp opensim-ci:latest` (no command override → the container's `CMD ["just", "precommit"]` runs the in-image QA gate: `check + biome-check + test`).

The `--userns=keep-id` flag preserves the host UID for bind-mounted artifacts (`playwright-report/`, `test-results/`, `.svelte-kit/`, `.wrangler/`). The `-e HOME=/tmp` is required because the kept host UID may not exist in `/etc/passwd` inside the container, and `pnpm`/`npm` need a writable `HOME`.

## Interactive shell

```bash
just ci-shell
```

Drops you into a bash shell inside the `opensim-ci` container with the repo bind-mounted. Useful for debugging: `just db-reset && just db-set-password && pnpm exec playwright test --debug`.

## Drift check (opt-in, quarterly)

```bash
just ci-drift
```

Snapshots `.wrangler/state/v3/d1`, re-applies migrations, and `diff -r`s the result. Exits non-zero with the diff on the first 50 lines if drift is detected. **Pure local**: it never touches the remote Cloudflare D1 (destructive risk per mcode R15). Run quarterly to catch schema drift between hand-written migrations and the live D1 state.

If `.wrangler/state/v3/d1` doesn't exist, the recipe exits 1 with a hint to run `just db-migrate` first.

## Clean up

```bash
just ci-clean
# or: podman rmi opensim-ci:latest
```

Removes the `opensim-ci:latest` image. Bind-mounted artifacts (`playwright-report/`, `test-results/`, `.svelte-kit/`, `.wrangler/`) on the host are **not** touched — they're your local state, not the image's.

## Recipe reference

| Recipe | What it does | When to run |
| --- | --- | --- |
| `just ci-build` | `podman build -f Containerfile.ci -t opensim-ci:latest .` | First time, or when `Containerfile.ci` changes |
| `just ci` | Build + run `just qa-fast` inside the container | Pre-push hook |
| `just ci-shell` | Interactive bash inside the container | Debugging |
| `just ci-clean` | `podman rmi opensim-ci:latest` | When you want to reclaim disk |
| `just ci-drift` | Snapshot local D1, re-migrate, diff | Quarterly, opt-in |
| `just test-e2e-avatar` | Playwright AC6-AC11 overlap suite (light + dark; 80 cells) | Dev iteration on the Avatar component, no auth required |

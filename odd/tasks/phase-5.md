# Phase 5 — Audit (axe-core) + Cloudflare deploy

**Feature:** `phase-5`
**Branch:** `feat/phase-1-foundation` (continuing)
**Goal:** Close the last spec phase by (a) running a full WCAG 2.1 AA sweep with `@axe-core/playwright` over the 7 user-facing routes, fixing any new findings, and (b) deploying the Worker to Cloudflare Pages/Workers. Both are gating for production.
**Status:** Tarea 5.1 CLOSED (`8f06369`, 14/14 axe specs green). Tarea 5.2 OPEN — unrun; see the UNRESOLVED deploy note in `odd/tasks/opensim.md` §8 and `odd/README.md`.

---

## Context (continuation of `phase-5-prep`)

- Phase 5 prep closed 10 non-blocking mcode M3.1 round-6 findings (commits `59ef4f7`–`bf1a1ef`).
- Branch `feat/phase-1-foundation` at 45 commits, working tree clean.
- Stack already includes `@playwright/test 1.63.0` and `@axe-core/playwright 4.13.0` in `package.json` — never wired up. No `playwright.config.*` and no `tests/e2e/` exist yet.
- Native RDD: `gentle-ai 4.0.0` is installed at `<HOME>/.local/bin/gentle-ai`. The user requested **mcode (M3.1-Flash-Preview, max tokens) as the RDD reviewer regardless** because mcode is a fresh agent without creation context — no authorship bias.

---

## Tarea 5.1 — WCAG 2.1 AA audit with `@axe-core/playwright`

> **Evidence for the checked boxes below (bookkeeping sync 2026-10-06):** the whole of 5.1.1–5.1.8 is covered by canonical spec record `odd/tasks/opensim.md:418` — **Task 5.1 = `[x]`, `8f06369`**, "14/14 specs verde (7 rutas × 2 temas de color)", findings N9–N11 and N12–N19 + N21–N22 closed, methodology and routes in `docs/a11y-audit.md`. Per-box anchors: `docs/a11y-audit.md` → 5.1.7 (methodology doc) and 5.1.8 (spec close); `odd/tasks/opensim.md:418` → 5.1.4 (14/14 run + `axe-findings.json` + triage of 3 documented follow-ups N18/N20/N23); `odd/tasks/phase-5-mcode-reviews/5.1-round-7.md` → 5.1.6 (round-7 review captured). Per-work-unit SHAs for 5.1.1–5.1.6 were not recorded individually — only the closing SHA `8f06369` — so those ticks rest on the single Task 5.1 record, not on one SHA per box.

### 5.1.1 — Playwright wiring
- [x] Run `pnpm exec playwright install chromium --with-deps` (background while tests are drafted).
- [x] Create `playwright.config.ts` with `baseURL: 'http://localhost:5173'`, `webServer: { command: 'pnpm dev', port: 5173, reuseExistingServer: !process.env.CI, timeout: 120_000 }`, `use: { headless: true, trace: 'on-first-retry' }`, `projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }]`.
- [x] Conventional Commit: `chore(test): wire playwright + axe-core test runner (work-unit)`.

### 5.1.2 — Auth fixture
- [x] Create `tests/e2e/setup/auth.setup.ts` that POSTs to `/login` with `controlNumber=<NUMERO DE CONTROL PURGADO>, password=opensim-dev-2026` and saves the resulting cookies to `playwright/.auth/storage.json`.
- [x] Wire `storageState: 'playwright/.auth/storage.json'` in the project config so every spec reuses the session.
- [x] `tests/e2e/setup/global-setup.ts` runs `just db-reset && just db-set-password` before the suite (best-effort; document if blocked by env).
- [x] Conventional Commit: `test(e2e): auth fixture + storage state for the 7 protected routes (work-unit)`.

### 5.1.3 — Per-route axe scans
- [x] `tests/e2e/axe/login.spec.ts` — scan `/login`.
- [x] `tests/e2e/axe/dashboard.spec.ts` — scan `/dashboard`.
- [x] `tests/e2e/axe/horario.spec.ts` — scan `/horario`.
- [x] `tests/e2e/axe/reticula.spec.ts` — scan `/reticula` (and the deep-link variant `/reticula#calculo-diferencial`).
- [x] `tests/e2e/axe/kardex.spec.ts` — scan `/academico/kardex` (and the filter-applied variant).
- [x] `tests/e2e/axe/reinscripcion.spec.ts` — scan `/reinscripcion` (and the modal-open variant).
- [x] `tests/e2e/axe/tramites.spec.ts` — scan `/tramites`.
- [x] Each spec uses ` AxeBuilder` from `@axe-core/playwright` with `withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])`. Fail on `serious` and `critical` violations; log `moderate` and `minor` as warnings.
- [x] Conventional Commit: `test(e2e): axe-core WCAG 2.1 AA scans for 7 user-facing routes (work-unit)`.

### 5.1.4 — Run + capture findings
- [x] `pnpm exec playwright test --reporter=list` and capture results.
- [x] Save violations report to `tests/e2e/reports/axe-findings.json`.
- [x] If any new findings surface (i.e. not in the round-6 mcode M3.1 backlog), triage into "fix-now" (serious/critical) vs "documented non-blocking" (moderate/minor with a known ceiling).
- [x] Conventional Commit: `test(e2e): baseline axe-core findings + 0-violations threshold`.

### 5.1.5 — Fix-now findings
- [x] For each fix-now finding, address in the affected component and re-run the spec. One work-unit commit per fix (or batch small ones) per `work-unit-commits` skill.
- [x] Re-run full suite to confirm green.
- [x] Conventional Commit per fix: `fix(a11y): <one-line finding summary>`.

### 5.1.6 — External review with mcode
- [x] For each fix-now commit (and the final baseline commit), pipe the diff into mcode as a fresh-agent reviewer:
  ```bash
  git show <sha> | mmx text chat \
    --model MiniMax-M3.1-Flash-Preview \
    --max-tokens 8192 \
    --system "You are a fresh WCAG 2.1 AA reviewer. You have no authorship context. Return only a numbered list of findings; cite exact file:line; mark each Critical / Serious / Moderate / Minor." \
    --message "user:Review the following diff. Flag WCAG 2.1 AA violations, contrast issues, missing ARIA, focus traps, and any a11y regressions. Be terse.\n\n\$(cat diff)"
  ```
- [x] Capture mcode output in `odd/tasks/phase-5-mcode-reviews/<sha>.md`.
- [x] Address any Critical/Serious findings mcode flags; document Moderate/Minor.

### 5.1.7 — Recipe + docs
- [x] Add `just test-e2e` recipe: `db-reset && db-set-password && playwright test`.
- [x] Add a short `docs/a11y-audit.md` summarising the methodology, the routes scanned, and the violation counts per severity.
- [x] Conventional Commit: `chore(test): e2e recipe + a11y audit doc (work-unit)`.

### 5.1.8 — Spec close
- [x] Mark Tarea 5.1 in `odd/tasks/opensim.md` §8 as `[x]` with the audit date and a one-line link to `docs/a11y-audit.md`.
- [x] Conventional Commit: `docs(spec): close Tarea 5.1 in §8 (work-unit)`.

---

## Tarea 5.2 — Cloudflare Pages/Workers deploy

### 5.2.1 — `wrangler.jsonc` audit
- [ ] Re-read `wrangler.jsonc`; confirm `name`, `compatibility_date` (2026-10-01), `compatibility_flags: ["nodejs_compat"]`, `d1_databases.binding: "DB"`.
- [x] Confirm `d1_databases.database_id` is a stable UUID. **Verified 2026-10-06: the real
      ID is already in `wrangler.jsonc`** (`390df78e-…`, `database_name: "opensim"`,
      `migrations_dir: "drizzle"`). No `wrangler d1 create` step exists or is needed.

### 5.2.2 — Production D1: INSPECT state, then apply only what is pending

> **Corrected 2026-10-06.** The previous version of this block was written against a
> hypothetical `opensim-production` database that does not exist, and called a
> `db-set-password-production` recipe that was never created. The real database is
> `opensim`, it already exists, and the operator has already run `just db-migrate-remote`
> at least once. D1 tracks applied migrations in `d1_migrations`, so `apply` is
> idempotent — but inspect before applying rather than re-applying blind.

- [ ] Inspect applied state (user-owned credential; read-only remote call):
      `wrangler d1 migrations list opensim --remote`
- [ ] If `0005_uneven_whizzer` (or any later) is pending → `just db-migrate-remote`
      (runs `wrangler d1 migrations apply opensim --remote`). Six migrations exist:
      `0000`–`0005`.
- [ ] Verify the catalog is seeded: `just db-seed-remote`
      (runs `wrangler d1 execute opensim --remote --file=./src/lib/server/db/seed.sql` —
      catalog only, no test-student credential).
- [ ] **UNRESOLVED — no remote-capable password recipe exists.** `just db-set-password`
      targets local state only; there is no `db-set-password-production`. Decide how the
      production test-student credential gets its PBKDF2 hash into D1 before deploy, or
      ship with no login-capable account and set it as a follow-up.

### 5.2.3 — Deploy (Workers + Assets, NOT Pages)
- [ ] `just deploy-worker` (runs `pnpm build && wrangler deploy`). Target is Workers with
      the `ASSETS` binding per `wrangler.jsonc` — **not** `wrangler pages deploy`.
      `preview_urls: false` is already set, so no public preview URL is published.
- [ ] Capture the deployed URL and the deployment ID; add to the feature doc.

### 5.2.4 — Smoke
- [ ] Curl `/` (200), `/login` (200), POST `/login` with test creds, then GET `/dashboard` (200 + body length > 0).
- [ ] axe-core probe against the deployed URL (one more mcode round) — production parity.

### 5.2.5 — Spec close
- [ ] Mark Tarea 5.2 in `odd/tasks/opensim.md` §8 as `[x]` with the deployed URL and date.

---

## Verification (run before close)

- `just check` 0/0.
- `just test` (Vitest 115/115 still green).
- `just test-e2e` (Playwright + axe 7/7 routes green or only documented non-blocking findings).
- mcode review pass captured.
- Production URL responds with 200 on every user-facing route.
- Bundle + DB metrics recorded.

## Non-goals (explicit)

- Lighthouse / Core Web Vitals scoring (separate effort; CF-4 budgets are already satisfied per the v1.1 baseline).
- i18n (Spanish-only; AG-16 deferred).
- Multi-user roles (AG-15 deferred).
- Custom domain (CF Pages default; user wires apex later).
- Persistent backups for D1 (Cloudflare handles; document restore command).

## Evidence (filled in at close)

- Commit list per task.
- mcode review outputs.
- axe findings JSON.
- Production URL + smoke test output.

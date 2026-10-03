# OpenSIM — Drizzle ORM + Cloudflare D1: Migrations and Data

**Audience:** anyone touching `src/lib/server/db/schema.ts` or running a local D1.
**Last verified:** 2026-10-02.

---

## The rule (one sentence)

`wrangler d1 execute --file` is for **data only**. DDL — every `CREATE TABLE`, every `ALTER TABLE`, every index — always goes through the migration runner.

If you find yourself reaching for `d1 execute --file` to add a column or a table, stop: edit the schema and generate a migration.

---

## The canonical flow

Every schema change follows the same five steps, locally and remotely.

### 1. Edit the schema

`src/lib/server/db/schema.ts` is the single source of truth. Drizzle reads it; wrangler applies the SQL it generates. No raw DDL anywhere else in the repo.

### 2. Generate the migration

```bash
just db-generate    # pnpm run db:generate → drizzle-kit generate
```

This runs the `drizzle-kit` codegen against the schema. The output is a single new SQL file in `drizzle/`, e.g. `drizzle/0002_audit_fixes.sql`, plus an updated `drizzle/meta/_journal.json`. The file is the artifact that the migration runner consumes; commit it.

`drizzle-kit generate` does **not** touch the database. It is pure codegen.

### 3. Apply the migration to local D1

```bash
just db-migrate     # pnpm run db:migrate:apply → wrangler d1 migrations apply opensim --local
```

wrangler reads the new `drizzle/00xx_*.sql` file, runs it inside a transaction, and records the application in the `d1_migrations` bookkeeping table. If you have multiple pending files, wrangler applies them in order in a single run.

The local D1 is Miniflare state at `.wrangler/state/v3/d1`; treat it as disposable.

### 4. Apply the seed (data only)

```bash
just db-seed        # pnpm run db:seed → tsx src/lib/server/db/seed.ts && wrangler d1 execute --local --file=./src/lib/server/db/seed.sql
```

The seed script reads the curriculum JSON and emits `src/lib/server/db/seed.sql` with `INSERT OR IGNORE` batches for `careers`, `specialties`, `subjects`, `subject_aliases`, and `subject_prerequisites`. The file is then applied through `wrangler d1 execute --file` — the only place in the project where `--file` is the right tool, because every line is an `INSERT`.

`seed.sql` does **not** touch `student_profiles`, `student_credentials`, or `auth_sessions`. Auth provisioning is a separate step (see below).

### 5. Apply the same migration to remote D1 (when shipping)

```bash
just db-migrate-remote   # wrangler d1 migrations apply opensim --remote
```

Same runner, different binding. The `d1_migrations` table on the remote D1 starts empty, so wrangler applies every committed migration in order. Run this only after the migration has been verified locally.

---

## Why two ledgers exist (and which one we use)

There are two competing bookkeeping tables for SQL migrations, and the project uses only one.

| Runner | Bookkeeping table | Schema |
|---|---|---|
| `wrangler d1 migrations apply` | `d1_migrations` | `(id, name, applied_at)` |
| `drizzle-kit migrate` | `__drizzle_migrations` | Drizzle-defined shape |

`package.json` exposes both runners:

- `pnpm run db:migrate:apply` → **wrangler** (this is the canonical path)
- `pnpm run db:migrate` → **drizzle-kit migrate** (dead code in this project)

`drizzle-kit migrate` is a dead end on this project for two reasons:

1. Its `__drizzle_migrations` table is empty after a `wrangler d1 migrations apply` run, so any future `drizzle-kit migrate` invocation would re-apply the earliest migration and crash on duplicate table errors.
2. `drizzle.config.ts` carries placeholder credentials (`accountId: '00000000…'`, `token: 'placeholder'`); the drizzle-kit HTTP driver cannot reach Cloudflare even if you wanted it to.

**Rule of thumb:** if you see `drizzle-kit migrate` in a doc, in a recipe, or in a script, treat it as a leftover from before the project settled on wrangler and replace it with the wrangler path.

---

## Local vs production

The migration runner is the same on both sides; only the binding flag changes.

| Target | Command |
|---|---|
| Local (Miniflare) | `wrangler d1 migrations apply opensim --local` |
| Remote (Cloudflare D1) | `wrangler d1 migrations apply opensim --remote` |

The migration files in `drizzle/` are identical. The local state under `.wrangler/state/v3/d1` is throwaway. The remote state is durable; do not run destructive operations against it from a developer machine.

---

## Recovery: `just db-reset`

When local D1 drifts (e.g. someone hand-applied a DDL with `d1 execute --file` and now `wrangler d1 migrations apply` crashes on a `table already exists` error), nuke the local state and reapply from scratch:

```bash
just db-reset
```

The recipe:

1. Removes `.wrangler/state/v3/d1` (local Miniflare D1 state).
2. Reapplies every committed migration through `wrangler d1 migrations apply --local`.
3. Reapplies the curriculum seed via `wrangler d1 execute --local --file=./seed.sql`.

**Important:** `db-reset` does **not** re-seed the test student password. After a reset, run:

```bash
pnpm run db:set-password
```

to restore the default test credential (`<NUMERO DE CONTROL PURGADO>` / `opensim-dev-2026`). Without this step, the login flow will fail with "Número de control o contraseña incorrectos" — not because the auth is broken, but because the credential row is gone.

`db-reset` is a **recovery action**, not a workflow. The workflow is `db-generate` → `db-migrate` → `db-seed`. Reach for `db-reset` only when local D1 has drifted beyond what the canonical flow can repair.

---

## Common mistakes

### Using `d1 execute --file` for DDL

```bash
# WRONG — applies a CREATE TABLE through the data path; bypasses d1_migrations.
wrangler d1 execute opensim --local --file=./my-new-table.sql

# RIGHT — generate a migration from the schema, then apply through the runner.
just db-generate
just db-migrate
```

### Running `drizzle-kit migrate` against D1

```bash
# WRONG — uses the wrong bookkeeping table; will replay old migrations and crash.
pnpm run db:migrate

# RIGHT — wrangler's runner, every time.
just db-migrate
just db-migrate-remote
```

### Hand-editing a generated migration after it has been applied

Once wrangler has recorded a migration in `d1_migrations`, the file is effectively immutable. If you need to change it, either:

- Add a new migration that performs the correction (`ALTER TABLE …`), or
- Run `just db-reset` to clear local state and reapply from scratch.

Do not rewrite a committed `drizzle/00xx_*.sql` file just to make it apply cleanly — the file name is the identity wrangler recorded.

### Mixing concerns in `seed.sql`

`src/lib/server/db/seed.sql` contains only the academic catalog (42 subjects, prerequisites, aliases, careers, specialties). It must not contain auth rows: provisioning credentials and sessions is a separate, gated operation via `pnpm run db:set-password`.

---

## Related references

- Drizzle migrations: <https://orm.drizzle.team/docs/migrations>
- Cloudflare D1: <https://developers.cloudflare.com/d1/>
- Drizzle + D1 adapter: `drizzle-orm/d1` (used in `src/lib/server/db/index.ts`)
- OpenSIM justfile recipes: see `justfile` (`db-generate`, `db-migrate`, `db-migrate-remote`, `db-seed`, `db-reset`, `db-set-password`)

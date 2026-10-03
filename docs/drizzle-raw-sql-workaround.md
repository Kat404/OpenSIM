# Drizzle ORM + D1: Local Seed vs Migration Workaround

**Status:** Documented limitation. Affects local development only.
**Discovered:** Phase 2, after schema extension to 12 tables.
**Last verified:** 2026-10-02.

---

## Problem

The local Cloudflare D1 instance (via `wrangler dev` / Miniflare) was originally seeded using raw SQL:

```bash
wrangler d1 execute opensim --local --file=./src/lib/server/db/seed.sql
```

This bypasses Drizzle's migration tracking table. When new tables are added in a subsequent schema change and `pnpm drizzle-kit migrate` is run, the migration runner attempts to re-apply migration `0000_*.sql` (which creates the original 10 tables) and crashes with:

```
D1_ERROR: table 'careers' already exists
```

Drizzle does not know that the schema is "already there" because no bookkeeping row was inserted in its `__drizzle_migrations` table.

---

## Current workaround (local dev)

For incremental schema additions in local development, apply only the new migration file directly:

```bash
wrangler d1 execute opensim --local --file=./drizzle/0001_many_human_fly.sql
```

This adds the new tables (`student_credentials`, `auth_sessions`) without touching the existing 10. It does, however, also leave the Drizzle bookkeeping table empty — every new migration would hit the same issue.

---

## Production deploy path

A fresh production D1 will run migrations through the Drizzle runner:

```bash
wrangler d1 migrations apply opensim --remote
```

The `drizzle-kit generate` output produces a sequential list of SQL files; the runner applies them in order, recording each in the bookkeeping table. The first deploy is clean.

The local-vs-production divergence is acceptable because:
- Local D1 is throwaway (delete `.wrangler/state/v3/d1` to reset).
- Production D1 starts empty and uses the migration runner exclusively.
- The seed data is academic catalog, not user state.

---

## Long-term fixes (not yet implemented)

Option A: **Reset local D1 to a clean state** before every migration. Add a `just db-reset-migrate` recipe that:

```bash
rm -rf .wrangler/state/v3/d1
wrangler d1 migrations apply opensim --local --file=./drizzle/0000_tough_scalphunter.sql
wrangler d1 migrations apply opensim --local --file=./drizzle/0001_many_human_fly.sql
pnpm run db:seed:apply
```

This is honest about the local state and matches production. Recommended before Phase 3 adds more tables.

Option B: **Generate migrations idempotent**: write `CREATE TABLE IF NOT EXISTS` in the migration SQL. Drizzle does not generate this style by default; it would require a custom migration generator. Not recommended — masks real schema drift.

Option C: **Use a `pnpm db:reset` recipe** that always nukes local D1, runs the full migration list, and re-seeds. Mirrors production. Already mentioned in the justfile as `db-reset`; just needs to be the default for incremental local work.

---

## Recommendation

Before Phase 3 starts adding more tables (Layout, Dashboard, ReticulaDag, etc.), run:

```bash
just db-reset
```

This:
1. Removes local D1 state.
2. Re-applies all migrations in order.
3. Re-seeds the 42-subject curriculum.
4. Re-seeds the default test student + password (`<NUMERO DE CONTROL PURGADO>` / `opensim-dev-2026`).

After this one-time reset, the local D1 will be in the same state the Drizzle migration runner expects, and `pnpm drizzle-kit migrate` will work for future schema additions.

---

## Related references

- Drizzle migrations documentation: <https://orm.drizzle.team/docs/migrations>
- Cloudflare D1 documentation: <https://developers.cloudflare.com/d1/>
- Drizzle + D1 adapter: `drizzle-orm/d1` (already in use via the existing schema imports)
- OpenSIM justfile `db-reset` recipe: see `<HOME>/Proyectos/OpenSIM/justfile`

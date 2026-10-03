/**
 * OpenSIM — Drizzle ORM client factory.
 *
 * Single source of truth for constructing a typed Drizzle client bound
 * to the worker's D1 binding. Every server-side module (auth.ts,
 * loaders, actions) must go through `getDb(env.DB)` rather than calling
 * `drizzle(...)` directly, so the schema reference stays consistent.
 *
 * The factory takes the binding as a parameter (rather than reading it
 * from a global) to keep the function pure and trivially testable from
 * Vitest: pass any `D1Database`-shaped mock in.
 */

import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Database = DrizzleD1Database<typeof schema>;

export function getDb(d1: D1Database): Database {
	return drizzle(d1, { schema });
}

export { schema };

import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config — Cloudflare D1 (SQLite at edge).
 *
 * Migrations are emitted as SQL (not TypeScript) so they can be applied by
 * `wrangler d1 migrations apply` against the local Miniflare D1 and the
 * remote D1 instance.
 *
 * See: https://orm.drizzle.team/docs/drizzle-config-file
 */
export default defineConfig({
	schema: "./src/lib/server/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	driver: "d1-http",
	dbCredentials: {
		// These placeholders are required by drizzle-kit but unused at generation
		// time. Migration application uses wrangler.toml's D1 binding.
		accountId: process.env.CF_ACCOUNT_ID ?? "00000000000000000000000000000000",
		databaseId: process.env.CF_DATABASE_ID ?? "00000000-0000-0000-0000-000000000000",
		token: process.env.CF_D1_TOKEN ?? "placeholder",
	},
	verbose: true,
	strict: true,
});

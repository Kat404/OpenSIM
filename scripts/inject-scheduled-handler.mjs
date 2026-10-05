#!/usr/bin/env node
/**
 * OpenSIM — Post-build scheduled-handler injector.
 *
 * `@sveltejs/adapter-cloudflare` 8 emits `_worker.js` with only a
 * `fetch` handler on the default export. To run a Cloudflare cron
 * trigger (P0-4 / audit R8-8), the worker also needs a `scheduled`
 * method on that export.
 *
 * This script reads `_worker.js`, locates the default export's object
 * literal, and inserts a `scheduled(event, env, ctx)` method that
 * performs the bulk prune via raw SQL. The two DELETEs mirror
 * `pruneExpiredSessions` and `pruneExpiredAttempts` in
 * `src/lib/server/auth.ts`; the inline form is intentional — it
 * keeps the patch self-contained (no extra ES module to bundle and
 * resolve inside the worker entry) and the SQL is short enough that
 * duplicating it is cheaper than wiring a second import path.
 *
 * ponytail: the alternative is the `@oselvar/sveltekit-add-worker-exports`
 * Vite plugin, but it's a new npm dependency and the Hard Rules
 * forbid that. ~80 lines of text substitution beat a transitive
 * upgrade chain for a one-method patch.
 *
 * Idempotent: a marker comment lets re-runs no-op without producing
 * duplicate `scheduled` methods.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const WORKER_PATH = ".svelte-kit/cloudflare/_worker.js";

if (!existsSync(WORKER_PATH)) {
	console.error(`[inject-scheduled] ${WORKER_PATH} not found — was vite build skipped?`);
	process.exit(1);
}

const src = readFileSync(WORKER_PATH, "utf8");

const MARKER = "/* injected-by:scripts/inject-scheduled-handler.mjs */";
if (src.includes(MARKER)) {
	console.log("[inject-scheduled] worker already patched — skipping (idempotent).");
	process.exit(0);
}

// Inline body: keep in sync with `pruneExpiredSessions` and
// `pruneExpiredAttempts` in src/lib/server/auth.ts. Any schema change
// to either table MUST be reflected here too.
const SCHEDULED_BODY = `	async scheduled(event, env, _ctx) {
		if (!env.DB) return;
		const now = Math.floor(Date.now() / 1000);
		try {
			await env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').bind(now).run();
			await env.DB.prepare('DELETE FROM auth_attempts WHERE window_start < ?').bind(now - 900).run();
		} catch (err) {
			console.error('[scheduled] prune failed:', err);
		}
	},`;

const lines = src.split("\n");
const exportIdx = lines.findIndex((l) => /^export default \{/.test(l));
if (exportIdx === -1) {
	console.error(
		"[inject-scheduled] could not find `export default {` in " +
			WORKER_PATH +
			" — adapter output shape changed?",
	);
	process.exit(1);
}

let closeIdx = -1;
for (let i = exportIdx + 1; i < lines.length; i++) {
	if (lines[i].trim() === "};") {
		closeIdx = i;
		break;
	}
}
if (closeIdx === -1) {
	console.error("[inject-scheduled] could not find closing `};` for default export");
	process.exit(1);
}

lines.splice(closeIdx, 0, MARKER, SCHEDULED_BODY);
writeFileSync(WORKER_PATH, lines.join("\n"));
console.log(
	`[inject-scheduled] patched ${WORKER_PATH} — scheduled handler added to default export.`,
);

/**
 * OpenSIM — The cron prune statements, as they ship (Phase 12 T13.3).
 *
 * The `scheduled` handler is not in `src/`: a build step injects it
 * into the bundled worker, because SvelteKit owns the worker's default
 * export. That made the prune SQL a string inside a build script —
 * unreachable from the app, and previously duplicated in
 * `src/lib/server/auth.ts` with a comment asking the two copies to be
 * kept in sync.
 *
 * The duplication is gone: the injected statements are now the only
 * implementation. This test executes THAT string against a real
 * database, because the alternative is a prune nobody can test.
 *
 * The statements are read out of the script rather than copied here on
 * purpose: a copy would be the second implementation this finding
 * asked to delete.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	clearWorkerEnv,
	seedCareer,
	seedProfile,
	type TestDb,
	withTestDb,
} from "./_helpers/harness";

const SCRIPT_PATH = "scripts/inject-scheduled-handler.mjs";
const script = readFileSync(SCRIPT_PATH, "utf8");

/** The DELETE statements exactly as the injected handler runs them. */
const SESSION_SQL = /prepare\('(DELETE FROM auth_sessions[^']+)'\)/.exec(script)?.[1];
const ATTEMPT_SQL = /prepare\('(DELETE FROM auth_attempts[^']+)'\)/.exec(script)?.[1];

let db: TestDb;
let raw: ReturnType<typeof withTestDb>["raw"];

function rowCount(table: string): number {
	return (raw.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
}

beforeEach(() => {
	({ db, raw } = withTestDb());
	seedCareer(raw);
	seedProfile(raw, { controlNumber: "12345678", fullName: "Ada Lovelace Ortiz" });
});

afterEach(() => {
	raw.close();
	clearWorkerEnv();
});

describe("the injected cron prune", () => {
	it("ships both statements", () => {
		// If the script's shape changes, the extraction below stops
		// finding the statements — and this test says so instead of
		// silently passing on an empty match.
		expect(SESSION_SQL).toBe("DELETE FROM auth_sessions WHERE expires_at < ?");
		expect(ATTEMPT_SQL).toBe("DELETE FROM auth_attempts WHERE window_start < ?");
	});

	it("deletes the expired sessions and keeps the live ones", () => {
		const now = Math.floor(Date.now() / 1000);
		raw
			.prepare(
				"INSERT INTO auth_sessions (id, student_control_number, expires_at, created_at) VALUES (?, ?, ?, ?)",
			)
			.run("expired", "12345678", now - 60, now - 3600);
		raw
			.prepare(
				"INSERT INTO auth_sessions (id, student_control_number, expires_at, created_at) VALUES (?, ?, ?, ?)",
			)
			.run("live", "12345678", now + 3600, now);
		expect(rowCount("auth_sessions")).toBe(2);

		raw.prepare(SESSION_SQL as string).run(now);

		expect(rowCount("auth_sessions")).toBe(1);
		const remaining = raw.prepare("SELECT id FROM auth_sessions").get() as { id: string };
		expect(remaining.id).toBe("live");
	});

	it("deletes the rate-limit buckets outside the 15-minute window", () => {
		const now = Math.floor(Date.now() / 1000);
		// One second outside the window, one second inside it.
		raw
			.prepare(
				"INSERT INTO auth_attempts (attempt_key, window_start, attempt_count) VALUES (?, ?, ?)",
			)
			.run("control:12345678", now - 901, 3);
		raw
			.prepare(
				"INSERT INTO auth_attempts (attempt_key, window_start, attempt_count) VALUES (?, ?, ?)",
			)
			.run("control:87654321", now - 899, 1);
		expect(rowCount("auth_attempts")).toBe(2);

		raw.prepare(ATTEMPT_SQL as string).run(now - 900);

		expect(rowCount("auth_attempts")).toBe(1);
		const remaining = raw.prepare("SELECT attempt_key FROM auth_attempts").get() as {
			attempt_key: string;
		};
		expect(remaining.attempt_key).toBe("control:87654321");
	});
});

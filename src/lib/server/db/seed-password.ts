#!/usr/bin/env node

/**
 * OpenSIM — Test password seeder.
 *
 * Idempotent CLI that:
 *   1. Computes a PBKDF2-HMAC-SHA-256 hash of the configured password
 *      using the same parameters as src/lib/server/auth.ts (10,000
 *      iterations, 16-byte salt, 32-byte derived key).
 *   2. Ensures the test student_profile row exists (INSERT OR IGNORE).
 *   3. Upserts the credential row (INSERT OR REPLACE).
 *   4. Pipes the generated SQL into `wrangler d1 execute --local`.
 *
 * Usage:
 *   pnpm run db:set-password                 # uses defaults (local D1)
 *   pnpm run db:set-password 12345678        # custom control number
 *   OPENSIM_TEST_PASSWORD=foo pnpm run db:set-password
 *
 * The password is resolved as: positional argument → OPENSIM_TEST_PASSWORD
 * → the value in `.env` → the documented default. The `.env` step is what
 * keeps the seeder and the Playwright setup (which reads `.env` too) from
 * disagreeing about the password.
 *   just db-set-password-remote              # REMOTE D1 (⚠ production)
 *
 * Remote targeting is env-driven (`OPENSIM_D1_TARGET=remote`), not a
 * positional flag: the positional args are control number, password, name
 * and curp, so a `--remote` in args[0] would be parsed as the control
 * number. Remote mode REFUSES the default password — set
 * OPENSIM_TEST_PASSWORD explicitly.
 *
 * DEFAULT CREDENTIALS — DO NOT USE IN PRODUCTION:
 *   control_number: 12345678
 *   password:       opensim-dev-2026
 *
 * The defaults are documented in odd/tasks/opensim.md (Tarea 2.5) so a
 * developer can clone the repo, run `pnpm install`, and log in
 * immediately against the local D1. They are intentionally weak.
 *
 * Hashing is done with `node:crypto.pbkdf2Sync` so this script does
 * not require the Workers runtime. PBKDF2 is interoperable across
 * `node:crypto` and `crypto.subtle` — the bytes produced for the same
 * (password, salt, iterations) inputs are identical.
 */

import { execSync } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SEED_SQL_PATH = resolve(here, "seed-password.sql");

const PBKDF2_ITERATIONS = 10_000;
const SALT_BYTES = 16;
// node:crypto.pbkdf2Sync's `keylen` is in BYTES (unlike Web Crypto's
// `crypto.subtle.deriveBits` which takes bits). 32 bytes matches the
// 256-bit derived key produced by src/lib/server/auth.ts.
const DERIVED_KEY_BYTES = 32;

/**
 * The credential's own control number — deliberately NOT the catalog
 * student's `12345678`.
 *
 * Two independent reasons, both worth keeping:
 *
 * 1. `seed.sql` never writes control number `99999999`, and the
 *    profile write it does emit is an upsert, so no DELETE — and
 *    therefore no `ON DELETE CASCADE` from `student_profiles` down to
 *    `student_credentials` — can reach this row. (This used to be a
 *    hard requirement: the seed wrote profiles with `INSERT OR
 *    REPLACE`, which SQLite runs as a delete plus an insert, so a
 *    profile replace wiped the credential and the next login timed out
 *    waiting for a redirect. `seed.ts` now upserts with
 *    `ON CONFLICT(control_number) DO UPDATE`.)
 *
 *    This credential DOES own a `student_profiles` row — the `INSERT
 *    OR IGNORE` in `buildSql` below creates it on first run. What the
 *    catalog seed does not do is name this control number, so its
 *    upsert never touches the row this credential hangs off.
 * 2. One login, one role: the pages render the catalog student's data,
 *    and provisioning a second credential for the catalog student
 *    itself would let a test sign in with a profile it does not own.
 */
const DEFAULT_CONTROL_NUMBER = "99999999";
const DEFAULT_PASSWORD = "opensim-dev-2026";
const DEFAULT_CAREER_CODE = "ISIC-2010-224";
const DEFAULT_FULL_NAME = "Estudiante de Prueba OpenSIM";
const DEFAULT_CURP = "OPNS000101HDFRRA09";
const DEFAULT_BIRTH_STATE = "Michoacán";

function sqlStr(v: string): string {
	return `'${v.replace(/'/g, "''")}'`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	// base64url is the URL-safe variant of base64 (RFC 4648 §5):
	// '+' -> '-', '/' -> '_', no '=' padding. Implemented inline
	// to avoid depending on Buffer's overloaded toString() across
	// different @types/node and Workers type bundles.
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i] ?? 0);
	}
	// Standard base64 alphabet. The 'binary' encoding is the
	// historical Node-only term; we treat the string as raw bytes.
	const b64 = Buffer.from(binary, "latin1").toString("base64");
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hashPassword(password: string): { hash: string; salt: string } {
	const salt = randomBytes(SALT_BYTES);
	const derived = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, DERIVED_KEY_BYTES, "sha256");
	return {
		hash: bytesToBase64Url(new Uint8Array(derived.buffer, derived.byteOffset, derived.byteLength)),
		salt: bytesToBase64Url(new Uint8Array(salt.buffer, salt.byteOffset, salt.byteLength)),
	};
}

function buildSql(controlNumber: string, password: string, fullName: string, curp: string): string {
	const { hash, salt } = hashPassword(password);
	const now = Math.floor(Date.now() / 1000);

	const lines = [
		"-- OpenSIM test password seed (auto-generated by src/lib/server/db/seed-password.ts).",
		"-- DO NOT USE THESE CREDENTIALS IN PRODUCTION.",
		"--> statement-breakpoint",
		"-- Ensure the test student profile exists.",
		`INSERT OR IGNORE INTO student_profiles (control_number, full_name, curp, birth_state, career_code, current_semester, approved_credits, remaining_credits, completed_credits, in_progress_credits, status, health_service, enrollment_period) VALUES (${sqlStr(controlNumber)}, ${sqlStr(fullName)}, ${sqlStr(curp)}, ${sqlStr(DEFAULT_BIRTH_STATE)}, ${sqlStr(DEFAULT_CAREER_CODE)}, 1, 0, 260, 0, 0, 'Activo regular', 'IMSS', '');`,
		"--> statement-breakpoint",
		"-- Upsert the credential row with a freshly generated salt + hash.",
		`INSERT OR REPLACE INTO student_credentials (control_number, password_hash, password_salt, password_iterations, password_updated_at) VALUES (${sqlStr(controlNumber)}, ${sqlStr(hash)}, ${sqlStr(salt)}, ${PBKDF2_ITERATIONS}, ${now});`,
		"--> statement-breakpoint",
		"-- verification (informational)",
		`SELECT control_number, password_iterations, length(password_hash) AS hash_len, length(password_salt) AS salt_len FROM student_credentials WHERE control_number = ${sqlStr(controlNumber)};`,
		"",
	];
	return lines.join("\n");
}

function main(): void {
	const args = process.argv.slice(2);
	// Env-driven, not a positional flag — see the usage note in the header.
	const REMOTE = process.env.OPENSIM_D1_TARGET === "remote";
	// The `.env` file is the source of truth for the local test password,
	// and the Playwright setup reads it the same way
	// (`tests/e2e/setup/auth.setup.ts`). Without this line the two
	// disagree: the seeder falls back to the default password while the
	// suite signs in with the one in `.env`, and the login bounces back
	// to `/login` — which reads like broken auth and is not. Guarded so an
	// explicit env var still wins, and so a clone without `.env` does not
	// throw.
	if (process.env.OPENSIM_TEST_PASSWORD === undefined && existsSync(".env")) {
		process.loadEnvFile(".env");
	}
	const controlNumber =
		args[0] ?? process.env.OPENSIM_TEST_CONTROL_NUMBER ?? DEFAULT_CONTROL_NUMBER;
	const password = args[1] ?? process.env.OPENSIM_TEST_PASSWORD ?? DEFAULT_PASSWORD;
	const fullName = args[2] ?? process.env.OPENSIM_TEST_FULL_NAME ?? DEFAULT_FULL_NAME;
	const curp = args[3] ?? process.env.OPENSIM_TEST_CURP ?? DEFAULT_CURP;

	if (!/^\d{8}$/.test(controlNumber)) {
		throw new Error(`Control number must be 8 digits, got: ${controlNumber}`);
	}
	if (password.length < 1) {
		throw new Error("Password must be non-empty");
	}

	// The default credential is documented as DO NOT USE IN PRODUCTION.
	// Refuse it on the remote target rather than trusting the operator to
	// remember: a weak dev password reaching D1 is exactly the failure this
	// gate exists to prevent.
	if (REMOTE && args[1] === undefined && !process.env.OPENSIM_TEST_PASSWORD) {
		throw new Error(
			"Remote mode requires an explicit password. Set OPENSIM_TEST_PASSWORD (the " +
				`default "${DEFAULT_PASSWORD}" is refused on --remote).`,
		);
	}

	const sql = buildSql(controlNumber, password, fullName, curp);
	mkdirSync(dirname(SEED_SQL_PATH), { recursive: true });
	writeFileSync(SEED_SQL_PATH, sql, "utf8");
	console.log(`Generated ${SEED_SQL_PATH}`);
	console.log(`Control number: ${controlNumber}`);
	console.log(`Password:        ${"*".repeat(password.length)} (not echoed)`);

	// Apply via wrangler to the local or remote D1 instance.
	const target = REMOTE ? "--remote" : "--local";
	const cmd = `pnpm exec wrangler d1 execute opensim ${target} --file=${SEED_SQL_PATH}`;
	console.log(`Applying via: ${cmd}`);
	if (REMOTE) console.warn("⚠  REMOTE (production) D1 target.");
	execSync(cmd, { stdio: "inherit", cwd: resolve(here, "../../..") });
	console.log("Done.");
}

main();

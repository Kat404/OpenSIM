/**
 * OpenSIM — Shared harness for the request-layer unit tests (Phase 11).
 *
 * Two problems every `+server.ts` / `+page.server.ts` test has to solve,
 * solved once here:
 *
 * 1. `import { env } from "cloudflare:workers"`. The adapter resolves that
 *    specifier to a virtual module backed by
 *    `globalThis.__sveltekit_cloudflare_platform`, a runtime-only binding
 *    that does not exist under Vitest, so importing a server module throws
 *    "Cannot access cloudflare:workers in a prerenderable route".
 *    `installWorkerEnv` (called from a `vi.hoisted` block so it lands
 *    before the module under test is evaluated) publishes this harness's
 *    mutable `workerEnv` as that platform, and `setWorkerDb` /
 *    `clearWorkerEnv` then steer the `DB` binding each test installs.
 *
 * 2. A real D1Database. The loaders and actions reach the DB only through
 *    `getDb(env.DB)` → `drizzle(d1, { schema })`, so anything that speaks the
 *    D1 statement API (`prepare` / `bind` / `all` / `run` / `raw` / `batch`)
 *    is enough. This harness implements that API over `node:sqlite`
 *    (built into Node 22+, the repo runs Node 26) and applies the *real*
 *    migration SQL from `drizzle/*.sql`, so the tables under test are
 *    exactly the ones production gets — no hand-written DDL to drift.
 *
 * The SQL itself is executed by SQLite, so assertions are about observable
 * behaviour (rows written, rows deleted, cookies set) rather than about
 * which Drizzle method a function happened to call.
 */

import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { type Database, getDb } from "../../../src/lib/server/db";

export type TestDb = Database;

// ---------- Worker env ----------

/**
 * The mutable object that stands in for `cloudflare:workers`'s `env` while a
 * request-layer test runs. Swapping `DB` here steers every server module that
 * reads `env.DB` — the hooks, the loaders and the `+server.ts` handlers all
 * go through it.
 */
export const workerEnv: { DB?: unknown; ASSETS?: unknown } = {};

/**
 * Publishes `workerEnv` as the adapter's runtime platform proxy. MUST run
 * before the module under test is evaluated: the virtual
 * `cloudflare:workers` module captures
 * `globalThis.__sveltekit_cloudflare_platform` at evaluation time (it then
 * re-reads `.env` on every property access, which is why swapping bindings
 * later works).
 *
 * Copy into a request-layer test file as the first statement:
 *
 * ```ts
 * await vi.hoisted(async () => {
 *   (await import("./_helpers/harness")).installWorkerEnv();
 * });
 * ```
 */
export function installWorkerEnv(): void {
	(globalThis as unknown as Record<string, unknown>).__sveltekit_cloudflare_platform = {
		env: workerEnv,
	};
}

installWorkerEnv();

/**
 * Installs (or removes) the D1 binding `env.DB` resolves to. Pass `null` to
 * simulate a deployment with no D1 binding attached — the `if (!env.DB)`
 * degradation branches in the loaders.
 */
export function setWorkerDb(d1: D1Like | null): void {
	workerEnv.DB = d1 ?? undefined;
}

/** Clears every binding so a test never leaks one into the next. */
export function clearWorkerEnv(): void {
	workerEnv.DB = undefined;
	workerEnv.ASSETS = undefined;
}

// ---------- D1 over node:sqlite ----------

/** The subset of `D1Database` that `drizzle-orm/d1` actually calls. */
export interface D1Like {
	prepare(sql: string): unknown;
	batch(stmts: unknown[]): Promise<unknown[]>;
	exec(sql: string): Promise<unknown>;
}

/**
 * Drizzle's D1 dialect declares `integer({ mode: 'timestamp' })` columns
 * and hands the driver a JS `Date`; the wire value is unix seconds. The
 * sqlite-proxy harness in `auth.test.ts` needs the same coercion, and real
 * D1 does it inside its host driver — we do it here.
 */
function bind(value: unknown): unknown {
	if (value instanceof Date) return Math.floor(value.getTime() / 1000);
	return value;
}

function bindAll(params: unknown[]): never[] {
	return params.map(bind) as never[];
}

/** `BEGIN` / `COMMIT` / `ROLLBACK` / `SAVEPOINT` — rejected by D1. */
const EXPLICIT_TXN = /^\s*(begin|commit|rollback|savepoint|release)\b/i;

/**
 * A minimal in-memory D1Database over `node:sqlite`. Only the surface
 * Drizzle's D1 session touches is implemented. `raw()` returns positional
 * arrays the way the real binding does, because `mapResultRow` reads rows
 * by column index.
 */
export function makeTestD1(): { d1: D1Like; raw: DatabaseSync } {
	const raw = new DatabaseSync(":memory:");
	for (const file of migrationFiles()) raw.exec(readFileSync(file, "utf8"));

	const d1: D1Like = {
		prepare(sql: string) {
			// D1 refuses explicit transactions: "D1 runs your SQL in a
			// transaction for you" is the documented answer to BEGIN. The
			// binding does not support them, so neither does this fake —
			// node:sqlite would happily run them and hide the difference.
			if (EXPLICIT_TXN.test(sql)) {
				const reject = () => {
					throw new Error(
						"D1_ERROR: D1 runs your SQL in a transaction for you. Please export an SQL file from your SQLite database and try again.",
					);
				};
				const txStmt = {
					bind: () => txStmt,
					all: reject,
					raw: reject,
					first: reject,
					run: reject,
				};
				return txStmt;
			}
			let params: unknown[] = [];
			const stmt = {
				bind(...next: unknown[]) {
					params = next;
					return stmt;
				},
				async all() {
					return {
						results: raw.prepare(sql).all(...bindAll(params)) as Record<string, unknown>[],
						success: true,
						meta: {},
					};
				},
				async raw() {
					const prepared = raw.prepare(sql);
					const cols = prepared.columns().map((c) => c.name);
					const list = prepared.all(...bindAll(params)) as Record<string, unknown>[];
					return list.map((row) => cols.map((c) => row[c]));
				},
				async first(column?: string) {
					const row = raw.prepare(sql).get(...bindAll(params)) as
						| Record<string, unknown>
						| undefined;
					if (!row) return null;
					return column ? row[column] : row;
				},
				async run() {
					const info = raw.prepare(sql).run(...bindAll(params)) as {
						changes: number | bigint;
						lastInsertRowid: number | bigint;
					};
					const changes = Number(info.changes);
					return {
						success: true,
						// `auth.ts:extractAffectedRows` reads `meta.rows_written`,
						// which is the D1 spelling. `lastInsertRowid` is
						// camelCase in the real binding too.
						meta: {
							rows_written: changes,
							changes,
							last_row_id: Number(info.lastInsertRowid),
						},
					};
				},
			};
			return stmt;
		},
		async batch(stmts: unknown[]) {
			const list = stmts as Array<{ all: () => Promise<{ results: unknown[] }> }>;
			return Promise.all(list.map((s) => s.all()));
		},
		async exec() {
			return { count: 0, duration: 0 };
		},
	};
	return { d1, raw };
}

function migrationFiles(): string[] {
	const dir = fileURLToPath(new URL("../../../drizzle/", import.meta.url));
	return readdirSync(dir)
		.filter((f) => f.endsWith(".sql"))
		.sort()
		.map((f) => `${dir}${f}`);
}

/**
 * Opens a migrated in-memory database, installs it as the worker's D1
 * binding, and returns the Drizzle client plus the raw SQLite handle for
 * assertions that need to count rows or splice a value Drizzle would not
 * naturally express (e.g. an already-expired session).
 */
export function withTestDb(): { db: TestDb; raw: DatabaseSync; d1: D1Like } {
	const { d1, raw } = makeTestD1();
	setWorkerDb(d1);
	return { db: getDb(d1 as never), raw, d1 };
}

// ---------- Seed helpers ----------
//
// Thin raw-SQL inserts against the migrated schema. Every FK parent comes
// first, so a loader test only states the rows it actually cares about.

export const CAREER_CODE = "ISC";
export const PERIOD = "AGOSTO-DICIEMBRE/2026";

export function seedCareer(raw: DatabaseSync, code = CAREER_CODE): void {
	raw
		.prepare(
			"INSERT INTO careers (code, name, total_credits, total_semesters) VALUES (?, ?, 260, 9)",
		)
		.run(code, "Ingeniería en Sistemas Computacionales");
}

export interface SeedProfile {
	controlNumber?: string;
	fullName?: string;
	approvedCredits?: number;
	remainingCredits?: number;
	currentSemester?: number;
	advancePercentage?: number;
	certifiedAverage?: number;
	arithmeticAverage?: number;
	passedAverage?: number;
}

export function seedProfile(raw: DatabaseSync, seed: SeedProfile = {}): void {
	const {
		controlNumber = "12345678",
		fullName = "Ada Lovelace Ortiz",
		approvedCredits = 182,
		remainingCredits = 78,
		currentSemester = 5,
		advancePercentage = 70,
		certifiedAverage = 88.5,
		arithmeticAverage = 87.2,
		passedAverage = 90.1,
	} = seed;
	raw
		.prepare(
			`INSERT INTO student_profiles
				(control_number, full_name, curp, birth_state, career_code, current_semester,
				 certified_average, arithmetic_average, passed_average,
				 approved_credits, remaining_credits, advance_percentage)
			 VALUES (?, ?, 'LOAP800101HDFRMD09', 'Michoacan', ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			controlNumber,
			fullName,
			CAREER_CODE,
			currentSemester,
			certifiedAverage,
			arithmeticAverage,
			passedAverage,
			approvedCredits,
			remainingCredits,
			advancePercentage,
		);
}

export function seedCredential(
	raw: DatabaseSync,
	controlNumber: string,
	hash: string,
	salt: string,
	iterations = 10_000,
): void {
	raw
		.prepare(
			`INSERT INTO student_credentials
				(control_number, password_hash, password_salt, password_iterations)
			 VALUES (?, ?, ?, ?)`,
		)
		.run(controlNumber, hash, salt, iterations);
}

export interface SeedSubject {
	canonicalId: string;
	code: string;
	name?: string;
	semester?: number;
	credits?: number;
}

export function seedSubject(raw: DatabaseSync, seed: SeedSubject): void {
	const { canonicalId, code, name = `Materia ${code}`, semester = 1, credits = 6 } = seed;
	raw
		.prepare(
			`INSERT INTO subjects (canonical_id, code, name, semester, ht, hp, credits, area)
			 VALUES (?, ?, ?, ?, 3, 3, ?, 'Sistemas')`,
		)
		.run(canonicalId, code, name, semester, credits);
}

export interface SeedBlock {
	groupId: string;
	day: string;
	startTime: string;
	endTime: string;
	classroom?: string;
}

export function seedGroup(
	raw: DatabaseSync,
	groupId: string,
	subjectCanonicalId: string,
	groupCode = "A",
	controlNumber: string | null = null,
): void {
	raw
		.prepare(
			`INSERT INTO course_groups (id, subject_canonical_id, group_code, teacher_name, has_lab, student_control_number)
			 VALUES (?, ?, ?, 'Docente Prueba', 1, ?)`,
		)
		.run(groupId, subjectCanonicalId, groupCode, controlNumber);
}

export function seedBlock(raw: DatabaseSync, seed: SeedBlock): void {
	const { groupId, day, startTime, endTime, classroom = "Lab 1" } = seed;
	raw
		.prepare(
			`INSERT INTO course_schedule_blocks (group_id, day, start_time, end_time, classroom)
			 VALUES (?, ?, ?, ?, ?)`,
		)
		.run(groupId, day, startTime, endTime, classroom);
}

export function seedProgress(
	raw: DatabaseSync,
	controlNumber: string,
	subjectCanonicalId: string,
	status = "ENROLLED",
	period = PERIOD,
): void {
	raw
		.prepare(
			`INSERT INTO student_progress (student_control_number, subject_canonical_id, status, grade, period)
			 VALUES (?, ?, ?, NULL, ?)`,
		)
		.run(controlNumber, subjectCanonicalId, status, period);
}

// ---------- Cookies ----------

export interface CookieOp {
	type: "set" | "delete";
	name: string;
	value?: string;
	options?: Record<string, unknown>;
}

export interface CookieJar {
	get(name: string): string | undefined;
	set(name: string, value: string, options?: Record<string, unknown>): void;
	delete(name: string, options?: Record<string, unknown>): void;
	/** Everything the handler did, in order. */
	ops: CookieOp[];
	/** Current contents, so a test can assert the jar after a `delete`. */
	entries(): Record<string, string>;
}

/** SvelteKit's `event.cookies`, recording every mutation for assertions. */
export function makeCookies(initial: Record<string, string> = {}): CookieJar {
	const jar = new Map(Object.entries(initial));
	const ops: CookieOp[] = [];
	return {
		ops,
		get: (name) => jar.get(name),
		set: (name, value, options) => {
			jar.set(name, value);
			ops.push({ type: "set", name, value, options });
		},
		delete: (name, options) => {
			jar.delete(name);
			ops.push({ type: "delete", name, options });
		},
		entries: () => Object.fromEntries(jar),
	};
}

// ---------- Locals / events ----------

export interface StudentUser {
	controlNumber: string;
	fullName: string;
	status: string;
	curp?: string;
	birthState?: string;
	careerCode?: string;
	currentSemester?: number;
	certifiedAverage?: number;
	arithmeticAverage?: number;
	passedAverage?: number;
	approvedCredits?: number;
	remainingCredits?: number;
	completedCredits?: number;
	advancePercentage?: number;
}

export function makeUser(overrides: Partial<StudentUser> = {}): StudentUser {
	return {
		controlNumber: "12345678",
		fullName: "Ada Lovelace Ortiz",
		status: "Activo regular",
		curp: "LOAP800101HDFRMD09",
		birthState: "Michoacan",
		careerCode: "ISC",
		currentSemester: 5,
		certifiedAverage: 88.5,
		arithmeticAverage: 87.2,
		passedAverage: 90.1,
		approvedCredits: 182,
		remainingCredits: 78,
		completedCredits: 182,
		advancePercentage: 70,
		...overrides,
	};
}

export interface FakeEvent {
	locals: { user: StudentUser | null };
	cookies: CookieJar;
	url: URL;
	request: Request;
	getClientAddress(): string;
	[key: string]: unknown;
}

export interface FakeEventOptions {
	user?: StudentUser | null;
	cookies?: CookieJar;
	url?: string;
	formData?: Record<string, string>;
	headers?: Record<string, string>;
	clientAddress?: string;
}

/**
 * A hand-built SvelteKit `RequestEvent`, minus the framework. Actions and
 * `+server.ts` handlers only touch `locals`, `cookies`, `url`, `request` and
 * `getClientAddress()` — every one of those is supplied here so no HTTP
 * round-trip is needed to exercise them.
 */
export function makeEvent(options: FakeEventOptions = {}): FakeEvent {
	const {
		user = null,
		cookies = makeCookies(),
		url = "https://opensim.test/login",
		formData,
		headers = {},
		clientAddress = "203.0.113.7",
	} = options;

	const body = formData ? new URLSearchParams(formData) : undefined;
	const request = new Request(url, {
		method: body ? "POST" : "GET",
		body,
		headers,
	});

	return {
		locals: { user },
		cookies,
		url: new URL(url),
		request,
		getClientAddress: () => clientAddress,
	};
}

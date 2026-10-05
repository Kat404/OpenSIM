#!/usr/bin/env node

/**
 * OpenSIM — Curriculum + enrollment seed script.
 *
 * Reads two JSON fixtures and emits a SQL file
 * (`src/lib/server/db/seed.sql`) containing idempotent INSERT OR IGNORE
 * batches for:
 *   1. Academic catalog (careers, specialties, subjects,
 *      subject_aliases, subject_prerequisites) from
 *      `data/curriculum-isic-2010-224.json`.
 *   2. Test-student enrollment (student_profiles, student_progress,
 *      course_groups, course_schedule_blocks) from
 *      `data/enrollment-fixture.json`.
 *
 * The generated SQL is applied via:
 *   pnpm db:seed     -> generates + executes wrangler d1 execute --local
 *   pnpm db:seed:gen -> only generates seed.sql (used in CI / manual ops)
 *
 * Idempotency strategy:
 *   - Every table insert uses INSERT OR IGNORE (relying on the unique /
 *     primary-key constraints declared in schema.ts).
 *   - For mutable rows (the test student profile) we use INSERT OR
 *     REPLACE so a fresh `db:seed` overwrites previous test data and
 *     the smoke test stays deterministic.
 *   - Alias uniqueness is also enforced at the SQL level.
 *   - FK ordering: parents first, then children.
 *
 * Why a generated SQL file (and not a Drizzle ORM runtime call)?
 *   - D1 is the Cloudflare SQLite edge store; Drizzle ORM cannot connect
 *     directly from Node. The standard pattern is to emit SQL and let
 *     `wrangler d1 execute --file=...` apply it via Miniflare locally and
 *     via the D1 HTTP API remotely.
 */

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- Types matching the dataset JSON ----------

interface CareerDataset {
	code: string;
	name: string;
	totalCredits: number;
	totalSemesters: number;
	specialties: { code: string; name: string }[];
}

interface SubjectDataset {
	canonicalId: string;
	code: string;
	aliases: string[];
	name: string;
	semester: number;
	ht: number;
	hp: number;
	credits: number;
	area: string;
	specialtyCode?: string;
	prerequisites: string[];
}

interface Dataset {
	version: string;
	institution: string;
	program: string;
	totalSubjects: number;
	totalCredits: number;
	careers: CareerDataset[];
	subjects: SubjectDataset[];
}

// ---------- Types matching the enrollment fixture JSON ----------

interface StudentProfileFixture {
	controlNumber: string;
	fullName: string;
	curp: string;
	birthState: string;
	careerCode: string;
	specialtyCode: string | null;
	currentSemester: number;
	certifiedAverage: number;
	arithmeticAverage: number;
	passedAverage: number;
	approvedCredits: number;
	remainingCredits: number;
	completedCredits: number;
	inProgressCredits: number;
	advancePercentage: number;
	status: string;
	healthService: string;
	enrollmentPeriod: string;
}

interface StudentProgressFixture {
	subjectCanonicalId: string;
	status: "APPROVED" | "ENROLLED" | "AVAILABLE" | "LOCKED";
	grade: number | null;
	evaluationType: "ORDINARIO" | "REPETICION" | "ESPECIAL" | null;
	period: string;
}

interface CourseGroupFixture {
	id: string;
	subjectCanonicalId: string;
	groupCode: string;
	teacherName: string;
	hasLab: boolean;
}

interface CourseScheduleBlockFixture {
	groupId: string;
	day: string;
	startTime: string;
	endTime: string;
	classroom: string;
}

interface EnrollmentFixture {
	version: string;
	controlNumber: string;
	student_profile: StudentProfileFixture;
	student_progress: StudentProgressFixture[];
	course_groups: CourseGroupFixture[];
	course_schedule_blocks: CourseScheduleBlockFixture[];
}

// ---------- Path helpers (ESM-safe) ----------

const here = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(here, "data/curriculum-isic-2010-224.json");
const ENROLLMENT_FIXTURE_PATH = resolve(here, "data/enrollment-fixture.json");
const SEED_SQL_PATH = resolve(here, "seed.sql");

// ---------- SQL escaping (single-quoted string literal) ----------

function sqlStr(v: string): string {
	return `'${v.replace(/'/g, "''")}'`;
}

function sqlNum(n: number): string {
	return Number.isFinite(n) ? String(n) : "NULL";
}

function sqlNullableStr(v: string | undefined | null): string {
	return v === undefined || v === null || v === "" ? "NULL" : sqlStr(v);
}

function sqlBool(b: boolean): number {
	return b ? 1 : 0;
}

function sqlNullableNum(n: number | null | undefined): string {
	return n === null || n === undefined || !Number.isFinite(n) ? "NULL" : String(n);
}

// ---------- SQL builders ----------

function insertCareers(careers: CareerDataset[]): string {
	const lines: string[] = ["-- careers"];
	for (const c of careers) {
		lines.push(
			`INSERT OR IGNORE INTO careers (code, name, total_credits, total_semesters) VALUES (${sqlStr(c.code)}, ${sqlStr(c.name)}, ${sqlNum(c.totalCredits)}, ${sqlNum(c.totalSemesters)});`,
		);
		lines.push("--> statement-breakpoint");
		for (const s of c.specialties) {
			lines.push(
				`INSERT OR IGNORE INTO specialties (code, career_code, name) VALUES (${sqlStr(s.code)}, ${sqlStr(c.code)}, ${sqlStr(s.name)});`,
			);
			lines.push("--> statement-breakpoint");
		}
	}
	return lines.join("\n");
}

function insertSubjects(subjects: SubjectDataset[]): string {
	const lines: string[] = ["-- subjects"];
	for (const s of subjects) {
		lines.push(
			`INSERT OR IGNORE INTO subjects (canonical_id, code, name, semester, ht, hp, credits, area, specialty_code) VALUES (${sqlStr(s.canonicalId)}, ${sqlStr(s.code)}, ${sqlStr(s.name)}, ${sqlNum(s.semester)}, ${sqlNum(s.ht)}, ${sqlNum(s.hp)}, ${sqlNum(s.credits)}, ${sqlStr(s.area)}, ${sqlNullableStr(s.specialtyCode)});`,
		);
		lines.push("--> statement-breakpoint");
		for (const alias of s.aliases ?? []) {
			lines.push(
				`INSERT OR IGNORE INTO subject_aliases (subject_canonical_id, alias_code) VALUES (${sqlStr(s.canonicalId)}, ${sqlStr(alias)});`,
			);
			lines.push("--> statement-breakpoint");
		}
		for (const prereq of s.prerequisites ?? []) {
			lines.push(
				`INSERT OR IGNORE INTO subject_prerequisites (subject_canonical_id, prerequisite_canonical_id) VALUES (${sqlStr(s.canonicalId)}, ${sqlStr(prereq)});`,
			);
			lines.push("--> statement-breakpoint");
		}
	}
	return lines.join("\n");
}

function insertFooter(): string {
	return [
		"--> statement-breakpoint",
		"-- verification queries (informational, no-op)",
		"SELECT COUNT(*) AS careers FROM careers;",
		"--> statement-breakpoint",
		"SELECT COUNT(*) AS specialties FROM specialties;",
		"--> statement-breakpoint",
		"SELECT COUNT(*) AS subjects FROM subjects;",
		"--> statement-breakpoint",
		"SELECT COUNT(*) AS aliases FROM subject_aliases;",
		"--> statement-breakpoint",
		"SELECT COUNT(*) AS prerequisites FROM subject_prerequisites;",
		"--> statement-breakpoint",
		"SELECT COUNT(*) AS progress_rows FROM student_progress;",
		"--> statement-breakpoint",
		"SELECT COUNT(*) AS groups_offered FROM course_groups;",
		"--> statement-breakpoint",
		"SELECT COUNT(*) AS schedule_blocks FROM course_schedule_blocks;",
		"",
	].join("\n");
}

// ---------- Enrollment fixture SQL builders ----------

/**
 * INSERT OR REPLACE for the test student profile so a fresh
 * `db:seed` always lands the same row regardless of what was
 * already there. The credential row is *not* touched here — it is
 * managed by `seed-password.ts` (PBKDF2 hash + salt require the
 * Node crypto module which is not available at SQL-emit time).
 */
function insertStudentProfile(p: StudentProfileFixture): string {
	const lines: string[] = ["-- student_profiles (test student)"];
	lines.push(
		`INSERT OR REPLACE INTO student_profiles (control_number, full_name, curp, birth_state, career_code, specialty_code, current_semester, certified_average, arithmetic_average, passed_average, approved_credits, remaining_credits, completed_credits, in_progress_credits, advance_percentage, status, health_service, enrollment_period) VALUES (${sqlStr(p.controlNumber)}, ${sqlStr(p.fullName)}, ${sqlStr(p.curp)}, ${sqlStr(p.birthState)}, ${sqlStr(p.careerCode)}, ${sqlNullableStr(p.specialtyCode)}, ${sqlNum(p.currentSemester)}, ${sqlNum(p.certifiedAverage)}, ${sqlNum(p.arithmeticAverage)}, ${sqlNum(p.passedAverage)}, ${sqlNum(p.approvedCredits)}, ${sqlNum(p.remainingCredits)}, ${sqlNum(p.completedCredits)}, ${sqlNum(p.inProgressCredits)}, ${sqlNum(p.advancePercentage)}, ${sqlStr(p.status)}, ${sqlStr(p.healthService)}, ${sqlStr(p.enrollmentPeriod)});`,
	);
	return lines.join("\n");
}

function insertStudentProgress(controlNumber: string, rows: StudentProgressFixture[]): string {
	const lines: string[] = [`-- student_progress (${rows.length} rows for ${controlNumber})`];
	for (const r of rows) {
		lines.push(
			`INSERT OR REPLACE INTO student_progress (student_control_number, subject_canonical_id, status, grade, evaluation_type, period) VALUES (${sqlStr(controlNumber)}, ${sqlStr(r.subjectCanonicalId)}, ${sqlStr(r.status)}, ${sqlNullableNum(r.grade)}, ${sqlNullableStr(r.evaluationType)}, ${sqlStr(r.period)});`,
		);
		lines.push("--> statement-breakpoint");
	}
	return lines.join("\n");
}

function insertCourseGroups(groups: CourseGroupFixture[]): string {
	const lines: string[] = [`-- course_groups (${groups.length} groups)`];
	for (const g of groups) {
		lines.push(
			`INSERT OR REPLACE INTO course_groups (id, subject_canonical_id, group_code, teacher_name, has_lab) VALUES (${sqlStr(g.id)}, ${sqlStr(g.subjectCanonicalId)}, ${sqlStr(g.groupCode)}, ${sqlStr(g.teacherName)}, ${sqlBool(g.hasLab)});`,
		);
		lines.push("--> statement-breakpoint");
	}
	return lines.join("\n");
}

function insertScheduleBlocks(blocks: CourseScheduleBlockFixture[]): string {
	const lines: string[] = [`-- course_schedule_blocks (${blocks.length} blocks)`];
	for (const b of blocks) {
		lines.push(
			`INSERT OR REPLACE INTO course_schedule_blocks (group_id, day, start_time, end_time, classroom) VALUES (${sqlStr(b.groupId)}, ${sqlStr(b.day)}, ${sqlStr(b.startTime)}, ${sqlStr(b.endTime)}, ${sqlStr(b.classroom)});`,
		);
		lines.push("--> statement-breakpoint");
	}
	return lines.join("\n");
}

// ---------- Main ----------

function main(): void {
	const raw = readFileSync(DATA_PATH, "utf8");
	const dataset = JSON.parse(raw) as Dataset;

	// Sanity assertions (fail loud if the dataset is malformed).
	if (!Array.isArray(dataset.careers) || dataset.careers.length === 0) {
		throw new Error("Dataset must contain at least one career.");
	}
	if (!Array.isArray(dataset.subjects) || dataset.subjects.length === 0) {
		throw new Error("Dataset must contain at least one subject.");
	}
	const seenIds = new Set<string>();
	for (const s of dataset.subjects) {
		if (seenIds.has(s.canonicalId)) {
			throw new Error(`Duplicate canonicalId in dataset: ${s.canonicalId}`);
		}
		seenIds.add(s.canonicalId);
		for (const p of s.prerequisites ?? []) {
			if (!seenIds.has(p) && !dataset.subjects.some((d) => d.canonicalId === p)) {
				throw new Error(
					`Prerequisite ${p} for subject ${s.canonicalId} does not exist in dataset (forward reference).`,
				);
			}
		}
	}
	const careerCodes = new Set(dataset.careers.map((c) => c.code));
	for (const c of dataset.careers) {
		for (const s of c.specialties) {
			// No FK to enforce here, but ensure specialty uniqueness.
			if (
				dataset.careers.some((other) =>
					other.specialties.some((os) => os.code === s.code && other.code !== c.code),
				)
			) {
				throw new Error(`Specialty code ${s.code} is bound to multiple careers.`);
			}
			void careerCodes; // referenced for clarity
		}
	}

	// --- Enrollment fixture (optional) --------------------------------
	// If `enrollment-fixture.json` is present, load it and emit SQL for
	// the test student profile, progress, course groups, and schedule
	// blocks. INSERT OR REPLACE keeps the seed idempotent so a fresh
	// `db:seed` always lands the same fixture.
	let enrollment: EnrollmentFixture | null = null;
	try {
		enrollment = JSON.parse(readFileSync(ENROLLMENT_FIXTURE_PATH, "utf8")) as EnrollmentFixture;
	} catch (err) {
		// File missing is acceptable; any other error (JSON parse) is
		// not — a malformed fixture is the kind of silent regression
		// that fails the smoke test in production.
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
			throw err;
		}
	}

	if (enrollment) {
		// Cross-validate the fixture against the curriculum before we
		// emit anything. A typo in the JSON (canonicalId that does not
		// exist in `subjects`) would otherwise crash the FK constraint
		// at apply time with a generic SQLITE_CONSTRAINT error.
		const validIds = new Set(seenIds);
		for (const r of enrollment.student_progress) {
			if (!validIds.has(r.subjectCanonicalId)) {
				throw new Error(
					`enrollment-fixture.json references unknown subject "${r.subjectCanonicalId}" in student_progress`,
				);
			}
		}
		for (const g of enrollment.course_groups) {
			if (!validIds.has(g.subjectCanonicalId)) {
				throw new Error(
					`enrollment-fixture.json references unknown subject "${g.subjectCanonicalId}" in course_groups`,
				);
			}
		}
		const groupIds = new Set(enrollment.course_groups.map((g) => g.id));
		for (const b of enrollment.course_schedule_blocks) {
			if (!groupIds.has(b.groupId)) {
				throw new Error(
					`enrollment-fixture.json references unknown group "${b.groupId}" in course_schedule_blocks`,
				);
			}
		}
	}

	const header = [
		"-- OpenSIM seed (auto-generated by src/lib/server/db/seed.ts).",
		`-- Program: ${dataset.program}`,
		`-- Plan: ${dataset.version}`,
		`-- Total subjects: ${dataset.subjects.length}`,
		`-- Total credits (target): ${dataset.totalCredits}`,
		"-- Idempotent: catalog INSERTs use OR IGNORE; test-student",
		"-- rows use OR REPLACE so the fixture is deterministic on rerun.",
		"",
	].join("\n");

	const sections: string[] = [
		header,
		insertCareers(dataset.careers),
		insertSubjects(dataset.subjects),
	];
	if (enrollment) {
		sections.push(
			"--> statement-breakpoint",
			insertStudentProfile(enrollment.student_profile),
			"--> statement-breakpoint",
			insertStudentProgress(enrollment.controlNumber, enrollment.student_progress),
			"--> statement-breakpoint",
			insertCourseGroups(enrollment.course_groups),
			"--> statement-breakpoint",
			insertScheduleBlocks(enrollment.course_schedule_blocks),
		);
	}
	sections.push(insertFooter());
	const sql = sections.join("\n");

	mkdirSync(dirname(SEED_SQL_PATH), { recursive: true });
	writeFileSync(SEED_SQL_PATH, sql, "utf8");

	const subjectCount = dataset.subjects.length;
	const aliasCount = dataset.subjects.reduce((a, s) => a + (s.aliases?.length ?? 0), 0);
	const prereqCount = dataset.subjects.reduce((a, s) => a + (s.prerequisites?.length ?? 0), 0);
	const specialtyCount = dataset.careers.reduce((a, c) => a + c.specialties.length, 0);

	const counts = [
		`${subjectCount} subjects`,
		`${aliasCount} aliases`,
		`${prereqCount} prerequisites`,
		`${specialtyCount} specialties`,
	];
	if (enrollment) {
		counts.push(
			`${enrollment.student_progress.length} progress rows`,
			`${enrollment.course_groups.length} groups`,
			`${enrollment.course_schedule_blocks.length} schedule blocks`,
		);
	}

	console.log(`seed.sql generated (${counts.join(", ")}).`);
	console.log(`Path: ${SEED_SQL_PATH}`);
}

main();

// ---------- Apply via wrangler d1 execute ----------

/**
 * If invoked with --apply, pipe seed.sql into wrangler d1 execute --local.
 * D1's local backend is Miniflare; --remote targets the production D1.
 */
if (process.argv.includes("--apply")) {
	const remoteFlag = process.argv.includes("--remote") ? " --remote" : " --local";
	const cmd = `pnpm exec wrangler d1 execute opensim${remoteFlag} --file=${SEED_SQL_PATH}`;
	console.log(`Applying via: ${cmd}`);
	execSync(cmd, { stdio: "inherit", cwd: resolve(here, "../../..") });
}

export { DATA_PATH, SEED_SQL_PATH };

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
import { SUBJECT_COMPONENTS, SUBJECT_SERIATION_STATES } from "#lib/server/db/schema";

// ---------- Types matching the dataset JSON ----------

interface SpecialtyDataset {
	code: string;
	name: string;
	declaredCredits: number | null;
}

interface SubjectDataset {
	canonicalId: string;
	code: string;
	aliases: string[];
	name: string;
	/** `null` for the specialty modules: the semester they are taken in is
	 * not published (gap H8). */
	semester: number | null;
	ht: number | null;
	hp: number | null;
	credits: number;
	/** `null` for every subject: no source classifies curricular areas (gap H4). */
	area: string | null;
	specialtyCode: string | null;
	seriationState: (typeof SUBJECT_SERIATION_STATES)[number];
	component: (typeof SUBJECT_COMPONENTS)[number];
}

/** One verified seriation edge. The dataset states both ends by `code`; the
 * table stores `canonical_id`, so `main()` resolves them before emitting. */
interface PrerequisiteEdge {
	subject: string;
	prerequisite: string;
}

interface Dataset {
	version: string;
	institution: string;
	planName: string;
	modality: string;
	careerCode: string;
	careerName: string;
	totalSemesters: number;
	declaredTotalCredits: number;
	specialties: SpecialtyDataset[];
	subjects: SubjectDataset[];
	prerequisites: PrerequisiteEdge[];
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

function insertCareers(d: Dataset): string {
	const lines: string[] = ["-- careers"];
	lines.push(
		`INSERT OR IGNORE INTO careers (code, name, total_credits, total_semesters) VALUES (${sqlStr(d.careerCode)}, ${sqlStr(d.careerName)}, ${sqlNum(d.declaredTotalCredits)}, ${sqlNum(d.totalSemesters)});`,
	);
	lines.push("--> statement-breakpoint");
	for (const s of d.specialties) {
		lines.push(
			`INSERT OR IGNORE INTO specialties (code, career_code, name) VALUES (${sqlStr(s.code)}, ${sqlStr(d.careerCode)}, ${sqlStr(s.name)});`,
		);
		lines.push("--> statement-breakpoint");
	}
	return lines.join("\n");
}

function insertSubjects(subjects: SubjectDataset[]): string {
	const lines: string[] = ["-- subjects"];
	for (const s of subjects) {
		lines.push(
			`INSERT OR IGNORE INTO subjects (canonical_id, code, name, semester, ht, hp, credits, area, seriation_state, component, specialty_code) VALUES (${sqlStr(s.canonicalId)}, ${sqlStr(s.code)}, ${sqlStr(s.name)}, ${sqlNullableNum(s.semester)}, ${sqlNullableNum(s.ht)}, ${sqlNullableNum(s.hp)}, ${sqlNum(s.credits)}, ${sqlNullableStr(s.area)}, ${sqlStr(s.seriationState)}, ${sqlStr(s.component)}, ${sqlNullableStr(s.specialtyCode)});`,
		);
		lines.push("--> statement-breakpoint");
		for (const alias of s.aliases ?? []) {
			lines.push(
				`INSERT OR IGNORE INTO subject_aliases (subject_canonical_id, alias_code) VALUES (${sqlStr(s.canonicalId)}, ${sqlStr(alias)});`,
			);
			lines.push("--> statement-breakpoint");
		}
	}
	return lines.join("\n");
}

/**
 * The 14 verified seriation edges. They live at the top level of the
 * dataset (not per subject) because that is where the source states them:
 * the printed plan draws them as arrows between columns.
 */
function insertPrerequisites(edges: { subject: string; prerequisite: string }[]): string {
	const lines: string[] = ["-- subject_prerequisites"];
	for (const e of edges) {
		lines.push(
			`INSERT OR IGNORE INTO subject_prerequisites (subject_canonical_id, prerequisite_canonical_id) VALUES (${sqlStr(e.subject)}, ${sqlStr(e.prerequisite)});`,
		);
		lines.push("--> statement-breakpoint");
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
	if (typeof dataset.careerCode !== "string" || dataset.careerCode === "") {
		throw new Error("Dataset must declare a careerCode.");
	}
	if (!Number.isFinite(dataset.declaredTotalCredits)) {
		throw new Error("Dataset must declare numeric declaredTotalCredits.");
	}
	if (!Number.isFinite(dataset.totalSemesters)) {
		throw new Error("Dataset must declare numeric totalSemesters.");
	}
	if (!Array.isArray(dataset.specialties) || dataset.specialties.length === 0) {
		throw new Error("Dataset must contain at least one specialty.");
	}
	if (!Array.isArray(dataset.subjects) || dataset.subjects.length === 0) {
		throw new Error("Dataset must contain at least one subject.");
	}
	if (!Array.isArray(dataset.prerequisites)) {
		throw new Error("Dataset must declare a prerequisites array.");
	}

	const specialtyCodes = new Set<string>();
	for (const s of dataset.specialties) {
		if (specialtyCodes.has(s.code)) {
			throw new Error(`Duplicate specialty code in dataset: ${s.code}`);
		}
		specialtyCodes.add(s.code);
	}

	const seenIds = new Set<string>();
	const seenCodes = new Set<string>();
	const canonicalIdByCode = new Map<string, string>();
	for (const s of dataset.subjects) {
		if (seenIds.has(s.canonicalId)) {
			throw new Error(`Duplicate canonicalId in dataset: ${s.canonicalId}`);
		}
		seenIds.add(s.canonicalId);
		if (seenCodes.has(s.code)) {
			throw new Error(`Duplicate subject code in dataset: ${s.code}`);
		}
		seenCodes.add(s.code);
		canonicalIdByCode.set(s.code, s.canonicalId);
		if (!SUBJECT_SERIATION_STATES.includes(s.seriationState)) {
			throw new Error(`Subject ${s.canonicalId} has unknown seriationState "${s.seriationState}".`);
		}
		if (!SUBJECT_COMPONENTS.includes(s.component)) {
			throw new Error(`Subject ${s.canonicalId} has unknown component "${s.component}".`);
		}
		if (s.specialtyCode !== null && !specialtyCodes.has(s.specialtyCode)) {
			throw new Error(
				`Subject ${s.canonicalId} references specialty "${s.specialtyCode}" which the dataset does not declare.`,
			);
		}
	}

	// The dataset keys every edge end by `code`; the table stores `canonical_id`.
	const edges = dataset.prerequisites.map((e) => {
		const subject = canonicalIdByCode.get(e.subject);
		const prerequisite = canonicalIdByCode.get(e.prerequisite);
		if (!subject) {
			throw new Error(`Prerequisite edge subject "${e.subject}" does not exist in dataset.`);
		}
		if (!prerequisite) {
			throw new Error(
				`Prerequisite "${e.prerequisite}" of "${e.subject}" does not exist in dataset.`,
			);
		}
		if (subject === prerequisite) {
			throw new Error(`Prerequisite edge for "${e.subject}" points at itself.`);
		}
		return { subject, prerequisite };
	});

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
		`-- Career: ${dataset.careerCode} — ${dataset.careerName}`,
		`-- Institution: ${dataset.institution}`,
		`-- Plan: ${dataset.planName} (${dataset.modality})`,
		`-- Plan version: ${dataset.version}`,
		`-- Total subjects: ${dataset.subjects.length}`,
		`-- Total credits (target): ${dataset.declaredTotalCredits}`,
		"-- Idempotent: catalog INSERTs use OR IGNORE; test-student",
		"-- rows use OR REPLACE so the fixture is deterministic on rerun.",
		"",
	].join("\n");

	const sections: string[] = [
		header,
		insertCareers(dataset),
		insertSubjects(dataset.subjects),
		insertPrerequisites(edges),
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
	const specialtyCount = dataset.specialties.length;

	const counts = [
		`1 career`,
		`${subjectCount} subjects`,
		`${aliasCount} aliases`,
		`${dataset.prerequisites.length} prerequisites`,
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

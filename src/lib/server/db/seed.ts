#!/usr/bin/env node

/**
 * OpenSIM — Curriculum + enrollment seed script.
 *
 * Reads three JSON fixtures and emits a SQL file
 * (`src/lib/server/db/seed.sql`) containing idempotent INSERT OR IGNORE
 * batches for:
 *   1. Academic catalog (careers, specialties, subjects,
 *      subject_aliases, subject_prerequisites) from
 *      `data/curriculum-isic-2010-224.json`.
 *   2. Syllabus detail (subject_units, 32 units of the 7 subjects the
 *      SIM publishes) from `docs/data/sim-temarios.json`.
 *   3. Offering catalogue (course_groups, 468 rows across 9 terms) from
 *      `docs/data/sim-grupos-oferta.json`.
 *   4. Test-student enrollment (student_profiles, student_progress,
 *      complementary_credit_activities, course_schedule_blocks) from
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
 *     the smoke test stays deterministic. In SQLite a REPLACE is a
 *     DELETE plus an INSERT, so the profile upsert also fires the
 *     cascades declared on `student_profiles`. The student's schedule
 *     blocks are therefore deleted explicitly first — see
 *     `deleteEnrollmentScheduleBlocks` — which is what makes a re-run
 *     succeed at all, let alone land the same rows.
 *   - What the re-run does NOT preserve: the credential. The same
 *     DELETE cascade drops `student_credentials`, so `db:seed:apply`
 *     must be followed by `db:set-password`. See `scripts/README.md`.
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

/** Complementary-credit rule as stated by the dataset. Stored nowhere: both
 * the requirement and the Social Service unlock are derived from the
 * per-student rows in `complementary_credit_activities`. */
interface ComplementaryCreditRule {
	requiredForGraduation: number;
	unlocksServiceSocial: boolean;
	reticularCredits: boolean;
}

// ---------- Types matching docs/data/sim-temarios.json ----------

/** Stored verbatim inside `subject_units.subtopics_json`: the per-subtopic
 * evaluation windows belong to the subtopic, and Phase 9 rejected a
 * separate `subject_subtopics` table. */
interface TemarioSubtopic {
	index: string;
	title: string;
	evalFrom?: string;
	evalTo?: string;
}

interface TemarioUnit {
	unitNumber: number;
	title: string;
	evalFrom?: string;
	evalTo?: string;
	subtopics: TemarioSubtopic[];
	instruments?: string[];
	criteria?: string[];
}

interface TemarioSubject {
	code: string;
	name: string;
	period: string;
	teacher: string;
	units: TemarioUnit[];
}

interface TemarioDataset {
	coverage: { subjects: number; units: number; subtopics: number };
	subjects: TemarioSubject[];
}

// ---------- Types matching docs/data/sim-grupos-oferta.json ----------

/** One offering row from the SIM reinscription catalogue. `period` is the
 * term number as a digit string, or null when the portal published the row
 * without a term filter. `credits` is null for the lab sessions. */
interface OfertaGroup {
	code: string;
	name: string;
	group: string;
	period: string | number | null;
	teacher: string;
	credits: number | null;
	hasLab: boolean;
}

interface OfertaDataset {
	groups: OfertaGroup[];
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
	complementaryCredits: ComplementaryCreditRule;
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
const TEMARIOS_PATH = resolve(here, "../../../../docs/data/sim-temarios.json");
const OFERTA_PATH = resolve(here, "../../../../docs/data/sim-grupos-oferta.json");
const SEED_SQL_PATH = resolve(here, "seed.sql");

/**
 * Lab sessions are published under their own lab group code, not under a
 * subject code, so they resolve through neither `subjects.code` nor
 * `subject_aliases.alias_code`. This pairing is the one documented in
 * `docs/data/sim-laboratorios.md`, read straight off the SIM offering
 * rows: `hasLab` is true for all 64 of them and `credits` is null for all
 * 64, which is how they are told apart from the 404 curricular groups.
 *
 * `code` -> the canonical `code` of the subject the lab session belongs to.
 * `is_lab_session` is true exactly for membership of this map, so the map
 * is the single source of truth for both the flag and the foreign key.
 */
const LAB_SESSION_SUBJECT_BY_CODE: ReadonlyMap<string, string> = new Map([
	["B2L4", "AEC-1058"], // Quimica
	["B3LA", "SCF-1006"], // Fisica General
	["B4LA", "SCD-1018"], // Principios Electricos y Aplicaciones Digitales
	["B5LA", "SCC-1023"], // Sistemas Programables
	["B5LB", "SCD-1003"], // Arquitectura de Computadoras
	["B6LE", "SCC-1014"], // Lenguajes de Interfaz
]);

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

/**
 * The 32 syllabus units of the 7 subjects the SIM publishes
 * (`docs/data/sim-temarios.json`). Subtopic objects are stored verbatim:
 * each one carries its own `evalFrom`/`evalTo`, and `subtopics_json` is the
 * only place Phase 9 allows them to live.
 *
 * The table keys on a surrogate autoincrement `id` and declares no unique
 * constraint on (subject_canonical_id, unit_number), so `INSERT OR IGNORE`
 * has nothing to conflict on: every apply appended a fresh copy of all 32
 * rows instead of being idempotent. The DELETE below supplies the natural
 * key the schema lacks, scoped to the subjects this seed writes so it can
 * reach no other row.
 */
function insertSubjectUnits(units: ResolvedUnit[]): string {
	const ownSubjectIds = [...new Set(units.map((u) => u.canonicalId))].map(sqlStr);
	const lines: string[] = [
		"-- subject_units",
		`DELETE FROM subject_units WHERE subject_canonical_id IN (${ownSubjectIds.join(", ")});`,
		"--> statement-breakpoint",
	];
	for (const u of units) {
		lines.push(
			`INSERT OR IGNORE INTO subject_units (subject_canonical_id, unit_number, title, subtopics_json, eval_from, eval_to, instruments, criteria) VALUES (${sqlStr(u.canonicalId)}, ${sqlNum(u.unitNumber)}, ${sqlStr(u.title)}, ${sqlStr(u.subtopicsJson)}, ${sqlNullableStr(u.evalFrom)}, ${sqlNullableStr(u.evalTo)}, ${sqlNullableStr(u.instrumentsJson)}, ${sqlNullableStr(u.criteriaJson)});`,
		);
		lines.push("--> statement-breakpoint");
	}
	return lines.join("\n");
}

/**
 * The 468-row offering catalogue (`docs/data/sim-grupos-oferta.json`).
 * `INSERT OR IGNORE` keys on the primary id, which is derived from the
 * full source tuple so a re-run cannot silently overwrite a row.
 */
function insertOfferingGroups(rows: ResolvedOfferingGroup[]): string {
	const lines: string[] = [`-- course_groups (${rows.length} offering groups)`];
	for (const g of rows) {
		lines.push(
			`INSERT OR IGNORE INTO course_groups (id, subject_canonical_id, group_code, teacher_name, has_lab, period, credits, is_lab_session) VALUES (${sqlStr(g.id)}, ${sqlStr(g.canonicalId)}, ${sqlStr(g.groupCode)}, ${sqlStr(g.teacherName)}, ${sqlBool(g.hasLab)}, ${sqlNullableStr(g.period)}, ${sqlNullableNum(g.credits)}, ${sqlBool(g.isLabSession)});`,
		);
		lines.push("--> statement-breakpoint");
	}
	return lines.join("\n");
}

/**
 * One row per completed complementary activity. Derived from the fixture's
 * progress rows whose subject carries `component = COMPLEMENTARY`: only
 * APPROVED counts, because an ENROLLED activity has not been completed.
 */
function insertComplementaryCreditActivities(
	controlNumber: string,
	rows: { canonicalId: string; period: string }[],
): string {
	const lines: string[] = [`-- complementary_credit_activities (${rows.length} rows)`];
	for (const r of rows) {
		lines.push(
			`INSERT OR IGNORE INTO complementary_credit_activities (student_control_number, subject_canonical_id, period) VALUES (${sqlStr(controlNumber)}, ${sqlStr(r.canonicalId)}, ${sqlStr(r.period)});`,
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
		"SELECT COUNT(*) AS units FROM subject_units;",
		"--> statement-breakpoint",
		"SELECT COUNT(*) AS complementary_activities FROM complementary_credit_activities;",
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
 * Clears the test student's schedule blocks, and must be emitted before
 * the profile upsert.
 *
 * `INSERT OR REPLACE` in SQLite is a DELETE followed by an INSERT, so
 * upserting `student_profiles` fires every cascade declared on that
 * table and drops the student's `course_groups`. Those rows carry
 * children of their own — `course_schedule_blocks.group_id` is declared
 * NO ACTION — so the cascade is refused mid-statement, the apply fails
 * with `FOREIGN KEY constraint failed`, and the whole transaction rolls
 * back. Deleting the blocks first lets the cascade complete; the seed
 * re-inserts them from the fixture at the end of this section.
 *
 * The subquery filters on `student_control_number IS NOT NULL`, the
 * discriminator the schema already uses to tell an enrolment from a
 * catalogue row, so the 468 offering groups and any blocks attached to
 * them are out of reach.
 */
function deleteEnrollmentScheduleBlocks(): string {
	const lines: string[] = [
		"-- course_schedule_blocks (test student, cleared before the profile upsert)",
	];
	lines.push(
		"DELETE FROM course_schedule_blocks WHERE group_id IN (SELECT id FROM course_groups WHERE student_control_number IS NOT NULL);",
	);
	return lines.join("\n");
}

/**
 * INSERT OR REPLACE for the test student profile so a fresh
 * `db:seed` always lands the same row regardless of what was
 * already there.
 *
 * The credential row is *not* written here — it is managed by
 * `seed-password.ts` (PBKDF2 hash + salt require the Node crypto module,
 * which is not available at SQL-emit time). It is also *destroyed* by
 * this statement: the REPLACE is a DELETE, `student_credentials`
 * declares ON DELETE CASCADE on `student_profiles`, and the row is not
 * re-inserted until `db:set-password` runs. See `scripts/README.md`.
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

function insertCourseGroups(controlNumber: string, groups: CourseGroupFixture[]): string {
	const lines: string[] = [`-- course_groups (${groups.length} student groups)`];
	for (const g of groups) {
		// `is_lab_session` is derived, never copied from the fixture: the
		// fixture declares no such field, and a group code that names a lab
		// session is one by definition of the pairing map — the same rule the
		// offering rows use. The fixture cross-validation in `main()` rejects
		// a group whose code contradicts its subject, so the two cannot
		// disagree.
		const isLabSession = LAB_SESSION_SUBJECT_BY_CODE.has(g.groupCode);
		lines.push(
			`INSERT OR REPLACE INTO course_groups (id, subject_canonical_id, group_code, teacher_name, has_lab, student_control_number, is_lab_session) VALUES (${sqlStr(g.id)}, ${sqlStr(g.subjectCanonicalId)}, ${sqlStr(g.groupCode)}, ${sqlStr(g.teacherName)}, ${sqlBool(g.hasLab)}, ${sqlStr(controlNumber)}, ${sqlBool(isLabSession)});`,
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

// ---------- Resolved rows ----------

interface ResolvedUnit {
	canonicalId: string;
	unitNumber: number;
	title: string;
	subtopicsJson: string;
	evalFrom: string | null;
	evalTo: string | null;
	instrumentsJson: string | null;
	criteriaJson: string | null;
}

interface ResolvedOfferingGroup {
	id: string;
	canonicalId: string;
	groupCode: string;
	teacherName: string;
	hasLab: boolean;
	period: string | null;
	credits: number | null;
	isLabSession: boolean;
}

/**
 * Resolves any SIM subject code to a `canonical_id`. Three sources, in
 * order: the dataset's own `code`, the dataset's `aliases`, and the
 * lab-session pairing. A code that matches none of them is a data gap and
 * stops the run — a row is never skipped and never guessed.
 */
function makeCodeResolver(
	dataset: Dataset,
): (code: string) => { canonicalId: string; isLabSession: boolean } {
	const byCode = new Map<string, string>();
	const byAlias = new Map<string, string>();
	for (const s of dataset.subjects) {
		byCode.set(s.code, s.canonicalId);
		for (const alias of s.aliases ?? []) {
			if (byAlias.has(alias)) {
				throw new Error(`Duplicate subject alias in dataset: ${alias}`);
			}
			byAlias.set(alias, s.canonicalId);
		}
	}
	return (code: string) => {
		const direct = byCode.get(code);
		if (direct) return { canonicalId: direct, isLabSession: false };
		const alias = byAlias.get(code);
		if (alias) return { canonicalId: alias, isLabSession: false };
		const labSubject = LAB_SESSION_SUBJECT_BY_CODE.get(code);
		if (labSubject) {
			const canonicalId = byCode.get(labSubject);
			if (!canonicalId) {
				throw new Error(
					`Lab session "${code}" is paired with subject "${labSubject}", which the dataset does not declare.`,
				);
			}
			return { canonicalId, isLabSession: true };
		}
		throw new Error(
			`SIM code "${code}" resolves to no subject: it is neither a dataset code, nor a declared alias, nor a known lab session code.`,
		);
	};
}

/** The offering export is public-safe only while every teacher value is a
 * `DOC-NNN` alias. A real name reaching this script aborts the run. */
function assertTeacherAlias(teacher: string, where: string): void {
	if (!/^DOC-\d{3}$/.test(teacher)) {
		throw new Error(`${where} carries an unredacted teacher value; expected a DOC-NNN alias.`);
	}
}

function resolveUnits(
	raw: string,
	resolveCode: (code: string) => { canonicalId: string },
): ResolvedUnit[] {
	const temarios = JSON.parse(raw) as TemarioDataset;
	if (!Array.isArray(temarios.subjects) || temarios.subjects.length === 0) {
		throw new Error("sim-temarios.json must contain at least one subject.");
	}
	const out: ResolvedUnit[] = [];
	const seenUnitKeys = new Set<string>();
	for (const subject of temarios.subjects) {
		assertTeacherAlias(subject.teacher, `sim-temarios.json subject ${subject.code}`);
		const canonicalId = resolveCode(subject.code).canonicalId;
		for (const unit of subject.units ?? []) {
			const key = `${canonicalId}#${unit.unitNumber}`;
			if (seenUnitKeys.has(key)) {
				throw new Error(`Duplicate unit number ${unit.unitNumber} for subject "${subject.code}".`);
			}
			seenUnitKeys.add(key);
			out.push({
				canonicalId,
				unitNumber: unit.unitNumber,
				title: unit.title,
				subtopicsJson: JSON.stringify(unit.subtopics ?? []),
				evalFrom: unit.evalFrom ?? null,
				evalTo: unit.evalTo ?? null,
				instrumentsJson: unit.instruments ? JSON.stringify(unit.instruments) : null,
				criteriaJson: unit.criteria ? JSON.stringify(unit.criteria) : null,
			});
		}
	}
	return out;
}

function resolveOfferingGroups(
	raw: string,
	resolveCode: (code: string) => { canonicalId: string; isLabSession: boolean },
): ResolvedOfferingGroup[] {
	const oferta = JSON.parse(raw) as OfertaDataset;
	if (!Array.isArray(oferta.groups) || oferta.groups.length === 0) {
		throw new Error("sim-grupos-oferta.json must contain at least one group.");
	}
	const seenIds = new Set<string>();
	const out: ResolvedOfferingGroup[] = [];
	for (const g of oferta.groups) {
		assertTeacherAlias(g.teacher, `sim-grupos-oferta.json group ${g.code}/${g.group}`);
		const { canonicalId, isLabSession } = resolveCode(g.code);
		// The source tuple is not unique on (code, group, period): two
		// teachers can hold the same group letter in the same term. The
		// teacher alias is the disambiguator, so it joins the id.
		const period = g.period === null ? "NA" : String(g.period);
		const id = `O-${g.code}-${g.group}-${period}-${g.teacher}`;
		if (seenIds.has(id)) {
			throw new Error(`Two offering rows produce the same group id "${id}".`);
		}
		seenIds.add(id);
		out.push({
			id,
			canonicalId,
			groupCode: g.group,
			teacherName: g.teacher,
			hasLab: g.hasLab === true,
			period: g.period === null ? null : String(g.period),
			credits: typeof g.credits === "number" ? g.credits : null,
			isLabSession,
		});
	}
	return out;
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

	// --- Syllabus units and the offering catalogue -------------------
	// Both exports key their rows by SIM subject code; both tables key by
	// `canonical_id`. `makeCodeResolver` is the single place that bridge
	// lives, and it throws rather than dropping an unresolvable code.
	const resolveCode = makeCodeResolver(dataset);
	const units = resolveUnits(readFileSync(TEMARIOS_PATH, "utf8"), resolveCode);
	const offeringGroups = resolveOfferingGroups(readFileSync(OFERTA_PATH, "utf8"), resolveCode);

	// --- Enrollment fixture (optional) --------------------------------
	// If `enrollment-fixture.json` is present, load it and emit SQL for
	// the test student profile, progress, course groups, and schedule
	// blocks. INSERT OR REPLACE keeps the fixture deterministic so a
	// fresh `db:seed` always lands the same rows; the section opens with
	// a DELETE because that same REPLACE is what used to fail the apply.
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
			// A fixture group whose code names a lab session must belong to
			// the subject that map pairs it with. Without this the fixture
			// could store a `B5LA` group under the wrong subject and
			// `is_lab_session` — derived from the same map at insert time —
			// would silently contradict it.
			const labSubject = LAB_SESSION_SUBJECT_BY_CODE.get(g.groupCode);
			if (
				labSubject !== undefined &&
				labSubject.toLowerCase() !== g.subjectCanonicalId.toLowerCase()
			) {
				throw new Error(
					`enrollment-fixture.json group "${g.id}" has lab group code "${g.groupCode}", which belongs to subject "${labSubject}", not "${g.subjectCanonicalId}".`,
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
		// The fixture's own group ids must not collide with the offering
		// catalogue's, or `INSERT OR REPLACE` would silently swap one for
		// the other on every re-run.
		for (const g of offeringGroups) {
			if (groupIds.has(g.id)) {
				throw new Error(
					`Offering group id "${g.id}" collides with an enrollment-fixture group id.`,
				);
			}
		}
	}

	// Complementary credits: only APPROVED rows of a COMPLEMENTARY subject
	// count. ENROLLED is not yet earned, and the dataset states the rule
	// (requiredForGraduation) rather than a per-student total.
	const complementaryById = new Map(
		dataset.subjects.filter((s) => s.component === "COMPLEMENTARY").map((s) => [s.canonicalId, s]),
	);
	const complementaryActivities = (enrollment?.student_progress ?? [])
		.filter((r) => r.status === "APPROVED" && complementaryById.has(r.subjectCanonicalId))
		.map((r) => ({ canonicalId: r.subjectCanonicalId, period: r.period }));

	const header = [
		"-- OpenSIM seed (auto-generated by src/lib/server/db/seed.ts).",
		`-- Career: ${dataset.careerCode} — ${dataset.careerName}`,
		`-- Institution: ${dataset.institution}`,
		`-- Plan: ${dataset.planName} (${dataset.modality})`,
		`-- Plan version: ${dataset.version}`,
		`-- Total subjects: ${dataset.subjects.length}`,
		`-- Total credits (target): ${dataset.declaredTotalCredits}`,
		`-- Complementary credits required: ${dataset.complementaryCredits.requiredForGraduation}`,
		"-- Idempotent for data: catalog INSERTs use OR IGNORE; test-student",
		"-- rows use OR REPLACE so the fixture is deterministic on rerun.",
		"-- NOT idempotent for the login: the profile REPLACE is a DELETE, so",
		"-- it cascades into student_credentials. Run db:set-password after.",
		"",
	].join("\n");

	const sections: string[] = [
		header,
		insertCareers(dataset),
		insertSubjects(dataset.subjects),
		insertPrerequisites(edges),
		insertSubjectUnits(units),
		insertOfferingGroups(offeringGroups),
	];
	if (enrollment) {
		sections.push(
			"--> statement-breakpoint",
			// First, so the profile REPLACE's cascade into `course_groups`
			// has no NO ACTION child left to refuse it. See
			// `deleteEnrollmentScheduleBlocks`.
			deleteEnrollmentScheduleBlocks(),
			"--> statement-breakpoint",
			insertStudentProfile(enrollment.student_profile),
			"--> statement-breakpoint",
			insertStudentProgress(enrollment.controlNumber, enrollment.student_progress),
			"--> statement-breakpoint",
			insertCourseGroups(enrollment.controlNumber, enrollment.course_groups),
			"--> statement-breakpoint",
			insertScheduleBlocks(enrollment.course_schedule_blocks),
			"--> statement-breakpoint",
			insertComplementaryCreditActivities(enrollment.controlNumber, complementaryActivities),
		);
	}
	sections.push(insertFooter());
	const sql = sections.join("\n");

	mkdirSync(dirname(SEED_SQL_PATH), { recursive: true });
	writeFileSync(SEED_SQL_PATH, sql, "utf8");

	const subjectCount = dataset.subjects.length;
	const aliasCount = dataset.subjects.reduce((a, s) => a + (s.aliases?.length ?? 0), 0);
	const specialtyCount = dataset.specialties.length;
	const subtopicCount = units.reduce(
		(a, u) => a + (JSON.parse(u.subtopicsJson) as unknown[]).length,
		0,
	);
	const labSessionCount = offeringGroups.filter((g) => g.isLabSession).length;

	const counts = [
		`1 career`,
		`${subjectCount} subjects`,
		`${aliasCount} aliases`,
		`${dataset.prerequisites.length} prerequisites`,
		`${specialtyCount} specialties`,
		`${units.length} units (${subtopicCount} subtopics)`,
		`${offeringGroups.length} offering groups (${labSessionCount} lab sessions)`,
	];
	if (enrollment) {
		counts.push(
			`${enrollment.student_progress.length} progress rows`,
			`${enrollment.course_groups.length} student groups`,
			`${enrollment.course_schedule_blocks.length} schedule blocks`,
			`${complementaryActivities.length} complementary activities`,
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

import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * OpenSIM — Drizzle ORM Schema (12 normalized tables)
 *
 * Program: ISIC-2010-224 (Ingenieria en Sistemas Computacionales, TecNM Morelia)
 * See: odd/tasks/opensim.md §5.1 for canonical spec.
 *
 * v2.0 audit fixes applied:
 *  - studentProfiles.cursedCredits (typo) -> completedCredits
 *  - studentProfiles adds: passedAverage, inProgressCredits, enrollmentPeriod
 *  - studentProgress.status union includes 'LOCKED'
 *  - studentProfiles.socialService (semantic error) -> healthService
 *
 * Status enum (TypeScript union, enforced at app layer):
 *   'APPROVED' | 'ENROLLED' | 'AVAILABLE' | 'LOCKED'
 *
 * Evaluation type:
 *   'ORDINARIO' | 'REPETICION' | 'ESPECIAL'
 *
 * Conventions:
 *  - snake_case columns, camelCase TS fields
 *  - text('canonical_id').primaryKey() for stable slug-based PKs (CF-1)
 *  - text() for enum-like strings; runtime validation via Valibot at edge
 *  - boolean stored as integer('col', { mode: 'boolean' }) — SQLite at edge
 */

// 1. Carreras / Planes de Estudio
export const careers = sqliteTable("careers", {
	code: text("code").primaryKey(),
	name: text("name").notNull(),
	totalCredits: integer("total_credits").notNull().default(260),
	totalSemesters: integer("total_semesters").notNull().default(9),
});

// 2. Modulos de Especialidad
export const specialties = sqliteTable("specialties", {
	code: text("code").primaryKey(),
	careerCode: text("career_code")
		.notNull()
		.references(() => careers.code),
	name: text("name").notNull(),
});

// 3. Catalogo Unificado de Asignaturas (Nodo Base DAG)
export const subjects = sqliteTable("subjects", {
	canonicalId: text("canonical_id").primaryKey(),
	code: text("code").notNull().unique(),
	name: text("name").notNull(),
	// NULL where no source establishes the value: `area` is unclassified
	// across the whole verified plan (H4), and `semester`/`ht`/`hp` are
	// unknown for the 16 specialty modules (H8).
	semester: integer("semester"),
	ht: integer("ht"),
	hp: integer("hp"),
	credits: integer("credits").notNull(),
	area: text("area"),
	// 'UNKNOWN' is the honest default: the rows already in the database
	// were never classified against a seriation source.
	seriationState: text("seriation_state").notNull().default("UNKNOWN"),
	component: text("component").notNull().default("GENERIC"),
	specialtyCode: text("specialty_code").references(() => specialties.code),
});

// 4. Claves Alias / Historicas
export const subjectAliases = sqliteTable("subject_aliases", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	subjectCanonicalId: text("subject_canonical_id")
		.notNull()
		.references(() => subjects.canonicalId),
	aliasCode: text("alias_code").notNull().unique(),
});

// 5. Prerrequisitos (Aristas DAG) — composite PK (a,b)
export const subjectPrerequisites = sqliteTable(
	"subject_prerequisites",
	{
		subjectCanonicalId: text("subject_canonical_id")
			.notNull()
			.references(() => subjects.canonicalId),
		prerequisiteCanonicalId: text("prerequisite_canonical_id")
			.notNull()
			.references(() => subjects.canonicalId),
	},
	(table) => ({
		pk: primaryKey({
			columns: [table.subjectCanonicalId, table.prerequisiteCanonicalId],
		}),
	}),
);

// 6. Temarios (Unidades y Subtemas)
export const subjectUnits = sqliteTable("subject_units", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	subjectCanonicalId: text("subject_canonical_id")
		.notNull()
		.references(() => subjects.canonicalId),
	unitNumber: integer("unit_number").notNull(),
	title: text("title").notNull(),
	subtopicsJson: text("subtopics_json").notNull(),
});

// 7. Perfil de Estudiantes (FIXES v2.0 applied)
export const studentProfiles = sqliteTable("student_profiles", {
	controlNumber: text("control_number").primaryKey(),
	fullName: text("full_name").notNull(),
	curp: text("curp").notNull(),
	birthState: text("birth_state").notNull(),
	careerCode: text("career_code")
		.notNull()
		.references(() => careers.code),
	specialtyCode: text("specialty_code").references(() => specialties.code),
	currentSemester: integer("current_semester").notNull().default(1),
	certifiedAverage: real("certified_average").notNull().default(0.0),
	arithmeticAverage: real("arithmetic_average").notNull().default(0.0),
	passedAverage: real("passed_average").notNull().default(0.0),
	approvedCredits: integer("approved_credits").notNull().default(0),
	remainingCredits: integer("remaining_credits").notNull().default(260),
	completedCredits: integer("completed_credits").notNull().default(0),
	inProgressCredits: integer("in_progress_credits").notNull().default(0),
	advancePercentage: real("advance_percentage").notNull().default(0.0),
	status: text("status").notNull().default("Activo regular"),
	healthService: text("health_service").notNull().default("IMSS"),
	enrollmentPeriod: text("enrollment_period").notNull().default(""),
});

// 8. Historial Academico (FIX v2.0: status union includes LOCKED)
export const studentProgress = sqliteTable(
	"student_progress",
	{
		studentControlNumber: text("student_control_number")
			.notNull()
			.references(() => studentProfiles.controlNumber),
		subjectCanonicalId: text("subject_canonical_id")
			.notNull()
			.references(() => subjects.canonicalId),
		status: text("status").notNull(),
		grade: real("grade"),
		evaluationType: text("evaluation_type"),
		period: text("period").notNull(),
	},
	(table) => ({
		// `period` is part of the key: a student holds one row per subject
		// PER PERIOD, not per subject for all time. Without it a student
		// can never re-take a failed subject nor re-enrol the same subject
		// in a later term — and the enrol action's multi-value INSERT
		// raises an unhandled PRIMARY KEY violation (500) whenever the
		// subject already has a row from a prior period.
		pk: primaryKey({
			columns: [table.studentControlNumber, table.subjectCanonicalId, table.period],
		}),
	}),
);

// 9. Oferta de Grupos
export const courseGroups = sqliteTable(
	"course_groups",
	{
		id: text("id").primaryKey(),
		subjectCanonicalId: text("subject_canonical_id")
			.notNull()
			.references(() => subjects.canonicalId),
		groupCode: text("group_code").notNull(),
		teacherName: text("teacher_name").notNull(),
		hasLab: integer("has_lab", { mode: "boolean" }).notNull().default(false),
	},
	(table) => ({
		// Hot path: the enrollment helper joins course_groups on
		// subjectCanonicalId for the student's enrolled set. Without
		// this index the join is a full table scan (audit M2, Round 4).
		subjectCanonicalIdx: index("idx_course_groups_subject_canonical").on(table.subjectCanonicalId),
	}),
);

// 10. Bloques de Horario
export const courseScheduleBlocks = sqliteTable(
	"course_schedule_blocks",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		groupId: text("group_id")
			.notNull()
			.references(() => courseGroups.id),
		day: text("day").notNull(),
		startTime: text("start_time").notNull(),
		endTime: text("end_time").notNull(),
		classroom: text("classroom").notNull(),
	},
	(table) => ({
		// Hot path: the enrollment helper fetches blocks for the
		// student's groups (`inArray(groupId, ...)`); this index
		// turns that into a single index range scan instead of a
		// full table scan (audit M2, Round 4).
		groupIdx: index("idx_course_schedule_blocks_group").on(table.groupId),
		// Day-letter filter is the secondary predicate; an index
		// here keeps \"classes for today\" cheap even as the schedule
		// grows across careers.
		dayIdx: index("idx_course_schedule_blocks_day").on(table.day),
	}),
);

// 11. Credenciales de Acceso (PBKDF2 / SHA-256 via Web Crypto API)
//
// Stores the PBKDF2-derived key, salt, and iteration count for each
// student. Hash and salt are base64url-encoded. passwordUpdatedAt is
// nullable (set on rotation). No email/username column: the control
// number is the credential identifier. The FK to `student_profiles`
// is `ON DELETE CASCADE` (audit A5/A6, Phase 2.5): when a student
// profile is removed (egreso, control-number correction), the
// credential row goes with it.
export const studentCredentials = sqliteTable("student_credentials", {
	controlNumber: text("control_number")
		.primaryKey()
		.references(() => studentProfiles.controlNumber, { onDelete: "cascade" }),
	passwordHash: text("password_hash").notNull(),
	passwordSalt: text("password_salt").notNull(),
	passwordIterations: integer("password_iterations").notNull().default(10000),
	passwordUpdatedAt: integer("password_updated_at", { mode: "timestamp" }),
});

// 12. Sesiones de Autenticacion (cookie-backed)
//
// `id` is the SHA-256 of the random session token (base64url). The
// raw token is held only in the HttpOnly cookie; the database stores
// a one-way digest so a D1 dump does not yield usable tokens.
// Rows are invalidated by DELETE on logout or expiry. userAgent /
// ipHash are stored as opaque strings; ipHash is a SHA-256 of the
// source IP, optionally peppered with a per-deployment secret — the raw
// IP never lands in the database, but note that an UNPEPPERED digest is
// brute-forceable across the whole IPv4 space, so it is pseudonymisation
// rather than anonymisation. See `hashIp` in src/lib/server/auth.ts.
//
// The FK to `student_profiles` is `ON DELETE CASCADE`: when a student
// profile is removed (egreso, control-number correction), every
// session row for that student goes with it. Pruning of expired
// sessions is supported by the `idx_auth_sessions_expires_at` index;
// "log out all devices" for a given student is supported by the
// `idx_auth_sessions_student` index and implemented as
// `invalidateAllSessions` in src/lib/server/auth.ts.
export const authSessions = sqliteTable(
	"auth_sessions",
	{
		id: text("id").primaryKey(),
		studentControlNumber: text("student_control_number")
			.notNull()
			.references(() => studentProfiles.controlNumber, { onDelete: "cascade" }),
		expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
		userAgent: text("user_agent"),
		ipHash: text("ip_hash"),
	},
	(table) => ({
		expiresAtIdx: index("idx_auth_sessions_expires_at").on(table.expiresAt),
		studentIdx: index("idx_auth_sessions_student").on(table.studentControlNumber),
	}),
);

// 13. Auth Attempts (login rate limiting).
//
// Counters for failed login attempts, scoped by `attempt_key`. Keys are
// two flavors — `control:<8-digit-control>` for per-account throttling
// and `ip:<sha256(ip)>` for per-network throttling — both shapes make
// enumeration of the 8-digit controlNumber enumerable-but-costly. The
// window is a sliding 15-minute look-back at check time (see
// src/lib/server/auth.ts `isRateLimited`).
//
// Rows are written via `recordFailedAttempt` and cleared on a
// successful login (or by the daily scheduled prune). `window_start`
// is a unix timestamp aligned to the bucket; `attempt_count` is the
// running counter for that bucket.
//
// ponytail: per-bucket row count is unbounded by design — a single
// account with a long history of failed attempts will accumulate one
// row per 15-min window. At 5 attempts/window, a single attacker
// produces ~4 rows/day, ~1.5k rows/year. Within D1 free-tier budget
// for the next decade; revisit when adding a janitor.
export const authAttempts = sqliteTable(
	"auth_attempts",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		attemptKey: text("attempt_key").notNull(),
		windowStart: integer("window_start", { mode: "timestamp" }).notNull(),
		attemptCount: integer("attempt_count").notNull().default(1),
	},
	(table) => ({
		// Hot path for `isRateLimited`: WHERE attempt_key = ? AND
		// window_start >= now() - 15min. The composite index collapses
		// that into a single range scan per lookup.
		attemptKeyWindowIdx: index("idx_auth_attempts_key_window").on(
			table.attemptKey,
			table.windowStart,
		),
		// UNIQUE (not a plain index): `recordFailedAttempt` upserts with
		// ON CONFLICT (attempt_key, window_start) DO UPDATE, and that
		// clause needs a matching unique constraint to fire. D1 refuses
		// BEGIN/SAVEPOINT, so the previous read-then-write inside
		// db.transaction could never commit — the counter was silently
		// dropped and the lockout was inert in production.
		attemptKeyWindowUnique: uniqueIndex("uq_auth_attempts_key_window").on(
			table.attemptKey,
			table.windowStart,
		),
	}),
);

// ---- Type exports for app layer ----

export type Career = typeof careers.$inferSelect;
export type NewCareer = typeof careers.$inferInsert;

export type Specialty = typeof specialties.$inferSelect;
export type NewSpecialty = typeof specialties.$inferInsert;

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export type SubjectAlias = typeof subjectAliases.$inferSelect;
export type NewSubjectAlias = typeof subjectAliases.$inferInsert;

export type SubjectPrerequisite = typeof subjectPrerequisites.$inferSelect;
export type NewSubjectPrerequisite = typeof subjectPrerequisites.$inferInsert;

export type SubjectUnit = typeof subjectUnits.$inferSelect;
export type NewSubjectUnit = typeof subjectUnits.$inferInsert;

export type StudentProfile = typeof studentProfiles.$inferSelect;
export type NewStudentProfile = typeof studentProfiles.$inferInsert;

export type StudentProgress = typeof studentProgress.$inferSelect;
export type NewStudentProgress = typeof studentProgress.$inferInsert;

export type CourseGroup = typeof courseGroups.$inferSelect;
export type NewCourseGroup = typeof courseGroups.$inferInsert;

export type CourseScheduleBlock = typeof courseScheduleBlocks.$inferSelect;
export type NewCourseScheduleBlock = typeof courseScheduleBlocks.$inferInsert;

export type StudentCredential = typeof studentCredentials.$inferSelect;
export type NewStudentCredential = typeof studentCredentials.$inferInsert;

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;

// ---- Status union (TypeScript-side enforcement; SQLite stores TEXT) ----

export const STUDENT_PROGRESS_STATUSES = ["APPROVED", "ENROLLED", "AVAILABLE", "LOCKED"] as const;
export type StudentProgressStatus = (typeof STUDENT_PROGRESS_STATUSES)[number];

// ---- Subject domain unions (TypeScript-side enforcement; SQLite stores TEXT) ----

// `UNKNOWN` means "not established from a source", NOT "not serialized".
export const SUBJECT_SERIATION_STATES = ["SERIALIZED", "INDEPENDENT", "UNKNOWN"] as const;
export type SubjectSeriationState = (typeof SUBJECT_SERIATION_STATES)[number];

export const SUBJECT_COMPONENTS = ["GENERIC", "COMPLEMENTARY", "PRACTICE", "SPECIALTY"] as const;
export type SubjectComponent = (typeof SUBJECT_COMPONENTS)[number];

// Evaluation types live in `#lib/utils/academic` (client-safe home)
// so the kardex UI can read the array at runtime without dragging
// the server-only schema into the browser bundle. Re-exported here
// for backward compatibility with any server code that imports from
// the schema path.
export { EVALUATION_TYPES, type EvaluationType } from "#lib/utils/academic";

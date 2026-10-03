import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

/**
 * OpenSIM — Drizzle ORM Schema (10 normalized tables)
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
export const careers = sqliteTable('careers', {
	code: text('code').primaryKey(),
	name: text('name').notNull(),
	totalCredits: integer('total_credits').notNull().default(260),
	totalSemesters: integer('total_semesters').notNull().default(9)
});

// 2. Modulos de Especialidad
export const specialties = sqliteTable('specialties', {
	code: text('code').primaryKey(),
	careerCode: text('career_code')
		.notNull()
		.references(() => careers.code),
	name: text('name').notNull()
});

// 3. Catalogo Unificado de Asignaturas (Nodo Base DAG)
export const subjects = sqliteTable('subjects', {
	canonicalId: text('canonical_id').primaryKey(),
	code: text('code').notNull().unique(),
	name: text('name').notNull(),
	semester: integer('semester').notNull(),
	ht: integer('ht').notNull(),
	hp: integer('hp').notNull(),
	credits: integer('credits').notNull(),
	area: text('area').notNull(),
	specialtyCode: text('specialty_code').references(() => specialties.code)
});

// 4. Claves Alias / Historicas
export const subjectAliases = sqliteTable(
	'subject_aliases',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		subjectCanonicalId: text('subject_canonical_id')
			.notNull()
			.references(() => subjects.canonicalId),
		aliasCode: text('alias_code').notNull().unique()
	}
);

// 5. Prerrequisitos (Aristas DAG) — composite PK (a,b)
export const subjectPrerequisites = sqliteTable(
	'subject_prerequisites',
	{
		subjectCanonicalId: text('subject_canonical_id')
			.notNull()
			.references(() => subjects.canonicalId),
		prerequisiteCanonicalId: text('prerequisite_canonical_id')
			.notNull()
			.references(() => subjects.canonicalId)
	},
	(table) => ({
		pk: primaryKey({
			columns: [table.subjectCanonicalId, table.prerequisiteCanonicalId]
		})
	})
);

// 6. Temarios (Unidades y Subtemas)
export const subjectUnits = sqliteTable(
	'subject_units',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		subjectCanonicalId: text('subject_canonical_id')
			.notNull()
			.references(() => subjects.canonicalId),
		unitNumber: integer('unit_number').notNull(),
		title: text('title').notNull(),
		subtopicsJson: text('subtopics_json').notNull()
	}
);

// 7. Perfil de Estudiantes (FIXES v2.0 applied)
export const studentProfiles = sqliteTable('student_profiles', {
	controlNumber: text('control_number').primaryKey(),
	fullName: text('full_name').notNull(),
	curp: text('curp').notNull(),
	birthState: text('birth_state').notNull(),
	careerCode: text('career_code')
		.notNull()
		.references(() => careers.code),
	specialtyCode: text('specialty_code').references(() => specialties.code),
	currentSemester: integer('current_semester').notNull().default(1),
	certifiedAverage: real('certified_average').notNull().default(0.0),
	arithmeticAverage: real('arithmetic_average').notNull().default(0.0),
	passedAverage: real('passed_average').notNull().default(0.0),
	approvedCredits: integer('approved_credits').notNull().default(0),
	remainingCredits: integer('remaining_credits').notNull().default(260),
	completedCredits: integer('completed_credits').notNull().default(0),
	inProgressCredits: integer('in_progress_credits').notNull().default(0),
	advancePercentage: real('advance_percentage').notNull().default(0.0),
	status: text('status').notNull().default('Activo regular'),
	healthService: text('health_service').notNull().default('IMSS'),
	enrollmentPeriod: text('enrollment_period').notNull().default('')
});

// 8. Historial Academico (FIX v2.0: status union includes LOCKED)
export const studentProgress = sqliteTable(
	'student_progress',
	{
		studentControlNumber: text('student_control_number')
			.notNull()
			.references(() => studentProfiles.controlNumber),
		subjectCanonicalId: text('subject_canonical_id')
			.notNull()
			.references(() => subjects.canonicalId),
		status: text('status').notNull(),
		grade: real('grade'),
		evaluationType: text('evaluation_type'),
		period: text('period').notNull()
	},
	(table) => ({
		pk: primaryKey({
			columns: [table.studentControlNumber, table.subjectCanonicalId]
		})
	})
);

// 9. Oferta de Grupos
export const courseGroups = sqliteTable('course_groups', {
	id: text('id').primaryKey(),
	subjectCanonicalId: text('subject_canonical_id')
		.notNull()
		.references(() => subjects.canonicalId),
	groupCode: text('group_code').notNull(),
	teacherName: text('teacher_name').notNull(),
	hasLab: integer('has_lab', { mode: 'boolean' }).notNull().default(false)
});

// 10. Bloques de Horario
export const courseScheduleBlocks = sqliteTable('course_schedule_blocks', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	groupId: text('group_id')
		.notNull()
		.references(() => courseGroups.id),
	day: text('day').notNull(),
	startTime: text('start_time').notNull(),
	endTime: text('end_time').notNull(),
	classroom: text('classroom').notNull()
});

// 11. Credenciales de Acceso (PBKDF2 / SHA-256 via Web Crypto API)
//
// Stores the PBKDF2-derived key, salt, and iteration count for each
// student. Hash and salt are base64url-encoded. passwordUpdatedAt is
// nullable (set on rotation). No email/username column: the control
// number is the credential identifier.
export const studentCredentials = sqliteTable('student_credentials', {
	controlNumber: text('control_number')
		.primaryKey()
		.references(() => studentProfiles.controlNumber),
	passwordHash: text('password_hash').notNull(),
	passwordSalt: text('password_salt').notNull(),
	passwordIterations: integer('password_iterations').notNull().default(100000),
	passwordUpdatedAt: integer('password_updated_at', { mode: 'timestamp' })
});

// 12. Sesiones de Autenticacion (cookie-backed)
//
// `id` is the random session token stored in the HttpOnly cookie. Rows
// are invalidated by DELETE on logout or expiry. userAgent / ipHash are
// stored as opaque strings; ipHash is a SHA-256 of the source IP for
// privacy (the raw IP never lands in the database).
export const authSessions = sqliteTable('auth_sessions', {
	id: text('id').primaryKey(),
	studentControlNumber: text('student_control_number')
		.notNull()
		.references(() => studentProfiles.controlNumber),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	userAgent: text('user_agent'),
	ipHash: text('ip_hash')
});

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

export const STUDENT_PROGRESS_STATUSES = ['APPROVED', 'ENROLLED', 'AVAILABLE', 'LOCKED'] as const;
export type StudentProgressStatus = (typeof STUDENT_PROGRESS_STATUSES)[number];

export const EVALUATION_TYPES = ['ORDINARIO', 'REPETICION', 'ESPECIAL'] as const;
export type EvaluationType = (typeof EVALUATION_TYPES)[number];
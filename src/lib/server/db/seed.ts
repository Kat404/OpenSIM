#!/usr/bin/env node
/**
 * OpenSIM — Curriculum seed script.
 *
 * Reads `src/lib/server/db/data/curriculum-isic-2010-224.json` and emits a
 * SQL file (`src/lib/server/db/seed.sql`) containing idempotent INSERT OR
 * IGNORE batches for: careers, specialties, subjects, subject_aliases,
 * subject_prerequisites.
 *
 * The generated SQL is applied via:
 *   pnpm db:seed     -> generates + executes wrangler d1 execute --local
 *   pnpm db:seed:gen -> only generates seed.sql (used in CI / manual ops)
 *
 * Idempotency strategy:
 *   - Every table insert uses INSERT OR IGNORE (relying on the unique /
 *     primary-key constraints declared in schema.ts).
 *   - Alias uniqueness is also enforced at the SQL level.
 *   - FK ordering: parents first, then children.
 *
 * Why a generated SQL file (and not a Drizzle ORM runtime call)?
 *   - D1 is the Cloudflare SQLite edge store; Drizzle ORM cannot connect
 *     directly from Node. The standard pattern is to emit SQL and let
 *     `wrangler d1 execute --file=...` apply it via Miniflare locally and
 *     via the D1 HTTP API remotely.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

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

// ---------- Path helpers (ESM-safe) ----------

const here = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(here, 'data/curriculum-isic-2010-224.json');
const SEED_SQL_PATH = resolve(here, 'seed.sql');

// ---------- SQL escaping (single-quoted string literal) ----------

function sqlStr(v: string): string {
	return `'${v.replace(/'/g, "''")}'`;
}

function sqlNum(n: number): string {
	return Number.isFinite(n) ? String(n) : 'NULL';
}

function sqlNullableStr(v: string | undefined): string {
	return v === undefined || v === '' ? 'NULL' : sqlStr(v);
}

// ---------- SQL builders ----------

function insertCareers(careers: CareerDataset[]): string {
	const lines: string[] = ['-- careers'];
	for (const c of careers) {
		lines.push(
			`INSERT OR IGNORE INTO careers (code, name, total_credits, total_semesters) VALUES (${sqlStr(c.code)}, ${sqlStr(c.name)}, ${sqlNum(c.totalCredits)}, ${sqlNum(c.totalSemesters)});`
		);
		lines.push('--> statement-breakpoint');
		for (const s of c.specialties) {
			lines.push(
				`INSERT OR IGNORE INTO specialties (code, career_code, name) VALUES (${sqlStr(s.code)}, ${sqlStr(c.code)}, ${sqlStr(s.name)});`
			);
			lines.push('--> statement-breakpoint');
		}
	}
	return lines.join('\n');
}

function insertSubjects(subjects: SubjectDataset[]): string {
	const lines: string[] = ['-- subjects'];
	for (const s of subjects) {
		lines.push(
			`INSERT OR IGNORE INTO subjects (canonical_id, code, name, semester, ht, hp, credits, area, specialty_code) VALUES (${sqlStr(s.canonicalId)}, ${sqlStr(s.code)}, ${sqlStr(s.name)}, ${sqlNum(s.semester)}, ${sqlNum(s.ht)}, ${sqlNum(s.hp)}, ${sqlNum(s.credits)}, ${sqlStr(s.area)}, ${sqlNullableStr(s.specialtyCode)});`
		);
		lines.push('--> statement-breakpoint');
		for (const alias of s.aliases ?? []) {
			lines.push(
				`INSERT OR IGNORE INTO subject_aliases (subject_canonical_id, alias_code) VALUES (${sqlStr(s.canonicalId)}, ${sqlStr(alias)});`
			);
			lines.push('--> statement-breakpoint');
		}
		for (const prereq of s.prerequisites ?? []) {
			lines.push(
				`INSERT OR IGNORE INTO subject_prerequisites (subject_canonical_id, prerequisite_canonical_id) VALUES (${sqlStr(s.canonicalId)}, ${sqlStr(prereq)});`
			);
			lines.push('--> statement-breakpoint');
		}
	}
	return lines.join('\n');
}

function insertFooter(): string {
	return [
		'--> statement-breakpoint',
		'-- verification queries (informational, no-op)',
		'SELECT COUNT(*) AS careers FROM careers;',
		'--> statement-breakpoint',
		'SELECT COUNT(*) AS specialties FROM specialties;',
		'--> statement-breakpoint',
		'SELECT COUNT(*) AS subjects FROM subjects;',
		'--> statement-breakpoint',
		'SELECT COUNT(*) AS aliases FROM subject_aliases;',
		'--> statement-breakpoint',
		'SELECT COUNT(*) AS prerequisites FROM subject_prerequisites;',
		''
	].join('\n');
}

// ---------- Main ----------

function main(): void {
	const raw = readFileSync(DATA_PATH, 'utf8');
	const dataset = JSON.parse(raw) as Dataset;

	// Sanity assertions (fail loud if the dataset is malformed).
	if (!Array.isArray(dataset.careers) || dataset.careers.length === 0) {
		throw new Error('Dataset must contain at least one career.');
	}
	if (!Array.isArray(dataset.subjects) || dataset.subjects.length === 0) {
		throw new Error('Dataset must contain at least one subject.');
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
					`Prerequisite ${p} for subject ${s.canonicalId} does not exist in dataset (forward reference).`
				);
			}
		}
	}
	const careerCodes = new Set(dataset.careers.map((c) => c.code));
	for (const c of dataset.careers) {
		for (const s of c.specialties) {
			// No FK to enforce here, but ensure specialty uniqueness.
			if (dataset.careers.some((other) => other.specialties.some((os) => os.code === s.code && other.code !== c.code))) {
				throw new Error(`Specialty code ${s.code} is bound to multiple careers.`);
			}
			void careerCodes; // referenced for clarity
		}
	}

	const header = [
		'-- OpenSIM curriculum seed (auto-generated by src/lib/server/db/seed.ts).',
		`-- Program: ${dataset.program}`,
		`-- Plan: ${dataset.version}`,
		`-- Total subjects: ${dataset.subjects.length}`,
		`-- Total credits (target): ${dataset.totalCredits}`,
		'-- Idempotent: every INSERT uses OR IGNORE on the unique/PK constraints.',
		''
	].join('\n');

	const sql = header + '\n' + insertCareers(dataset.careers) + '\n' + insertSubjects(dataset.subjects) + '\n' + insertFooter();

	mkdirSync(dirname(SEED_SQL_PATH), { recursive: true });
	writeFileSync(SEED_SQL_PATH, sql, 'utf8');

	const subjectCount = dataset.subjects.length;
	const aliasCount = dataset.subjects.reduce((a, s) => a + (s.aliases?.length ?? 0), 0);
	const prereqCount = dataset.subjects.reduce((a, s) => a + (s.prerequisites?.length ?? 0), 0);
	const specialtyCount = dataset.careers.reduce((a, c) => a + c.specialties.length, 0);

	console.log(`seed.sql generated (${subjectCount} subjects, ${aliasCount} aliases, ${prereqCount} prerequisites, ${specialtyCount} specialties).`);
	console.log(`Path: ${SEED_SQL_PATH}`);
}

main();

// ---------- Apply via wrangler d1 execute ----------

/**
 * If invoked with --apply, pipe seed.sql into wrangler d1 execute --local.
 * D1's local backend is Miniflare; --remote targets the production D1.
 */
if (process.argv.includes('--apply')) {
	const remoteFlag = process.argv.includes('--remote') ? ' --remote' : ' --local';
	const cmd = `pnpm exec wrangler d1 execute opensim${remoteFlag} --file=${SEED_SQL_PATH}`;
	console.log(`Applying via: ${cmd}`);
	execSync(cmd, { stdio: 'inherit', cwd: resolve(here, '../../..') });
}

export { SEED_SQL_PATH, DATA_PATH };
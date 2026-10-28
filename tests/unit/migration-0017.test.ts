/**
 * Migration 0017 — `subject_aliases` goes (S8 / T6).
 *
 * The table was written by the seed and read by nobody, so the
 * migration drops it. What this file pins is the part that could
 * actually hurt: dropping a table must not take a row with it, and
 * the seed must stop writing into the table it no longer owns.
 */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const DIR = fileURLToPath(new URL("../../drizzle/", import.meta.url));
const SEED = fileURLToPath(new URL("../../src/lib/server/db/seed.sql", import.meta.url));
const SCHEMA = fileURLToPath(new URL("../../src/lib/server/db/schema.ts", import.meta.url));

/** Apply `drizzle/*.sql` up to and including the file named by `until`. */
function migratedThrough(until: string): DatabaseSync {
	const db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	for (const file of readdirSync(DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort()) {
		if (file.slice(0, 4) > until) continue;
		db.exec(readFileSync(`${DIR}${file}`, "utf8"));
	}
	return db;
}

function counts(db: DatabaseSync): Record<string, number> {
	const out: Record<string, number> = {};
	for (const table of [
		"subjects",
		"subject_units",
		"course_groups",
		"student_progress",
		"complementary_credit_activities",
	]) {
		const row = db.prepare(`SELECT count(*) AS c FROM ${table}`).get() as { c: number };
		out[table] = row.c;
	}
	return out;
}

describe("migration 0017", () => {
	it("drops subject_aliases and leaves every other row alone", () => {
		const db = migratedThrough("0016");
		db.exec("INSERT INTO careers (code, name) VALUES ('ISC-2010-224', 'Sistemas');");
		db.exec(
			`INSERT INTO student_profiles (control_number, full_name, curp, birth_state, career_code)
			 VALUES ('12345678', 'Panfilo Ruiz', 'SYNTH0000000000', 'SIN', 'ISC-2010-224');`,
		);
		db.exec(
			`INSERT INTO subjects (canonical_id, code, name, credits, component)
			 VALUES ('itm-100', 'ITM-100', 'Tutoría', 0, 'COMPLEMENTARY');`,
		);
		db.exec(
			`INSERT INTO subject_units (subject_canonical_id, unit_number, title, subtopics_json)
			 VALUES ('itm-100', 1, 'Unidad 1', '[]');`,
		);
		db.exec(
			`INSERT INTO course_groups (id, subject_canonical_id, group_code, teacher_name)
			 VALUES ('itm-100|1|A', 'itm-100', 'G-ITM-100-1', 'DOC-001');`,
		);
		db.exec(
			`INSERT INTO student_progress (student_control_number, subject_canonical_id, status, period)
			 VALUES ('12345678', 'itm-100', 'ENROLLED', 'AGOSTO-DICIEMBRE/2022');`,
		);
		db.exec(
			`INSERT INTO complementary_credit_activities
			 (student_control_number, subject_canonical_id, period) VALUES ('12345678', 'itm-100', 'AGOSTO-DICIEMBRE/2022');`,
		);
		// The table the migration is about, with a row in it.
		db.exec(
			`INSERT INTO subject_aliases (subject_canonical_id, alias_code) VALUES ('itm-100', 'ITM-999');`,
		);

		const before = counts(db);
		db.exec(readFileSync(`${DIR}0017_drop_subject_aliases.sql`, "utf8"));

		expect(counts(db)).toEqual(before);
		expect(
			db.prepare("SELECT name FROM sqlite_master WHERE name = 'subject_aliases'").all(),
		).toEqual([]);
		expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
		expect(db.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
	});

	it("is idempotent: applying it twice is a no-op", () => {
		const db = migratedThrough("0016");
		const sql = readFileSync(`${DIR}0017_drop_subject_aliases.sql`, "utf8");
		db.exec(sql);
		expect(() => db.exec(sql)).not.toThrow();
	});

	it("the seed no longer writes into the table it dropped", () => {
		const seed = readFileSync(SEED, "utf8");
		expect(seed).not.toContain("subject_aliases");
		expect(readFileSync(SCHEMA, "utf8")).not.toContain("subject_aliases");
	});
});

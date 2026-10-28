/**
 * Migration 0016 — the complementary credit moves from the subject to the
 * ACTIVITY (Phase 10 S1, operator 2026-10-15).
 *
 * This exists because the first draft of 0016 opened with a
 * `DELETE FROM complementary_credit_activities` copied from 0009's rebuild of
 * the PARENT `subjects`. A DELETE placed before the `INSERT … SELECT` leaves
 * that SELECT with no rows to copy, so the migration applied cleanly and left
 * the seeded student at 0 complementary credits instead of 3. Nothing caught
 * it: `tests/unit/protected-loaders.test.ts` applies every migration to an
 * EMPTY database, where there are no rows to lose, and the Playwright suite
 * asserts no credit number at all.
 */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const DIR = fileURLToPath(new URL("../../drizzle/", import.meta.url));

/** Apply `drizzle/*.sql` up to and including the file named by `until`. */
function migratedThrough(until: string): DatabaseSync {
	const db = new DatabaseSync(":memory:");
	// D1 enforces foreign keys; a no-op pragma here would hide a broken rebuild.
	db.exec("PRAGMA foreign_keys = ON");
	for (const file of readdirSync(DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort()) {
		if (file.slice(0, 4) > until) continue;
		db.exec(readFileSync(`${DIR}${file}`, "utf8"));
	}
	return db;
}

/** One profile the activity rows can hang off; the career is its own FK. */
function seedProfile(db: DatabaseSync): void {
	db.exec("INSERT INTO careers (code, name) VALUES ('ISC-2010-224', 'Sistemas');");
	db.exec(
		`INSERT INTO student_profiles (control_number, full_name, curp, birth_state, career_code)
		 VALUES ('12345678', 'Panfilo Ruiz', 'SYNTH0000000000', 'SIN', 'ISC-2010-224');`,
	);
}

describe("migration 0016", () => {
	it("carries every complementary activity across instead of dropping it", () => {
		const before = migratedThrough("0015");
		seedProfile(before);
		before.exec(
			`INSERT INTO subjects (canonical_id, code, name, credits, component)
			 VALUES ('itm-100', 'ITM-100', 'Tutoría', 0, 'COMPLEMENTARY');`,
		);
		before
			.prepare(
				`INSERT INTO complementary_credit_activities
					(student_control_number, subject_canonical_id, period) VALUES (?, ?, ?)`,
			)
			.run("12345678", "itm-100", "AGOSTO-DICIEMBRE/2022");

		before.exec(readFileSync(`${DIR}0016_activity_credit_weight.sql`, "utf8"));

		const rows = before
			.prepare(
				`SELECT student_control_number AS student, subject_canonical_id AS subject,
					period, credits FROM complementary_credit_activities`,
			)
			.all();
		// Same row, and the operator's dictum gives a transversal subject 1.
		expect(rows).toEqual([
			{
				student: "12345678",
				subject: "itm-100",
				period: "AGOSTO-DICIEMBRE/2022",
				credits: 1,
			},
		]);
	});

	it("drops subjects.complementary_credits without harming the rest of subjects", () => {
		const db = migratedThrough("0016");
		expect(
			db
				.prepare(
					"SELECT count(*) AS c FROM pragma_table_info('subjects') WHERE name = 'complementary_credits'",
				)
				.get(),
		).toEqual({ c: 0 });
		expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
		expect(db.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
	});

	it("lets an activity exist with no subject, and refuses a negative credit", () => {
		const db = migratedThrough("0016");
		seedProfile(db);
		const ins = db.prepare(
			`INSERT INTO complementary_credit_activities
				(student_control_number, subject_canonical_id, period, credits) VALUES (?, NULL, ?, ?)`,
		);
		expect(ins.run("12345678", "P1", 5).changes).toBe(1);
		// The withdrawn seed validator used to reject a negative weight at the
		// subject; the CHECK is the same guard at the row it moved to. A weight
		// ABOVE 1 stays legal on purpose: a 5-credit course completes the block.
		expect(() => ins.run("12345678", "P2", -3)).toThrow(/CHECK constraint failed/);
		expect(() => ins.run("12345678", "P3", 0)).toThrow(/CHECK constraint failed/);
	});
});

-- Migration 0009 — replace the fabricated catalog with the verified one.
--
-- Hand-written. drizzle-kit cannot emit this: 0.31.11's
-- `SQLiteRecreateTableConvertor` copies every column of the NEW table into
-- its `INSERT`, and D1 treats `PRAGMA foreign_keys=OFF` as a no-op, so its
-- rebuild is inapplicable whenever the parent table has rows in a child.
--
-- No backup table and no `defer_foreign_keys` either. Nothing is worth
-- preserving: the 42 subjects in the database are the fabricated catalog,
-- every `canonical_id` they carry dies with them, and the 14 verified
-- prerequisite edges replace all 57 invented ones. Emptying the children
-- first removes the foreign-key problem outright.
--
-- Consequence to know about before applying: `careers` and `specialties`
-- cannot be emptied while `student_profiles` references them, so the demo
-- student row and its credential go too. `pnpm run db:seed:apply` restores
-- the profile; `pnpm run db:set-password` must be re-run for the login.
--
-- `area` loses its NOT NULL because the verified dataset classifies no
-- subject into a curricular area (H4, no source). `semester`, `ht` and `hp`
-- lose theirs for the same reason and for the same subset: all 16
-- specialty subjects carry NULL there because the semester a specialty
-- module is taken in is not published (H8).

DELETE FROM `course_schedule_blocks`;
--> statement-breakpoint
DELETE FROM `course_groups`;
--> statement-breakpoint
DELETE FROM `student_progress`;
--> statement-breakpoint
DELETE FROM `subject_prerequisites`;
--> statement-breakpoint
DELETE FROM `subject_aliases`;
--> statement-breakpoint
DELETE FROM `subject_units`;
--> statement-breakpoint
DELETE FROM `subjects`;
--> statement-breakpoint
DELETE FROM `auth_sessions`;
--> statement-breakpoint
DELETE FROM `student_credentials`;
--> statement-breakpoint
DELETE FROM `student_profiles`;
--> statement-breakpoint
DELETE FROM `specialties`;
--> statement-breakpoint
DELETE FROM `careers`;
--> statement-breakpoint
CREATE TABLE `subjects_new` (
	`canonical_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`semester` integer,
	`ht` integer,
	`hp` integer,
	`credits` integer NOT NULL,
	`area` text,
	`specialty_code` text,
	`seriation_state` text DEFAULT 'UNKNOWN' NOT NULL,
	`component` text DEFAULT 'GENERIC' NOT NULL,
	FOREIGN KEY (`specialty_code`) REFERENCES `specialties`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP TABLE `subjects`;
--> statement-breakpoint
ALTER TABLE `subjects_new` RENAME TO `subjects`;
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_code_unique` ON `subjects` (`code`);
--> statement-breakpoint
PRAGMA foreign_key_check;
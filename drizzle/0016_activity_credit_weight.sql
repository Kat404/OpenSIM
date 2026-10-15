-- Migration 0016 — the complementary credit belongs to the ACTIVITY, not to the
-- subject.
--
-- Operator, 2026-10-15, textual: "Que las materias den un solo créditos
-- complementario está correcto. Las materias no son la única forma de obtenerlos
-- debido a que puede obtener créditos mediante cursos, talleres, participaciones
-- externas y demás. Recordemos que si NO cursa dichas materias COMPLEMENTARIAS aún
-- podría reunir 5 créditos complementarios mediante actividades externas a las
-- materias." — and, on the model: "El peso va en la ACTIVIDAD".
--
-- 0015 put the weight on `subjects.complementary_credits` and set ITM-101 = 2 so
-- the four transversals would add up to the block of 5. The 2 was an invention to
-- make a wrong model sum; the four carry 1 each and add up to 4, and the fifth
-- credit has no subject to come from. So `subjects.complementary_credits` goes
-- away and the credit moves to the row that actually represents the earning.
--
-- Rebuild, not ALTER: SQLite cannot relax a NOT NULL, and `subject_canonical_id`
-- must become nullable so an activity can exist without a subject — a course, a
-- workshop or an outside participation belongs to none of the four transversals.
-- That is why this is hand-written: drizzle-kit's SQLiteRecreateTableConvertor
-- copies the OLD table's columns and D1 treats `PRAGMA foreign_keys=OFF` as a
-- no-op, so its rebuild cannot express this change.
--
-- The table is NOT emptied first, and that is the whole reason it differs from
-- 0009: 0009 rebuilt the PARENT `subjects` and had to clear its children, while
-- this rebuilds a LEAF that nothing has a foreign key pointing at. A DELETE here
-- would run before the INSERT…SELECT and leave that SELECT with nothing to copy,
-- quietly rewriting the seeded student from 3 complementary credits to 0.
--
-- The rows carry over at 1 credit each, which is what the operator's dictum gives
-- every complementary subject. The seeded student holds itm-100, itm-104 and
-- itm-105, so the number it sees does not move; itm-101 is ENROLLED there and
-- was never an activity.

CREATE TABLE `__new_complementary_credit_activities` (
	`student_control_number` text NOT NULL,
	`subject_canonical_id` text,
	`period` text NOT NULL,
	`credits` integer DEFAULT 1 NOT NULL CHECK(`credits` >= 1),
	PRIMARY KEY(`student_control_number`, `subject_canonical_id`, `period`),
	FOREIGN KEY (`student_control_number`) REFERENCES `student_profiles`(`control_number`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_canonical_id`) REFERENCES `subjects`(`canonical_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_complementary_credit_activities` (`student_control_number`, `subject_canonical_id`, `period`) SELECT `student_control_number`, `subject_canonical_id`, `period` FROM `complementary_credit_activities`;
--> statement-breakpoint
DROP TABLE `complementary_credit_activities`;
--> statement-breakpoint
ALTER TABLE `__new_complementary_credit_activities` RENAME TO `complementary_credit_activities`;
--> statement-breakpoint
-- No unique index over the subject-less rows, on purpose. A NULL cannot be
-- deduplicated by a UNIQUE index, so the obvious guard is a partial one on
-- (student, period) — and measured against this table it is the wrong guard: it
-- REJECTS a student who takes two external activities in the same term, which
-- the institution plainly allows, while still letting one course recorded in
-- two different terms pay out twice. A rule that blocks real records and misses
-- its own target is worse than an acknowledged gap, so the gap stays open and
-- is written down in schema.ts instead of being invented here.
ALTER TABLE `subjects` DROP COLUMN `complementary_credits`;
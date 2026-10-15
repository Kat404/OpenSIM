-- Phase 10 S1 — complementary credit weight per subject.
--
-- Operator dictum 2026-10-13: ITM-100 (Tutoría), ITM-104 (Actividades Físicas) and
-- ITM-105 (Apreciación de Artes) are optional for curricular progress and exist
-- only to earn ONE complementary credit each. ITM-101 (Actividades Complementarias)
-- carries the remainder of the plan's 5-credit block.
--
-- Default 0 for every existing row is correct, not a placeholder: all 68
-- reticular subjects earn zero complementary credits by definition.
ALTER TABLE `subjects` ADD COLUMN `complementary_credits` integer DEFAULT 0 NOT NULL;

UPDATE `subjects` SET `complementary_credits` = 1 WHERE `canonical_id` IN ('itm-100', 'itm-104', 'itm-105');
--> statement-breakpoint
UPDATE `subjects` SET `complementary_credits` = 2 WHERE `canonical_id` = 'itm-101';
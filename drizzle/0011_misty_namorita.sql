ALTER TABLE `course_groups` ADD `period` text;--> statement-breakpoint
ALTER TABLE `course_groups` ADD `credits` integer;--> statement-breakpoint
ALTER TABLE `course_groups` ADD `is_lab_session` integer DEFAULT false NOT NULL;
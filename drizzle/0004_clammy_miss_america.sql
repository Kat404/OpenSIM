CREATE INDEX `idx_course_groups_subject_canonical` ON `course_groups` (`subject_canonical_id`);--> statement-breakpoint
CREATE INDEX `idx_course_schedule_blocks_group` ON `course_schedule_blocks` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_course_schedule_blocks_day` ON `course_schedule_blocks` (`day`);
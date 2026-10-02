CREATE TABLE `careers` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`total_credits` integer DEFAULT 260 NOT NULL,
	`total_semesters` integer DEFAULT 9 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `course_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_canonical_id` text NOT NULL,
	`group_code` text NOT NULL,
	`teacher_name` text NOT NULL,
	`has_lab` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`subject_canonical_id`) REFERENCES `subjects`(`canonical_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `course_schedule_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`day` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`classroom` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `course_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `specialties` (
	`code` text PRIMARY KEY NOT NULL,
	`career_code` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`career_code`) REFERENCES `careers`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`control_number` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`curp` text NOT NULL,
	`birth_state` text NOT NULL,
	`career_code` text NOT NULL,
	`specialty_code` text,
	`current_semester` integer DEFAULT 1 NOT NULL,
	`certified_average` real DEFAULT 0 NOT NULL,
	`arithmetic_average` real DEFAULT 0 NOT NULL,
	`passed_average` real DEFAULT 0 NOT NULL,
	`approved_credits` integer DEFAULT 0 NOT NULL,
	`remaining_credits` integer DEFAULT 260 NOT NULL,
	`completed_credits` integer DEFAULT 0 NOT NULL,
	`in_progress_credits` integer DEFAULT 0 NOT NULL,
	`advance_percentage` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Activo regular' NOT NULL,
	`health_service` text DEFAULT 'IMSS' NOT NULL,
	`enrollment_period` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`career_code`) REFERENCES `careers`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`specialty_code`) REFERENCES `specialties`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `student_progress` (
	`student_control_number` text NOT NULL,
	`subject_canonical_id` text NOT NULL,
	`status` text NOT NULL,
	`grade` real,
	`evaluation_type` text,
	`period` text NOT NULL,
	PRIMARY KEY(`student_control_number`, `subject_canonical_id`),
	FOREIGN KEY (`student_control_number`) REFERENCES `student_profiles`(`control_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_canonical_id`) REFERENCES `subjects`(`canonical_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subject_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_canonical_id` text NOT NULL,
	`alias_code` text NOT NULL,
	FOREIGN KEY (`subject_canonical_id`) REFERENCES `subjects`(`canonical_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subject_aliases_alias_code_unique` ON `subject_aliases` (`alias_code`);--> statement-breakpoint
CREATE TABLE `subject_prerequisites` (
	`subject_canonical_id` text NOT NULL,
	`prerequisite_canonical_id` text NOT NULL,
	PRIMARY KEY(`subject_canonical_id`, `prerequisite_canonical_id`),
	FOREIGN KEY (`subject_canonical_id`) REFERENCES `subjects`(`canonical_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prerequisite_canonical_id`) REFERENCES `subjects`(`canonical_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subject_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_canonical_id` text NOT NULL,
	`unit_number` integer NOT NULL,
	`title` text NOT NULL,
	`subtopics_json` text NOT NULL,
	FOREIGN KEY (`subject_canonical_id`) REFERENCES `subjects`(`canonical_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`canonical_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`semester` integer NOT NULL,
	`ht` integer NOT NULL,
	`hp` integer NOT NULL,
	`credits` integer NOT NULL,
	`area` text NOT NULL,
	`specialty_code` text,
	FOREIGN KEY (`specialty_code`) REFERENCES `specialties`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_code_unique` ON `subjects` (`code`);
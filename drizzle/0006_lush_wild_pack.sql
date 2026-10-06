PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_student_progress` (
	`student_control_number` text NOT NULL,
	`subject_canonical_id` text NOT NULL,
	`status` text NOT NULL,
	`grade` real,
	`evaluation_type` text,
	`period` text NOT NULL,
	PRIMARY KEY(`student_control_number`, `subject_canonical_id`, `period`),
	FOREIGN KEY (`student_control_number`) REFERENCES `student_profiles`(`control_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_canonical_id`) REFERENCES `subjects`(`canonical_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_student_progress`("student_control_number", "subject_canonical_id", "status", "grade", "evaluation_type", "period") SELECT "student_control_number", "subject_canonical_id", "status", "grade", "evaluation_type", "period" FROM `student_progress`;--> statement-breakpoint
DROP TABLE `student_progress`;--> statement-breakpoint
ALTER TABLE `__new_student_progress` RENAME TO `student_progress`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_student_credentials` (
	`control_number` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer DEFAULT 10000 NOT NULL,
	`password_updated_at` integer,
	FOREIGN KEY (`control_number`) REFERENCES `student_profiles`(`control_number`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_student_credentials`("control_number", "password_hash", "password_salt", "password_iterations", "password_updated_at") SELECT "control_number", "password_hash", "password_salt", "password_iterations", "password_updated_at" FROM `student_credentials`;--> statement-breakpoint
DROP TABLE `student_credentials`;--> statement-breakpoint
ALTER TABLE `__new_student_credentials` RENAME TO `student_credentials`;
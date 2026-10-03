PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_student_credentials` (
	`control_number` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer DEFAULT 100000 NOT NULL,
	`password_updated_at` integer,
	FOREIGN KEY (`control_number`) REFERENCES `student_profiles`(`control_number`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_student_credentials`("control_number", "password_hash", "password_salt", "password_iterations", "password_updated_at") SELECT "control_number", "password_hash", "password_salt", "password_iterations", "password_updated_at" FROM `student_credentials`;--> statement-breakpoint
DROP TABLE `student_credentials`;--> statement-breakpoint
ALTER TABLE `__new_student_credentials` RENAME TO `student_credentials`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
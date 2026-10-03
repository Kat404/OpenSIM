CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`student_control_number` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`user_agent` text,
	`ip_hash` text,
	FOREIGN KEY (`student_control_number`) REFERENCES `student_profiles`(`control_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `student_credentials` (
	`control_number` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer DEFAULT 100000 NOT NULL,
	`password_updated_at` integer,
	FOREIGN KEY (`control_number`) REFERENCES `student_profiles`(`control_number`) ON UPDATE no action ON DELETE no action
);

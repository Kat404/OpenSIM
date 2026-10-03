CREATE TABLE `auth_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_key` text NOT NULL,
	`window_start` integer NOT NULL,
	`attempt_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_auth_attempts_key_window` ON `auth_attempts` (`attempt_key`,`window_start`);
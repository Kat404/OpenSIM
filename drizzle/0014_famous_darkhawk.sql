CREATE TABLE `enrollments` (
	`student_control_number` text NOT NULL,
	`group_id` text NOT NULL,
	`period` text NOT NULL,
	PRIMARY KEY(`student_control_number`, `group_id`, `period`),
	FOREIGN KEY (`student_control_number`) REFERENCES `student_profiles`(`control_number`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `course_groups`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `complementary_credit_activities` (
	`student_control_number` text NOT NULL,
	`subject_canonical_id` text NOT NULL,
	`period` text NOT NULL,
	PRIMARY KEY(`student_control_number`, `subject_canonical_id`, `period`),
	FOREIGN KEY (`student_control_number`) REFERENCES `student_profiles`(`control_number`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_canonical_id`) REFERENCES `subjects`(`canonical_id`) ON UPDATE no action ON DELETE no action
);

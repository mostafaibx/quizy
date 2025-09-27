CREATE TABLE `attempt_answers` (
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`answer_json` text NOT NULL,
	`is_correct` integer NOT NULL,
	`partial_pct` real,
	`answered_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempt_answers_attempt_id_idx` ON `attempt_answers` (`attempt_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_answers_pk` ON `attempt_answers` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`r2_key` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`mime` text NOT NULL,
	`page_count` integer,
	`status` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_r2_key_unique` ON `files` (`r2_key`);--> statement-breakpoint
CREATE TABLE `question_blank_accept` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`blank_no` integer NOT NULL,
	`answer` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_blank_accept_unique` ON `question_blank_accept` (`question_id`,`blank_no`,`answer`);--> statement-breakpoint
CREATE INDEX `question_blank_accept_idx` ON `question_blank_accept` (`question_id`,`blank_no`);--> statement-breakpoint
CREATE TABLE `question_blanks` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`blank_no` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_blanks_question_blank_unique` ON `question_blanks` (`question_id`,`blank_no`);--> statement-breakpoint
CREATE TABLE `question_numeric_key` (
	`question_id` text PRIMARY KEY NOT NULL,
	`answer` real NOT NULL,
	`tolerance` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `question_options` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`idx` integer NOT NULL,
	`text` text NOT NULL,
	`is_correct` integer,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_options_question_idx_unique` ON `question_options` (`question_id`,`idx`);--> statement-breakpoint
CREATE INDEX `question_options_question_id_idx` ON `question_options` (`question_id`);--> statement-breakpoint
CREATE TABLE `question_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`item_idx` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_order_items_question_idx_unique` ON `question_order_items` (`question_id`,`item_idx`);--> statement-breakpoint
CREATE INDEX `question_order_items_question_id_idx` ON `question_order_items` (`question_id`);--> statement-breakpoint
CREATE TABLE `question_pairs` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`left_idx` integer NOT NULL,
	`left_text` text NOT NULL,
	`right_idx` integer NOT NULL,
	`right_text` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_pairs_question_left_unique` ON `question_pairs` (`question_id`,`left_idx`);--> statement-breakpoint
CREATE UNIQUE INDEX `question_pairs_question_right_unique` ON `question_pairs` (`question_id`,`right_idx`);--> statement-breakpoint
CREATE INDEX `question_pairs_question_id_idx` ON `question_pairs` (`question_id`);--> statement-breakpoint
CREATE TABLE `question_short_accept` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`answer` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_short_accept_question_id_idx` ON `question_short_accept` (`question_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`qtype` text NOT NULL,
	`position` integer NOT NULL,
	`stem` text NOT NULL,
	`explanation` text,
	`payload_json` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_quiz_position_unique` ON `questions` (`quiz_id`,`position`);--> statement-breakpoint
CREATE INDEX `questions_quiz_position_idx` ON `questions` (`quiz_id`,`position`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`user_id` text NOT NULL,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	`total_questions` integer NOT NULL,
	`total_correct` integer DEFAULT 0,
	`score_pct` real,
	`option_shuffle_seed` integer,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_attempts_unique` ON `quiz_attempts` (`quiz_id`,`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `quiz_attempts_user_start_idx` ON `quiz_attempts` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `quiz_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`model` text NOT NULL,
	`raw_json` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`error` text,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`from_page` integer NOT NULL,
	`to_page` integer NOT NULL,
	`topic` text,
	`model` text,
	`status` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quizzes_file_id_idx` ON `quizzes` (`file_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
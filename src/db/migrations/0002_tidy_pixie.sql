CREATE TABLE `generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`qstash_message_id` text,
	`retry_count` integer DEFAULT 0,
	`error` text,
	`metadata` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

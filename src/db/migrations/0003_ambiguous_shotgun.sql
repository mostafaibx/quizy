CREATE TABLE `parsing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`qstash_message_id` text,
	`parser_service_url` text,
	`retry_count` integer DEFAULT 0,
	`error` text,
	`parsed_content_r2_key` text,
	`processing_metrics` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

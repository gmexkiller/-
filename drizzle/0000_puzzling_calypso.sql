CREATE TABLE `classroom_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_code` text NOT NULL,
	`group_number` integer NOT NULL,
	`device_token_hash` text,
	`joined_at` text,
	`last_seen_at` text,
	`prediction` text,
	`measurements_json` text,
	`conclusion` text,
	`route_type` text,
	`route_reason` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	FOREIGN KEY (`session_code`) REFERENCES `classroom_sessions`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_classroom_groups_session_number` ON `classroom_groups` (`session_code`,`group_number`);--> statement-breakpoint
CREATE INDEX `idx_classroom_groups_session` ON `classroom_groups` (`session_code`);--> statement-breakpoint
CREATE TABLE `classroom_sessions` (
	`code` text PRIMARY KEY NOT NULL,
	`teacher_token_hash` text NOT NULL,
	`group_count` integer NOT NULL,
	`scene` integer DEFAULT 0 NOT NULL,
	`answer_revealed` integer DEFAULT false NOT NULL,
	`submissions_paused` integer DEFAULT false NOT NULL,
	`started_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_classroom_sessions_expires_at` ON `classroom_sessions` (`expires_at`);
--> statement-breakpoint
PRAGMA optimize;

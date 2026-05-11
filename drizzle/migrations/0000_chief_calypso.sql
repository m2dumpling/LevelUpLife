CREATE TABLE `achievement` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`icon` text NOT NULL,
	`is_hidden` integer DEFAULT true NOT NULL,
	`unlocked` integer DEFAULT false NOT NULL,
	`unlocked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `achievement_key_unique` ON `achievement` (`key`);--> statement-breakpoint
CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`task_id` integer,
	`task_title` text NOT NULL,
	`mode` text NOT NULL,
	`xp_earned` integer NOT NULL,
	`gold_earned` integer NOT NULL,
	`completed_at` text NOT NULL,
	`date` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `story_event` (
	`id` integer PRIMARY KEY NOT NULL,
	`chapter_key` text NOT NULL,
	`trigger_condition` text NOT NULL,
	`title` text NOT NULL,
	`dialogue` text NOT NULL,
	`npc_name` text DEFAULT '神秘老人' NOT NULL,
	`reward` text,
	`is_triggered` integer DEFAULT false NOT NULL,
	`triggered_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task` (
	`id` integer PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`difficulty` text DEFAULT 'easy' NOT NULL,
	`xp_reward` integer NOT NULL,
	`gold_reward` integer NOT NULL,
	`streak_count` integer DEFAULT 0 NOT NULL,
	`best_streak` integer DEFAULT 0 NOT NULL,
	`due_date` text,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text DEFAULT '勇者' NOT NULL,
	`password_hash` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`xp_to_next` integer DEFAULT 100 NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`hp` integer DEFAULT 100 NOT NULL,
	`max_hp` integer DEFAULT 100 NOT NULL,
	`total_days` integer DEFAULT 1 NOT NULL,
	`streak_days` integer DEFAULT 0 NOT NULL,
	`best_streak` integer DEFAULT 0 NOT NULL,
	`story_progress` text DEFAULT 'chapter_0' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

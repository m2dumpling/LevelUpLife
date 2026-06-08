CREATE TABLE `boss` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '🐉' NOT NULL,
	`hp` integer NOT NULL,
	`max_hp` integer NOT NULL,
	`week_start` text NOT NULL,
	`defeated` integer DEFAULT false NOT NULL,
	`reward_gold` integer,
	`notified` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `boss_contribution` (
	`id` integer PRIMARY KEY NOT NULL,
	`boss_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`task_id` integer DEFAULT 0 NOT NULL,
	`damage_date` text,
	`damage` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `friend` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`friend_id` integer NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `friend_chat` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`friend_id` integer NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `friend_request` (
	`id` integer PRIMARY KEY NOT NULL,
	`from_user_id` integer NOT NULL,
	`to_user_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gift_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`from_user_id` integer NOT NULL,
	`to_user_id` integer NOT NULL,
	`gift_type` text NOT NULL,
	`gift_value` text NOT NULL,
	`date` text NOT NULL,
	`seen_at` text
);
--> statement-breakpoint
CREATE TABLE `guild` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`motto` text DEFAULT '' NOT NULL,
	`invite_code` text NOT NULL,
	`leader_id` integer NOT NULL,
	`hp` integer DEFAULT 100 NOT NULL,
	`max_hp` integer DEFAULT 100 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guild_invite_code_unique` ON `guild` (`invite_code`);--> statement-breakpoint
CREATE TABLE `guild_chat` (
	`id` integer PRIMARY KEY NOT NULL,
	`guild_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`username` text NOT NULL,
	`message` text NOT NULL,
	`reply_to` integer,
	`reply_username` text,
	`reply_preview` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guild_member` (
	`id` integer PRIMARY KEY NOT NULL,
	`guild_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `habit_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`completed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`item_key` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`equipped` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lottery_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`prize` text NOT NULL,
	`date` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pet` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`pet_type` text NOT NULL,
	`stage` integer DEFAULT 0 NOT NULL,
	`hatched_at` text,
	`fed_today` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pet_user_id_unique` ON `pet` (`user_id`);--> statement-breakpoint
CREATE TABLE `pvp_match` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`player1_id` integer NOT NULL,
	`player2_id` integer,
	`bet` integer DEFAULT 20 NOT NULL,
	`winner_id` integer,
	`status` text DEFAULT 'waiting' NOT NULL,
	`result` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limit` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`action_type` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reward_ledger` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`completion_key` text NOT NULL,
	`mode` text NOT NULL,
	`task_title` text NOT NULL,
	`base_xp` integer NOT NULL,
	`base_gold` integer NOT NULL,
	`xp_earned` integer NOT NULL,
	`gold_earned` integer NOT NULL,
	`level_before` integer NOT NULL,
	`xp_before` integer NOT NULL,
	`xp_to_next_before` integer NOT NULL,
	`gold_before` integer NOT NULL,
	`level_after` integer NOT NULL,
	`xp_after` integer NOT NULL,
	`xp_to_next_after` integer NOT NULL,
	`gold_after` integer NOT NULL,
	`completed_date` text NOT NULL,
	`created_at` text NOT NULL,
	`reversed_at` text
);
--> statement-breakpoint
CREATE TABLE `user_class` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`class_name` text NOT NULL,
	`assigned_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_class_user_id_unique` ON `user_class` (`user_id`);--> statement-breakpoint
CREATE TABLE `village` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`stone` integer DEFAULT 0 NOT NULL,
	`houses` integer DEFAULT 1 NOT NULL,
	`library` integer DEFAULT 1 NOT NULL,
	`market` integer DEFAULT 1 NOT NULL,
	`fountain` integer DEFAULT 1 NOT NULL,
	`castle` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `village_user_id_unique` ON `village` (`user_id`);--> statement-breakpoint
DROP INDEX `achievement_key_unique`;--> statement-breakpoint
ALTER TABLE `achievement` ADD `user_id` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `activity_log` ADD `user_id` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `story_event` ADD `user_id` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `task` ADD `user_id` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `task` ADD `frequency` text DEFAULT 'daily';--> statement-breakpoint
ALTER TABLE `task` ADD `time_of_day` text DEFAULT 'anytime';--> statement-breakpoint
ALTER TABLE `task` ADD `frequency_days` text;--> statement-breakpoint
ALTER TABLE `task` ADD `reminder_time` text;--> statement-breakpoint
ALTER TABLE `task` ADD `target_date` text;--> statement-breakpoint
ALTER TABLE `task` ADD `status` text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `task` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `task` ADD `end_date` text;--> statement-breakpoint
ALTER TABLE `user` ADD `username` text NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `hp_penalty_active` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `register_ip` text;--> statement-breakpoint
ALTER TABLE `user` ADD `register_country` text;--> statement-breakpoint
ALTER TABLE `user` ADD `last_login_ip` text;--> statement-breakpoint
ALTER TABLE `user` ADD `last_login_country` text;--> statement-breakpoint
ALTER TABLE `user` ADD `last_settlement_date` text;--> statement-breakpoint
ALTER TABLE `user` ADD `last_login_date` text;--> statement-breakpoint
ALTER TABLE `user` ADD `city` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);
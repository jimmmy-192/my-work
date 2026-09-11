CREATE TABLE `custom_wallpapers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_wallpapers_object_key_unique` ON `custom_wallpapers` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_custom_wallpapers_user_id` ON `custom_wallpapers` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`glass` text DEFAULT 'standard' NOT NULL,
	`wallpaper` text DEFAULT 'mountain' NOT NULL,
	`wallpaper_order` text DEFAULT '[]' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

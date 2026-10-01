ALTER TABLE `chore` ADD `reward_type` text NOT NULL DEFAULT 'xp';
--> statement-breakpoint
UPDATE `chore` SET `reward_type` = 'allowance' WHERE `reward_cents` > 0 OR `allowance_enabled` = 1;
--> statement-breakpoint
ALTER TABLE `chore_completion` ADD `member_id` text REFERENCES `household_member`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE `xp_goal` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL REFERENCES `family`(`id`) ON DELETE CASCADE,
	`member_id` text REFERENCES `household_member`(`id`) ON DELETE CASCADE,
	`title` text NOT NULL,
	`target_points` integer NOT NULL,
	`created_at` integer NOT NULL
);

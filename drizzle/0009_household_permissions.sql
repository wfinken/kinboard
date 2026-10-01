-- Hand-written, like 0003-0008: drizzle-kit's snapshot history is missing
-- for those migrations (only 0000-0002 and this one have a meta/*_snapshot.json),
-- so `drizzle-kit generate` diffs against the 0002 schema and produces a
-- migration that re-declares tables/columns already added by 0003-0008.
-- This file has only the two changes actually needed for this release:
-- linking a signed-in user to their assignable householdMembers row, and
-- the new per-member CRUD permission table.

ALTER TABLE `household_member` ADD `user_id` text REFERENCES user(id);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_member_user_id_unique` ON `household_member` (`user_id`);
--> statement-breakpoint
CREATE TABLE `permission` (
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`feature` text NOT NULL,
	`can_create` integer DEFAULT true NOT NULL,
	`can_read` integer DEFAULT true NOT NULL,
	`can_update` integer DEFAULT true NOT NULL,
	`can_delete` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`user_id`, `feature`),
	FOREIGN KEY (`family_id`) REFERENCES `family`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

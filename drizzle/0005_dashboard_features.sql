ALTER TABLE `dashboard_settings` ADD `widget_sizes` text NOT NULL DEFAULT '{"clock":"1x1","weather":"2x1","calendar":"2x2","meals":"1x1","chores":"2x1","notes":"1x1"}';
ALTER TABLE `chore` ADD `rotation_member_id` text REFERENCES `household_member`(`id`) ON DELETE SET NULL;
ALTER TABLE `chore` ADD `reward_points` integer NOT NULL DEFAULT 1;
ALTER TABLE `chore` ADD `reward_cents` integer NOT NULL DEFAULT 0;
ALTER TABLE `chore` ADD `bounty` integer NOT NULL DEFAULT 0;
ALTER TABLE `sticky_note` ADD `media_url` text;
ALTER TABLE `sticky_note` ADD `media_type` text;
CREATE TABLE `chore_claim` (
  `chore_id` text PRIMARY KEY NOT NULL REFERENCES `chore`(`id`) ON DELETE CASCADE,
  `member_id` text NOT NULL REFERENCES `household_member`(`id`) ON DELETE CASCADE,
  `claimed_at` integer NOT NULL
);
CREATE TABLE `member_status` (
  `member_id` text PRIMARY KEY NOT NULL REFERENCES `household_member`(`id`) ON DELETE CASCADE,
  `status` text NOT NULL,
  `updated_at` integer NOT NULL
);

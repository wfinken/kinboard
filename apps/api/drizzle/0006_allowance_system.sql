ALTER TABLE `chore` ADD `allowance_enabled` integer NOT NULL DEFAULT 0;
ALTER TABLE `chore` ADD `max_bid_cents` integer NOT NULL DEFAULT 0;
UPDATE `dashboard_settings`
SET `widget_order` = json_insert(`widget_order`, '$[#]', 'allowance')
WHERE NOT EXISTS (SELECT 1 FROM json_each(`dashboard_settings`.`widget_order`) WHERE value = 'allowance');
UPDATE `dashboard_settings`
SET `widget_sizes` = json_set(`widget_sizes`, '$.allowance', '1x1')
WHERE json_type(`widget_sizes`, '$.allowance') IS NULL;
CREATE TABLE `allowance_ledger` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `member_id` text REFERENCES `household_member`(`id`) ON DELETE SET NULL,
  `chore_id` text REFERENCES `chore`(`id`) ON DELETE SET NULL,
  `note` text NOT NULL DEFAULT '',
  `created_at` integer NOT NULL
);
CREATE TABLE `allowance_bid` (
  `id` text PRIMARY KEY NOT NULL,
  `chore_id` text NOT NULL REFERENCES `chore`(`id`) ON DELETE CASCADE,
  `member_id` text NOT NULL REFERENCES `household_member`(`id`) ON DELETE CASCADE,
  `amount_cents` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `created_at` integer NOT NULL,
  `decided_at` integer
);

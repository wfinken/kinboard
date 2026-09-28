ALTER TABLE `family` ADD COLUMN `dashboard_token` text;
ALTER TABLE `family` ADD COLUMN `dashboard_token_expires_at` integer;
CREATE UNIQUE INDEX `family_dashboard_token_unique` ON `family` (`dashboard_token`);

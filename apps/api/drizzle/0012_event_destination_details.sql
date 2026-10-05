ALTER TABLE `dashboard_settings` ADD `default_event_calendar_id` text NOT NULL DEFAULT 'local';
--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `location` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `description` text NOT NULL DEFAULT '';

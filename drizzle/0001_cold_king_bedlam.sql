CREATE TABLE `dashboard_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`widget_order` text DEFAULT '["clock","weather","calendar","meals","chores","notes"]' NOT NULL,
	`refresh_seconds` integer DEFAULT 300 NOT NULL
);

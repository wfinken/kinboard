CREATE TABLE `calendar_event` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`member_id` text REFERENCES household_member(id) ON DELETE SET NULL
);

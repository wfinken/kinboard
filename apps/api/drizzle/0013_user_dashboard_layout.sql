CREATE TABLE `user_dashboard_layout` (
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`family_id` text NOT NULL REFERENCES `family`(`id`) ON DELETE CASCADE,
	`widget_order` text NOT NULL,
	`widget_sizes` text NOT NULL,
	PRIMARY KEY (`user_id`, `family_id`)
);

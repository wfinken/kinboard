UPDATE `dashboard_settings`
SET `widget_order` = json_insert(`widget_order`, '$[#]', 'availability')
WHERE NOT EXISTS (SELECT 1 FROM json_each(`dashboard_settings`.`widget_order`) WHERE value = 'availability');
--> statement-breakpoint
UPDATE `dashboard_settings`
SET `widget_sizes` = json_set(`widget_sizes`, '$.availability', '1x1')
WHERE json_type(`widget_sizes`, '$.availability') IS NULL;

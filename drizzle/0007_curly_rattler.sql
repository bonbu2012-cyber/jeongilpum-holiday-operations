CREATE TABLE `kiosk_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_type` text NOT NULL,
	`value` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_kiosk_events_type_time` ON `kiosk_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_kiosk_events_session_time` ON `kiosk_events` (`session_id`,`created_at`);
CREATE TABLE `configuration_events` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before_data` text,
	`after_data` text,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_configuration_events_entity` ON `configuration_events` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `custom_order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`event_type` text NOT NULL,
	`after_data` text,
	`actor_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `custom_order_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_custom_order_events_request` ON `custom_order_events` (`request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `custom_order_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_no` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`gift_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`budget_range` text NOT NULL,
	`fulfillment_preference` text NOT NULL,
	`preferred_schedule` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_order_requests_request_no_unique` ON `custom_order_requests` (`request_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_custom_orders_idempotency` ON `custom_order_requests` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_custom_orders_status_created` ON `custom_order_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_custom_orders_phone` ON `custom_order_requests` (`customer_phone`);--> statement-breakpoint
ALTER TABLE `products` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `sales_seasons` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_seasons` ADD `updated_at` text;
--> statement-breakpoint
CREATE TRIGGER custom_orders_no_hard_delete
BEFORE DELETE ON custom_order_requests
BEGIN
  SELECT RAISE(ABORT, 'custom orders cannot be hard deleted');
END;
--> statement-breakpoint
CREATE TRIGGER custom_orders_positive_quantity
BEFORE INSERT ON custom_order_requests
WHEN NEW.quantity < 1
BEGIN
  SELECT RAISE(ABORT, 'custom order quantity must be positive');
END;
--> statement-breakpoint
CREATE TRIGGER custom_orders_valid_status
BEFORE INSERT ON custom_order_requests
WHEN NEW.status NOT IN ('submitted','contacted','quoted','confirmed','closed','cancelled')
BEGIN
  SELECT RAISE(ABORT, 'invalid custom order status');
END;
--> statement-breakpoint
PRAGMA optimize;
CREATE TABLE `fulfillment_items` (
	`id` text PRIMARY KEY NOT NULL,
	`fulfillment_id` text NOT NULL,
	`order_item_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`fulfillment_id`) REFERENCES `fulfillments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_fulfillment_items_fulfillment` ON `fulfillment_items` (`fulfillment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fulfillment_items_pair` ON `fulfillment_items` (`fulfillment_id`,`order_item_id`);--> statement-breakpoint
CREATE TABLE `fulfillments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`fulfillment_type` text NOT NULL,
	`pickup_at` text,
	`ship_date` text,
	`recipient_name` text,
	`recipient_phone` text,
	`postal_code` text,
	`road_addr` text,
	`road_addr_reference` text,
	`jibun_addr` text,
	`detail_addr` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`customer_arrived` integer DEFAULT false NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fulfillments_order` ON `fulfillments` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_fulfillments_pickup_at` ON `fulfillments` (`pickup_at`);--> statement-breakpoint
CREATE INDEX `idx_fulfillments_ship_date` ON `fulfillments` (`ship_date`);--> statement-breakpoint
CREATE INDEX `idx_fulfillments_status` ON `fulfillments` (`status`);
--> statement-breakpoint
CREATE TRIGGER fulfillment_valid_type
BEFORE INSERT ON fulfillments
WHEN NEW.fulfillment_type NOT IN ('pickup','shipping')
BEGIN
  SELECT RAISE(ABORT, 'invalid fulfillment type');
END;
--> statement-breakpoint
CREATE TRIGGER fulfillment_required_schedule
BEFORE INSERT ON fulfillments
WHEN (NEW.fulfillment_type='pickup' AND NEW.pickup_at IS NULL)
  OR (NEW.fulfillment_type='shipping' AND NEW.ship_date IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'fulfillment schedule is required');
END;
--> statement-breakpoint
CREATE TRIGGER fulfillment_items_positive_quantity
BEFORE INSERT ON fulfillment_items
WHEN NEW.quantity < 1
BEGIN
  SELECT RAISE(ABORT, 'fulfillment item quantity must be positive');
END;
--> statement-breakpoint
PRAGMA optimize;

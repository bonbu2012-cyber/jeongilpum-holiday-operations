CREATE TABLE IF NOT EXISTS `band_sales` (
  `id` text PRIMARY KEY NOT NULL,
  `product_id` text NOT NULL,
  `title` text NOT NULL,
  `subtitle` text DEFAULT '' NOT NULL,
  `price` integer NOT NULL,
  `production_limit` integer NOT NULL,
  `reserved_qty` integer DEFAULT 0 NOT NULL,
  `deposit_per_unit` integer DEFAULT 1000 NOT NULL,
  `reservation_start_at` text NOT NULL,
  `reservation_end_at` text NOT NULL,
  `production_lock_at` text NOT NULL,
  `pickup_date` text NOT NULL,
  `pickup_start` text DEFAULT '10:00' NOT NULL,
  `pickup_end` text DEFAULT '19:00' NOT NULL,
  `pickup_location` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `active` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT "band_sales_limit_positive" CHECK(`production_limit` > 0),
  CONSTRAINT "band_sales_reserved_nonnegative" CHECK(`reserved_qty` >= 0),
  CONSTRAINT "band_sales_deposit_nonnegative" CHECK(`deposit_per_unit` >= 0),
  CONSTRAINT "band_sales_status_valid" CHECK(`status` in ('draft','open','closed','completed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_band_sales_active_start` ON `band_sales` (`active`,`reservation_start_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_band_sales_pickup_date` ON `band_sales` (`pickup_date`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `band_reservations` (
  `id` text PRIMARY KEY NOT NULL,
  `reservation_no` text NOT NULL,
  `sale_id` text NOT NULL,
  `customer_name` text NOT NULL,
  `customer_phone` text NOT NULL,
  `quantity` integer NOT NULL,
  `unit_price` integer NOT NULL,
  `total_amount` integer NOT NULL,
  `deposit_amount` integer NOT NULL,
  `pickup_window` text NOT NULL,
  `status` text DEFAULT 'confirmed' NOT NULL,
  `payment_status` text DEFAULT 'test_paid' NOT NULL,
  `payment_provider` text DEFAULT 'test' NOT NULL,
  `payment_tid` text,
  `policy_version` text NOT NULL,
  `policy_agreed_at` text NOT NULL,
  `cancelled_at` text,
  `picked_up_at` text,
  `no_show_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`sale_id`) REFERENCES `band_sales`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT "band_reservations_quantity_positive" CHECK(`quantity` > 0),
  CONSTRAINT "band_reservations_amount_nonnegative" CHECK(`total_amount` >= 0 AND `deposit_amount` >= 0),
  CONSTRAINT "band_reservations_status_valid" CHECK(`status` in ('confirmed','picked_up','cancelled','no_show'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_band_reservations_no` ON `band_reservations` (`reservation_no`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_band_reservations_sale_status` ON `band_reservations` (`sale_id`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_band_reservations_phone` ON `band_reservations` (`customer_phone`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `band_reservation_events` (
  `id` text PRIMARY KEY NOT NULL,
  `reservation_id` text NOT NULL,
  `event_type` text NOT NULL,
  `payload_json` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`reservation_id`) REFERENCES `band_reservations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_band_reservation_events_reservation` ON `band_reservation_events` (`reservation_id`,`created_at`);

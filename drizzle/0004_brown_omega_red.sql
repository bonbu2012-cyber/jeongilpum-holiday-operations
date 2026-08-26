CREATE TABLE `order_item_customizations` (
  `id` text PRIMARY KEY NOT NULL,
  `order_item_id` text NOT NULL,
  `category` text NOT NULL,
  `budget_option` text NOT NULL,
  `desired_composition` text DEFAULT '' NOT NULL,
  `preferred_cut` text DEFAULT '' NOT NULL,
  `fat_preference` text DEFAULT '' NOT NULL,
  `packaging_request` text DEFAULT '' NOT NULL,
  `other_request` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_daily_limits` (
  `product_id` text PRIMARY KEY NOT NULL,
  `daily_limit` integer NOT NULL,
  `schedule_basis` text DEFAULT 'fulfillment_date' NOT NULL,
  `active` integer DEFAULT true NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `updated_at` text NOT NULL,
  CONSTRAINT `product_daily_limits_positive` CHECK (`daily_limit` > 0),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_daily_reservations` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `order_item_id` text NOT NULL,
  `product_id` text NOT NULL,
  `reserve_date` text NOT NULL,
  `quantity` integer NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text NOT NULL,
  `released_at` text,
  CONSTRAINT `product_daily_reservations_quantity_positive` CHECK (`quantity` > 0),
  CONSTRAINT `product_daily_reservations_status_valid` CHECK (`status` IN ('active', 'released')),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `type` text NOT NULL,
  `method` text,
  `amount` integer NOT NULL,
  `paid_at` text NOT NULL,
  `recorded_by` text NOT NULL,
  `memo` text DEFAULT '' NOT NULL,
  `related_payment_id` text,
  `idempotency_key` text NOT NULL,
  `created_at` text NOT NULL,
  CONSTRAINT `payments_valid_entry` CHECK (
    (`type` = 'payment' AND `method` IS NOT NULL AND `method` IN ('card', 'cash', 'bank_transfer') AND `amount` > 0)
    OR (`type` = 'refund' AND `amount` > 0)
    OR (`type` = 'adjustment' AND `amount` <> 0)
  ),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_credit_terms` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `outstanding_amount` integer NOT NULL,
  `due_date` text,
  `memo` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `recorded_by` text NOT NULL,
  `created_at` text NOT NULL,
  `settled_at` text,
  CONSTRAINT `order_credit_terms_outstanding_positive` CHECK (`outstanding_amount` > 0),
  CONSTRAINT `order_credit_terms_status_valid` CHECK (`status` IN ('open', 'settled')),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_order_item_customizations_item` ON `order_item_customizations` (`order_item_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_reservations_item` ON `product_daily_reservations` (`order_item_id`);
--> statement-breakpoint
CREATE INDEX `idx_daily_reservations_product_date` ON `product_daily_reservations` (`product_id`,`reserve_date`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_daily_reservations_order` ON `product_daily_reservations` (`order_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payments_idempotency` ON `payments` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_payments_order_paid_at` ON `payments` (`order_id`,`paid_at`);
--> statement-breakpoint
CREATE INDEX `idx_order_credit_terms_order_status` ON `order_credit_terms` (`order_id`,`status`);
--> statement-breakpoint
INSERT OR IGNORE INTO `products` (
  `id`, `category`, `code`, `name`, `subtitle`, `description`, `price`,
  `customer_display_weight`, `image_url`, `badge`, `display_order`, `active`,
  `version`, `updated_at`
) VALUES (
  'custom-order', '맞춤주문', 'CUSTOM', '맞춤주문', '', '고객 요청에 따라 구성하는 맞춤주문', 0,
  NULL, NULL, NULL, 999, 0, 1, CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT OR IGNORE INTO `product_daily_limits` (
  `product_id`, `daily_limit`, `schedule_basis`, `active`, `version`, `updated_at`
) VALUES
  ('mi', 30, 'fulfillment_date', 1, 1, CURRENT_TIMESTAMP),
  ('seon', 20, 'fulfillment_date', 1, 1, CURRENT_TIMESTAMP),
  ('jin', 20, 'fulfillment_date', 1, 1, CURRENT_TIMESTAMP);
--> statement-breakpoint
PRAGMA optimize;

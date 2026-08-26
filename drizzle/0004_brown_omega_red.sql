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
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_order_credit_terms_order_status` ON `order_credit_terms` (`order_id`,`status`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `idx_order_item_customizations_item` ON `order_item_customizations` (`order_item_id`);--> statement-breakpoint
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
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payments_idempotency` ON `payments` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_payments_order_paid_at` ON `payments` (`order_id`,`paid_at`);--> statement-breakpoint
CREATE TABLE `product_daily_limits` (
	`product_id` text PRIMARY KEY NOT NULL,
	`daily_limit` integer NOT NULL,
	`schedule_basis` text DEFAULT 'fulfillment_date' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
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
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_reservations_item` ON `product_daily_reservations` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `idx_daily_reservations_product_date` ON `product_daily_reservations` (`product_id`,`reserve_date`,`status`);--> statement-breakpoint
CREATE INDEX `idx_daily_reservations_order` ON `product_daily_reservations` (`order_id`);
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
CREATE TRIGGER `trg_daily_reservations_validate_insert`
BEFORE INSERT ON `product_daily_reservations`
WHEN NEW.`status` = 'active'
BEGIN
  SELECT CASE
    WHEN NEW.`quantity` <= 0 THEN RAISE(ABORT, 'reservation quantity must be positive')
    WHEN EXISTS (
      SELECT 1
      FROM `product_daily_limits` AS limits
      WHERE limits.`product_id` = NEW.`product_id`
        AND limits.`active` = 1
        AND (
          COALESCE((
            SELECT SUM(reservations.`quantity`)
            FROM `product_daily_reservations` AS reservations
            WHERE reservations.`product_id` = NEW.`product_id`
              AND reservations.`reserve_date` = NEW.`reserve_date`
              AND reservations.`status` = 'active'
          ), 0) + NEW.`quantity`
        ) > limits.`daily_limit`
    ) THEN RAISE(ABORT, 'daily product limit exceeded')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_orders_cancel_release_reservations`
AFTER UPDATE OF `order_status` ON `orders`
WHEN NEW.`order_status` = 'cancelled' AND OLD.`order_status` <> 'cancelled'
BEGIN
  UPDATE `product_daily_reservations`
  SET `status` = 'released', `released_at` = CURRENT_TIMESTAMP
  WHERE `order_id` = NEW.`id` AND `status` = 'active';
END;
--> statement-breakpoint
CREATE TRIGGER `trg_payments_validate_insert`
BEFORE INSERT ON `payments`
BEGIN
  SELECT CASE
    WHEN NEW.`type` NOT IN ('payment', 'refund', 'adjustment')
      THEN RAISE(ABORT, 'invalid payment type')
    WHEN NEW.`type` = 'payment'
      AND NEW.`method` NOT IN ('card', 'cash', 'bank_transfer')
      THEN RAISE(ABORT, 'invalid payment method')
    WHEN NEW.`type` IN ('payment', 'refund') AND NEW.`amount` <= 0
      THEN RAISE(ABORT, 'payment amount must be positive')
    WHEN NEW.`type` = 'adjustment' AND NEW.`amount` = 0
      THEN RAISE(ABORT, 'adjustment amount must not be zero')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_payments_immutable_update`
BEFORE UPDATE ON `payments`
BEGIN
  SELECT RAISE(ABORT, 'payments are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_payments_immutable_delete`
BEFORE DELETE ON `payments`
BEGIN
  SELECT RAISE(ABORT, 'payments are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_credit_terms_validate_insert`
BEFORE INSERT ON `order_credit_terms`
WHEN NEW.`outstanding_amount` <= 0
BEGIN
  SELECT RAISE(ABORT, 'outstanding amount must be positive');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_credit_terms_settle_after_payment`
AFTER INSERT ON `payments`
WHEN NEW.`type` IN ('payment', 'adjustment')
BEGIN
  UPDATE `order_credit_terms`
  SET `status` = 'settled', `settled_at` = CURRENT_TIMESTAMP
  WHERE `order_id` = NEW.`order_id`
    AND `status` = 'open'
    AND (
      SELECT COALESCE(SUM(
        CASE
          WHEN `type` = 'payment' THEN `amount`
          WHEN `type` = 'refund' THEN -`amount`
          ELSE `amount`
        END
      ), 0)
      FROM `payments`
      WHERE `order_id` = NEW.`order_id`
    ) >= (
      SELECT `total_amount` FROM `orders` WHERE `id` = NEW.`order_id`
    );
END;

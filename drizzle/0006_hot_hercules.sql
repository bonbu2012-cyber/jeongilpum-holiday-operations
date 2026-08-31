CREATE TABLE `customer_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_name` text NOT NULL,
	`normalized_phone` text NOT NULL,
	`display_name` text NOT NULL,
	`display_phone` text NOT NULL,
	`ledger_sequence` integer DEFAULT 1 NOT NULL,
	`ledger_label` text DEFAULT '' NOT NULL,
	`is_primary` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_accounts_identity_sequence` ON `customer_accounts` (`normalized_name`,`normalized_phone`,`ledger_sequence`);--> statement-breakpoint
CREATE INDEX `idx_customer_accounts_phone` ON `customer_accounts` (`normalized_phone`,`is_primary`);--> statement-breakpoint
CREATE TABLE `customer_ledger_consultation_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`consultation_id` text NOT NULL,
	`order_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`consultation_id`) REFERENCES `customer_ledger_consultations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_ledger_consultation_order` ON `customer_ledger_consultation_orders` (`consultation_id`,`order_id`);--> statement-breakpoint
CREATE INDEX `idx_customer_ledger_consultation_orders_order` ON `customer_ledger_consultation_orders` (`order_id`);--> statement-breakpoint
CREATE TABLE `customer_ledger_consultations` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_account_id` text NOT NULL,
	`note` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`applied_by` text,
	`applied_at` text,
	`target_customer_account_id` text,
	`transfer_amount` integer DEFAULT 0 NOT NULL,
	`application_memo` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_customer_account_id`) REFERENCES `customer_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "customer_ledger_consultations_status_valid" CHECK("customer_ledger_consultations"."status" in ('pending', 'applied')),
	CONSTRAINT "customer_ledger_consultations_transfer_nonnegative" CHECK("customer_ledger_consultations"."transfer_amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_customer_ledger_consultations_customer_status` ON `customer_ledger_consultations` (`customer_account_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `customer_ledger_events` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_account_id` text NOT NULL,
	`event_type` text NOT NULL,
	`before_data` text,
	`after_data` text,
	`reason` text,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_customer_ledger_events_customer_time` ON `customer_ledger_events` (`customer_account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `customer_ledger_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_account_id` text NOT NULL,
	`type` text NOT NULL,
	`method` text,
	`amount` integer NOT NULL,
	`transacted_at` text NOT NULL,
	`payer_name` text,
	`payer_phone` text,
	`payer_relation` text,
	`memo` text DEFAULT '' NOT NULL,
	`related_transaction_id` text,
	`consultation_id` text,
	`legacy_payment_id` text,
	`idempotency_key` text NOT NULL,
	`recorded_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "customer_ledger_transactions_valid" CHECK(
    ("customer_ledger_transactions"."type" = 'payment' and "customer_ledger_transactions"."method" in ('card', 'cash', 'bank_transfer') and "customer_ledger_transactions"."amount" > 0)
    or ("customer_ledger_transactions"."type" = 'reversal' and "customer_ledger_transactions"."amount" > 0 and "customer_ledger_transactions"."related_transaction_id" is not null)
    or ("customer_ledger_transactions"."type" in ('transfer_in', 'transfer_out') and "customer_ledger_transactions"."amount" > 0 and "customer_ledger_transactions"."consultation_id" is not null)
    or ("customer_ledger_transactions"."type" = 'adjustment' and "customer_ledger_transactions"."amount" <> 0)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_ledger_transactions_idempotency` ON `customer_ledger_transactions` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_ledger_transactions_legacy_payment` ON `customer_ledger_transactions` (`legacy_payment_id`);--> statement-breakpoint
CREATE INDEX `idx_customer_ledger_transactions_customer_time` ON `customer_ledger_transactions` (`customer_account_id`,`transacted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_ledger_transactions_reversal_once` ON `customer_ledger_transactions` (`related_transaction_id`) WHERE "customer_ledger_transactions"."type" = 'reversal';--> statement-breakpoint
CREATE TABLE `order_customer_accounts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`customer_account_id` text NOT NULL,
	`linked_at` text NOT NULL,
	`linked_by` text,
	`link_reason` text DEFAULT 'order_identity' NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_order_customer_accounts_customer` ON `order_customer_accounts` (`customer_account_id`,`linked_at`);
--> statement-breakpoint
INSERT INTO `customer_accounts` (
	`id`,`normalized_name`,`normalized_phone`,`display_name`,`display_phone`,
	`ledger_sequence`,`ledger_label`,`is_primary`,`created_at`,`updated_at`
)
SELECT
	'customer-' || MIN(`id`),
	lower(trim(`buyer_name_snapshot`)),
	replace(replace(replace(replace(trim(`buyer_phone_snapshot`),'-',''),' ',''),'(',''),')',''),
	MIN(trim(`buyer_name_snapshot`)),
	MIN(trim(`buyer_phone_snapshot`)),
	1,'',1,MIN(`created_at`),MAX(`updated_at`)
FROM `orders`
GROUP BY
	lower(trim(`buyer_name_snapshot`)),
	replace(replace(replace(replace(trim(`buyer_phone_snapshot`),'-',''),' ',''),'(',''),')','');
--> statement-breakpoint
INSERT INTO `order_customer_accounts` (
	`order_id`,`customer_account_id`,`linked_at`,`linked_by`,`link_reason`
)
SELECT
	o.`id`,ca.`id`,o.`created_at`,NULL,'migration_identity'
FROM `orders` o
JOIN `customer_accounts` ca
	ON ca.`normalized_name`=lower(trim(o.`buyer_name_snapshot`))
	AND ca.`normalized_phone`=replace(replace(replace(replace(trim(o.`buyer_phone_snapshot`),'-',''),' ',''),'(',''),')','')
	AND ca.`ledger_sequence`=1;
--> statement-breakpoint
INSERT INTO `customer_ledger_transactions` (
	`id`,`customer_account_id`,`type`,`method`,`amount`,`transacted_at`,
	`payer_name`,`payer_phone`,`payer_relation`,`memo`,`related_transaction_id`,
	`consultation_id`,`legacy_payment_id`,`idempotency_key`,`recorded_by`,`created_at`
)
SELECT
	'legacy-' || p.`id`,
	oca.`customer_account_id`,
	CASE WHEN p.`type`='payment' THEN 'payment' ELSE 'adjustment' END,
	CASE WHEN p.`type`='payment' THEN p.`method` ELSE NULL END,
	CASE WHEN p.`type`='refund' THEN -abs(p.`amount`) ELSE p.`amount` END,
	p.`paid_at`,
	NULL,NULL,NULL,p.`memo`,
	CASE WHEN p.`related_payment_id` IS NOT NULL THEN 'legacy-' || p.`related_payment_id` ELSE NULL END,
	NULL,p.`id`,'legacy:' || p.`id`,p.`recorded_by`,p.`created_at`
FROM `payments` p
JOIN `order_customer_accounts` oca ON oca.`order_id`=p.`order_id`;
--> statement-breakpoint
PRAGMA optimize;

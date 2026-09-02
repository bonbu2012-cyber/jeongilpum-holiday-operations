DROP TRIGGER IF EXISTS orders_no_hard_delete;
--> statement-breakpoint
DROP TRIGGER IF EXISTS order_items_positive_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS order_items_positive_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS orders_status_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS orders_status_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS custom_orders_no_hard_delete;
--> statement-breakpoint
DROP TRIGGER IF EXISTS custom_orders_positive_quantity;
--> statement-breakpoint
DROP TRIGGER IF EXISTS custom_orders_valid_status;
--> statement-breakpoint
DROP TRIGGER IF EXISTS fulfillment_valid_type;
--> statement-breakpoint
DROP TRIGGER IF EXISTS fulfillment_required_schedule;
--> statement-breakpoint
DROP TRIGGER IF EXISTS fulfillment_items_positive_quantity;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
DROP TABLE IF EXISTS custom_order_events;
--> statement-breakpoint
DROP TABLE IF EXISTS customer_ledger_consultation_orders;
--> statement-breakpoint
DROP TABLE IF EXISTS customer_ledger_events;
--> statement-breakpoint
DROP TABLE IF EXISTS customer_ledger_transactions;
--> statement-breakpoint
DROP TABLE IF EXISTS customer_ledger_consultations;
--> statement-breakpoint
DROP TABLE IF EXISTS order_customer_accounts;
--> statement-breakpoint
DROP TABLE IF EXISTS package_assignment_history;
--> statement-breakpoint
DROP TABLE IF EXISTS package_labels;
--> statement-breakpoint
DROP TABLE IF EXISTS package_skin_packs;
--> statement-breakpoint
DROP TABLE IF EXISTS skin_pack_labels;
--> statement-breakpoint
DROP TABLE IF EXISTS skin_packs;
--> statement-breakpoint
DROP TABLE IF EXISTS production_batches;
--> statement-breakpoint
DROP TABLE IF EXISTS fulfillment_items;
--> statement-breakpoint
DROP TABLE IF EXISTS order_item_customizations;
--> statement-breakpoint
DROP TABLE IF EXISTS product_daily_reservations;
--> statement-breakpoint
DROP TABLE IF EXISTS payments;
--> statement-breakpoint
DROP TABLE IF EXISTS order_credit_terms;
--> statement-breakpoint
DROP TABLE IF EXISTS operational_alerts;
--> statement-breakpoint
DROP TABLE IF EXISTS order_events;
--> statement-breakpoint
DROP TABLE IF EXISTS packages;
--> statement-breakpoint
DROP TABLE IF EXISTS fulfillments;
--> statement-breakpoint
DROP TABLE IF EXISTS order_items;
--> statement-breakpoint
DROP TABLE IF EXISTS product_components;
--> statement-breakpoint
DROP TABLE IF EXISTS custom_order_requests;
--> statement-breakpoint
DROP TABLE IF EXISTS product_daily_limits;
--> statement-breakpoint
DROP TABLE IF EXISTS customer_accounts;
--> statement-breakpoint
DROP TABLE IF EXISTS configuration_events;
--> statement-breakpoint
DROP TABLE IF EXISTS orders;
--> statement-breakpoint
DROP TABLE IF EXISTS sales_seasons;
--> statement-breakpoint
DROP TABLE IF EXISTS traceability_records;
--> statement-breakpoint
DROP TABLE IF EXISTS products;
--> statement-breakpoint
CREATE TABLE `products` (
  `id` text PRIMARY KEY NOT NULL,
  `category` text NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `subtitle` text DEFAULT '' NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `price` integer NOT NULL,
  `display_weight` text,
  `image_url` text,
  `badge` text,
  `daily_limit` integer,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `active` integer DEFAULT true NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  CONSTRAINT `products_daily_limit_positive` CHECK (`daily_limit` IS NULL OR `daily_limit` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);
--> statement-breakpoint
CREATE INDEX `idx_products_active_sort_order` ON `products` (`active`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_products_category` ON `products` (`category`);
--> statement-breakpoint
CREATE TABLE `orders` (
  `id` text PRIMARY KEY NOT NULL,
  `order_no` text NOT NULL,
  `buyer_name` text NOT NULL,
  `buyer_phone` text NOT NULL,
  `payment_status` text DEFAULT 'unpaid' NOT NULL,
  `paid_amount` integer DEFAULT 0 NOT NULL,
  `total_amount` integer NOT NULL,
  `customer_arrived_at` text,
  `customer_note` text DEFAULT '' NOT NULL,
  `idempotency_key` text NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  CONSTRAINT `orders_payment_status_valid` CHECK (`payment_status` IN ('unpaid','partial','paid')),
  CONSTRAINT `orders_paid_amount_nonnegative` CHECK (`paid_amount` >= 0),
  CONSTRAINT `orders_total_amount_nonnegative` CHECK (`total_amount` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_orders_idempotency` ON `orders` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_orders_buyer_phone` ON `orders` (`buyer_phone`);
--> statement-breakpoint
CREATE TABLE `work_items` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `product_id` text NOT NULL,
  `product_name_snapshot` text NOT NULL,
  `unit_price_snapshot` integer NOT NULL,
  `quantity` integer NOT NULL,
  `line_total` integer NOT NULL,
  `delivery_method` text NOT NULL,
  `due_at` text NOT NULL,
  `work_status` text DEFAULT 'received' NOT NULL,
  `recipient_name` text,
  `recipient_phone` text,
  `postal_code` text,
  `road_addr` text,
  `road_addr_reference` text,
  `jibun_addr` text,
  `detail_addr` text,
  `customization_json` text,
  `note` text DEFAULT '' NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT `work_items_quantity_positive` CHECK (`quantity` > 0),
  CONSTRAINT `work_items_line_total_nonnegative` CHECK (`line_total` >= 0),
  CONSTRAINT `work_items_delivery_method_valid` CHECK (`delivery_method` IN ('onsite_sale','onsite_reservation','delivery')),
  CONSTRAINT `work_items_status_valid` CHECK (`work_status` IN ('received','confirmed','in_progress','ready','completed','cancelled'))
);
--> statement-breakpoint
CREATE INDEX `idx_work_items_order` ON `work_items` (`order_id`);
--> statement-breakpoint
CREATE INDEX `idx_work_items_due_status` ON `work_items` (`due_at`,`work_status`);
--> statement-breakpoint
CREATE INDEX `idx_work_items_product_due` ON `work_items` (`product_id`,`due_at`);
--> statement-breakpoint
CREATE TABLE `work_item_events` (
  `id` text PRIMARY KEY NOT NULL,
  `work_item_id` text NOT NULL,
  `order_id` text NOT NULL,
  `event_type` text NOT NULL,
  `from_value` text,
  `to_value` text,
  `actor` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_work_item_events_work_item_created` ON `work_item_events` (`work_item_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_work_item_events_order_created` ON `work_item_events` (`order_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `traceability_records` (
  `traceability_no` text PRIMARY KEY NOT NULL,
  `last_raw_scan` text NOT NULL,
  `origin` text DEFAULT '' NOT NULL,
  `slaughterhouse` text DEFAULT '' NOT NULL,
  `cattle_type` text DEFAULT '' NOT NULL,
  `grade` text DEFAULT '' NOT NULL,
  `source` text DEFAULT 'manual' NOT NULL,
  `verified_at` text,
  `last_used_by` text NOT NULL,
  `last_used_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_traceability_recent_worker` ON `traceability_records` (`last_used_by`,`last_used_at`);
--> statement-breakpoint
CREATE TABLE `production_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `production_date` text NOT NULL,
  `parent_batch_id` text,
  `segment_no` integer DEFAULT 1 NOT NULL,
  `component_code` text NOT NULL,
  `cut_name_snapshot` text NOT NULL,
  `required_quantity` integer NOT NULL,
  `available_quantity_at_start` integer NOT NULL,
  `additional_needed` integer NOT NULL,
  `production_target` integer NOT NULL,
  `produced_quantity` integer DEFAULT 0 NOT NULL,
  `traceability_no` text NOT NULL,
  `origin` text DEFAULT '' NOT NULL,
  `slaughterhouse` text DEFAULT '' NOT NULL,
  `cattle_type` text DEFAULT '' NOT NULL,
  `grade` text DEFAULT '' NOT NULL,
  `storage_method` text DEFAULT '' NOT NULL,
  `expiry_text` text DEFAULT '' NOT NULL,
  `packaging_material` text DEFAULT '' NOT NULL,
  `food_type` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'in_progress' NOT NULL,
  `started_by` text NOT NULL,
  `started_at` text NOT NULL,
  `completed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`traceability_no`) REFERENCES `traceability_records`(`traceability_no`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT `production_batches_required_nonnegative` CHECK (`required_quantity` >= 0),
  CONSTRAINT `production_batches_available_nonnegative` CHECK (`available_quantity_at_start` >= 0),
  CONSTRAINT `production_batches_additional_nonnegative` CHECK (`additional_needed` >= 0),
  CONSTRAINT `production_batches_target_nonnegative` CHECK (`production_target` >= 0),
  CONSTRAINT `production_batches_produced_nonnegative` CHECK (`produced_quantity` >= 0),
  CONSTRAINT `production_batches_status_valid` CHECK (`status` IN ('planned','in_progress','completed','cancelled'))
);
--> statement-breakpoint
CREATE INDEX `idx_production_batches_date_component` ON `production_batches` (`production_date`,`component_code`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_production_batches_parent_segment` ON `production_batches` (`parent_batch_id`,`segment_no`);
--> statement-breakpoint
CREATE TABLE `skin_packs` (
  `id` text PRIMARY KEY NOT NULL,
  `production_batch_id` text NOT NULL,
  `batch_sequence` integer NOT NULL,
  `skin_pack_code` text NOT NULL,
  `component_code` text NOT NULL,
  `cut_name_snapshot` text NOT NULL,
  `weight_g` integer NOT NULL,
  `traceability_no` text NOT NULL,
  `origin` text DEFAULT '' NOT NULL,
  `slaughterhouse` text DEFAULT '' NOT NULL,
  `cattle_type` text DEFAULT '' NOT NULL,
  `grade` text DEFAULT '' NOT NULL,
  `manufactured_at` text NOT NULL,
  `storage_method` text DEFAULT '' NOT NULL,
  `expiry_text` text DEFAULT '' NOT NULL,
  `packaging_material` text DEFAULT '' NOT NULL,
  `food_type` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'available' NOT NULL,
  `idempotency_key` text NOT NULL,
  `created_by` text NOT NULL,
  `assigned_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`production_batch_id`) REFERENCES `production_batches`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`traceability_no`) REFERENCES `traceability_records`(`traceability_no`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT `skin_packs_weight_positive` CHECK (`weight_g` > 0),
  CONSTRAINT `skin_packs_status_valid` CHECK (`status` IN ('available','assigned','voided','consumed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skin_packs_skin_pack_code_unique` ON `skin_packs` (`skin_pack_code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `skin_packs_idempotency_key_unique` ON `skin_packs` (`idempotency_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skin_packs_batch_sequence` ON `skin_packs` (`production_batch_id`,`batch_sequence`);
--> statement-breakpoint
CREATE INDEX `idx_skin_packs_available_component` ON `skin_packs` (`component_code`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_skin_packs_batch` ON `skin_packs` (`production_batch_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `skin_pack_labels` (
  `id` text PRIMARY KEY NOT NULL,
  `skin_pack_id` text NOT NULL,
  `version` integer NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `payload_json` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL,
  `printed_by` text,
  `printed_at` text,
  `voided_by` text,
  `voided_at` text,
  `void_reason` text,
  FOREIGN KEY (`skin_pack_id`) REFERENCES `skin_packs`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT `skin_pack_labels_status_valid` CHECK (`status` IN ('draft','printed','void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skin_pack_labels_version` ON `skin_pack_labels` (`skin_pack_id`,`version`);
--> statement-breakpoint
CREATE INDEX `idx_skin_pack_labels_status` ON `skin_pack_labels` (`skin_pack_id`,`status`);
--> statement-breakpoint
CREATE TABLE `packages` (
  `id` text PRIMARY KEY NOT NULL,
  `work_item_id` text,
  `package_sequence` integer,
  `assembly_key` text,
  `package_code` text NOT NULL,
  `product_id` text NOT NULL,
  `product_name_snapshot` text NOT NULL,
  `package_status` text DEFAULT 'queued' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `packages_package_code_unique` ON `packages` (`package_code`);
--> statement-breakpoint
CREATE INDEX `idx_packages_work_item` ON `packages` (`work_item_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_packages_work_item_sequence` ON `packages` (`work_item_id`,`package_sequence`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_packages_assembly_key` ON `packages` (`assembly_key`);
--> statement-breakpoint
CREATE INDEX `idx_packages_status` ON `packages` (`package_status`);
--> statement-breakpoint
CREATE TABLE `package_skin_packs` (
  `id` text PRIMARY KEY NOT NULL,
  `package_id` text NOT NULL,
  `skin_pack_id` text NOT NULL,
  `product_component_id` text NOT NULL,
  `quantity_slot` integer DEFAULT 1 NOT NULL,
  `assigned_by` text NOT NULL,
  `assigned_at` text NOT NULL,
  FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`skin_pack_id`) REFERENCES `skin_packs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_package_skin_packs_skin_pack` ON `package_skin_packs` (`skin_pack_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_package_skin_packs_component_slot` ON `package_skin_packs` (`package_id`,`product_component_id`,`quantity_slot`);
--> statement-breakpoint
CREATE INDEX `idx_package_skin_packs_package` ON `package_skin_packs` (`package_id`,`assigned_at`);
--> statement-breakpoint
INSERT OR REPLACE INTO products(id,category,code,name,subtitle,description,price,display_weight,image_url,badge,daily_limit,sort_order,active,created_at,updated_at) VALUES
('practical','진공세트','VAC-PRACTICAL','실속세트','부담 없이 전하는 알찬 구성','정일품의 기본 진공 포장 선물세트입니다.',144000,NULL,NULL,'실속',NULL,10,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('bonghwang','진공세트','VAC-BH','봉황세트','정일품 대표 명절 구성','감사의 마음을 정갈하게 담은 대표 선물세트입니다.',200000,NULL,NULL,'BEST',NULL,20,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('palyeong','진공세트','VAC-PY','팔영세트','더 풍성한 프리미엄 구성','귀한 분께 드리는 풍성한 진공 포장 세트입니다.',300000,NULL,NULL,NULL,NULL,30,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('jin','프리미엄','PRE-JIN','진','하루 20세트 한정','최상급 구성으로 준비하는 정일품 프리미엄 진 세트입니다.',320000,NULL,NULL,'PREMIUM',20,40,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('seon','프리미엄','PRE-SEON','선','하루 20세트 한정','품격과 실속을 균형 있게 담은 프리미엄 선 세트입니다.',270000,NULL,NULL,NULL,20,50,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('mi','프리미엄','PRE-MI','미','하루 30세트 한정','선물하기 좋은 구성의 프리미엄 미 세트입니다.',220000,NULL,NULL,NULL,30,60,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('omeat-signature','O''meat','OM-SIG','O''meat Signature','정일품 시그니처 큐레이션','오미트만의 감각적인 육류 큐레이션 세트입니다.',289000,NULL,NULL,'SIGNATURE',NULL,70,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('omeat-prestige','O''meat','OM-PRE','O''meat Prestige','최상위 프레스티지 구성','가장 특별한 분을 위한 오미트 최상위 세트입니다.',389000,NULL,NULL,'PRESTIGE',NULL,80,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('la-1','LA갈비','LA-1','LA갈비 1호','1.8kg · 미국산 Prime Excel','900g 두 팩으로 나누어 편리하게 구성했습니다.',99000,'1.8kg',NULL,NULL,NULL,90,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('la-2','LA갈비','LA-2','LA갈비 2호','2.7kg · 넉넉한 가족 구성','명절 가족 식탁에 알맞은 넉넉한 LA갈비 세트입니다.',148000,'2.7kg',NULL,NULL,NULL,100,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('bone-1','뼈세트','BONE-1','사골×우족','4~5kg 구성','정성스러운 보양식을 위한 사골과 우족 구성입니다.',59000,'4~5kg',NULL,NULL,NULL,110,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('bone-2','뼈세트','BONE-2','사골×잡뼈×꼬리','6~7kg 구성','사골, 잡뼈, 꼬리를 함께 담은 풍성한 보양 구성입니다.',99000,'6~7kg',NULL,NULL,NULL,120,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('custom-order','맞춤주문','CUSTOM','맞춤주문','','고객 요청에 따라 구성하는 맞춤주문',0,NULL,NULL,NULL,NULL,999,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA optimize;

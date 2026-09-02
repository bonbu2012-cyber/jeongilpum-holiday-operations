CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`rail_order` integer,
	`rail_label` text NOT NULL,
	`rail_assist` text,
	`rail_variant` text DEFAULT 'default' NOT NULL,
	`is_custom_order_link` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "categories_rail_variant_valid" CHECK("categories"."rail_variant" in ('default', 'single', 'omeat'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_name` ON `categories` (`name`);--> statement-breakpoint
CREATE INDEX `idx_categories_active_sort_order` ON `categories` (`active`,`sort_order`);--> statement-breakpoint
INSERT INTO categories(id,name,sort_order,rail_order,rail_label,rail_assist,rail_variant,is_custom_order_link,active,created_at,updated_at) VALUES
('vacuum-set','진공세트',0,0,'진공세트','VACUUM','default',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('premium-set','프리미엄',1,1,'프리미엄','PREMIUM','default',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('omeat','O''meat',2,4,'O''','meat','omeat',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('la-galbi','LA갈비',3,2,'LA갈비','LA','default',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('bone-set','뼈세트',4,3,'뼈세트',NULL,'single',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('custom-order','맞춤주문',5,NULL,'맞춤주문','CUSTOM ORDER','default',1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_production_batches` (
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
	CONSTRAINT "production_batches_required_nonnegative" CHECK("__new_production_batches"."required_quantity" >= 0),
	CONSTRAINT "production_batches_available_nonnegative" CHECK("__new_production_batches"."available_quantity_at_start" >= 0),
	CONSTRAINT "production_batches_additional_nonnegative" CHECK("__new_production_batches"."additional_needed" >= 0),
	CONSTRAINT "production_batches_target_nonnegative" CHECK("__new_production_batches"."production_target" >= 0),
	CONSTRAINT "production_batches_produced_nonnegative" CHECK("__new_production_batches"."produced_quantity" >= 0),
	CONSTRAINT "production_batches_status_valid" CHECK("__new_production_batches"."status" in ('planned', 'in_progress', 'completed', 'cancelled'))
);
--> statement-breakpoint
INSERT INTO `__new_production_batches`("id", "production_date", "parent_batch_id", "segment_no", "component_code", "cut_name_snapshot", "required_quantity", "available_quantity_at_start", "additional_needed", "production_target", "produced_quantity", "traceability_no", "origin", "slaughterhouse", "cattle_type", "grade", "storage_method", "expiry_text", "packaging_material", "food_type", "status", "started_by", "started_at", "completed_at", "created_at", "updated_at") SELECT "id", "production_date", "parent_batch_id", "segment_no", "component_code", "cut_name_snapshot", "required_quantity", "available_quantity_at_start", "additional_needed", "production_target", "produced_quantity", "traceability_no", "origin", "slaughterhouse", "cattle_type", "grade", "storage_method", "expiry_text", "packaging_material", "food_type", "status", "started_by", "started_at", "completed_at", "created_at", "updated_at" FROM `production_batches`;--> statement-breakpoint
DROP TABLE `production_batches`;--> statement-breakpoint
ALTER TABLE `__new_production_batches` RENAME TO `production_batches`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_production_batches_date_component` ON `production_batches` (`production_date`,`component_code`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_production_batches_parent_segment` ON `production_batches` (`parent_batch_id`,`segment_no`);--> statement-breakpoint
CREATE TABLE `__new_products` (
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
	FOREIGN KEY (`category`) REFERENCES `categories`(`name`) ON UPDATE cascade ON DELETE no action,
	CONSTRAINT "products_daily_limit_positive" CHECK("__new_products"."daily_limit" is null or "__new_products"."daily_limit" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "category", "code", "name", "subtitle", "description", "price", "display_weight", "image_url", "badge", "daily_limit", "sort_order", "active", "created_at", "updated_at") SELECT "id", "category", "code", "name", "subtitle", "description", "price", "display_weight", "image_url", "badge", "daily_limit", "sort_order", "active", "created_at", "updated_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);--> statement-breakpoint
CREATE INDEX `idx_products_active_sort_order` ON `products` (`active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_products_category` ON `products` (`category`);
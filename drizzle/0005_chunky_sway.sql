CREATE TABLE `package_assignment_history` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`from_order_id` text,
	`to_order_id` text NOT NULL,
	`reason` text NOT NULL,
	`changed_by` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_package_assignment_history_package` ON `package_assignment_history` (`package_id`,`changed_at`);--> statement-breakpoint
CREATE INDEX `idx_package_assignment_history_order` ON `package_assignment_history` (`to_order_id`,`changed_at`);--> statement-breakpoint
CREATE TABLE `package_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payload_json` text NOT NULL,
	`qr_value` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`printed_by` text,
	`printed_at` text,
	`voided_by` text,
	`voided_at` text,
	`void_reason` text,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "package_labels_status_valid" CHECK(status in ('draft','printed','void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_package_labels_version` ON `package_labels` (`package_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_package_labels_status` ON `package_labels` (`package_id`,`status`);--> statement-breakpoint
CREATE TABLE `package_skin_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`skin_pack_id` text NOT NULL,
	`product_component_id` text NOT NULL,
	`quantity_slot` integer DEFAULT 1 NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`skin_pack_id`) REFERENCES `skin_packs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_component_id`) REFERENCES `product_components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_package_skin_packs_skin_pack` ON `package_skin_packs` (`skin_pack_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_package_skin_packs_component_slot` ON `package_skin_packs` (`package_id`,`product_component_id`,`quantity_slot`);--> statement-breakpoint
CREATE INDEX `idx_package_skin_packs_package` ON `package_skin_packs` (`package_id`,`assigned_at`);--> statement-breakpoint
CREATE TABLE `product_components` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`component_code` text NOT NULL,
	`component_name` text NOT NULL,
	`quantity_per_product` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`traceability_required` integer DEFAULT true NOT NULL,
	`weight_required` integer DEFAULT true NOT NULL,
	`origin_required` integer DEFAULT false NOT NULL,
	`slaughterhouse_required` integer DEFAULT false NOT NULL,
	`storage_method_default` text DEFAULT '' NOT NULL,
	`expiry_text_default` text DEFAULT '' NOT NULL,
	`packaging_material_default` text DEFAULT '' NOT NULL,
	`food_type_default` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "product_components_quantity_positive" CHECK(quantity_per_product > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_components_code` ON `product_components` (`product_id`,`component_code`);--> statement-breakpoint
CREATE INDEX `idx_product_components_product_order` ON `product_components` (`product_id`,`active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_product_components_component_code` ON `product_components` (`component_code`,`active`);--> statement-breakpoint
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
	CONSTRAINT "production_batches_required_nonnegative" CHECK(required_quantity >= 0),
	CONSTRAINT "production_batches_available_nonnegative" CHECK(available_quantity_at_start >= 0),
	CONSTRAINT "production_batches_additional_nonnegative" CHECK(additional_needed >= 0),
	CONSTRAINT "production_batches_target_nonnegative" CHECK(production_target >= 0),
	CONSTRAINT "production_batches_produced_nonnegative" CHECK(produced_quantity >= 0),
	CONSTRAINT "production_batches_produced_within_target" CHECK(produced_quantity <= production_target),
	CONSTRAINT "production_batches_status_valid" CHECK(status in ('planned','in_progress','completed','cancelled'))
);
--> statement-breakpoint
CREATE INDEX `idx_production_batches_date_component` ON `production_batches` (`production_date`,`component_code`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_production_batches_parent_segment` ON `production_batches` (`parent_batch_id`,`segment_no`);--> statement-breakpoint
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
	CONSTRAINT "skin_pack_labels_status_valid" CHECK(status in ('draft','printed','void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skin_pack_labels_version` ON `skin_pack_labels` (`skin_pack_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_skin_pack_labels_status` ON `skin_pack_labels` (`skin_pack_id`,`status`);--> statement-breakpoint
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
	CONSTRAINT "skin_packs_weight_positive" CHECK(weight_g > 0),
	CONSTRAINT "skin_packs_status_valid" CHECK(status in ('available','assigned','voided','consumed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skin_packs_skin_pack_code_unique` ON `skin_packs` (`skin_pack_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `skin_packs_idempotency_key_unique` ON `skin_packs` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skin_packs_batch_sequence` ON `skin_packs` (`production_batch_id`,`batch_sequence`);--> statement-breakpoint
CREATE INDEX `idx_skin_packs_available_component` ON `skin_packs` (`component_code`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_skin_packs_batch` ON `skin_packs` (`production_batch_id`,`created_at`);--> statement-breakpoint
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
CREATE INDEX `idx_traceability_recent_worker` ON `traceability_records` (`last_used_by`,`last_used_at`);--> statement-breakpoint
ALTER TABLE `packages` ADD `order_item_id` text REFERENCES order_items(id);--> statement-breakpoint
ALTER TABLE `packages` ADD `package_sequence` integer;--> statement-breakpoint
ALTER TABLE `packages` ADD `assembly_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_packages_item_sequence` ON `packages` (`order_item_id`,`package_sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_packages_assembly_key` ON `packages` (`assembly_key`);
--> statement-breakpoint
INSERT OR IGNORE INTO product_components (id,product_id,component_code,component_name,quantity_per_product,sort_order,traceability_required,weight_required,origin_required,slaughterhouse_required,storage_method_default,expiry_text_default,packaging_material_default,food_type_default,active,created_at,updated_at) VALUES
('palyeong-cm','palyeong','CM','치마살',1,10,1,1,0,0,'','','','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('palyeong-bc','palyeong','BC','부채살',1,20,1,1,0,0,'','','','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('palyeong-uj','palyeong','UJ','업진살',1,30,1,1,0,0,'','','','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('palyeong-gb','palyeong','GB','갈비살',1,40,1,1,0,0,'','','','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('palyeong-jj','palyeong','JJ','제비추리',1,50,1,1,0,0,'','','','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
--> statement-breakpoint
PRAGMA optimize;

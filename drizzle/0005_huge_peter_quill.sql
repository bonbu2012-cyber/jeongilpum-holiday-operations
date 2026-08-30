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
CREATE TABLE `package_components` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`product_component_id` text,
	`component_name_snapshot` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`traceability_required` integer DEFAULT true NOT NULL,
	`weight_required` integer DEFAULT true NOT NULL,
	`origin_required` integer DEFAULT false NOT NULL,
	`slaughterhouse_required` integer DEFAULT false NOT NULL,
	`traceability_no` text,
	`weight_g` integer,
	`origin` text DEFAULT '' NOT NULL,
	`slaughterhouse` text DEFAULT '' NOT NULL,
	`entered_by` text,
	`entered_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_component_id`) REFERENCES `product_components`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`traceability_no`) REFERENCES `traceability_records`(`traceability_no`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "package_components_weight_positive" CHECK("package_components"."weight_g" is null or "package_components"."weight_g" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_package_components_template` ON `package_components` (`package_id`,`product_component_id`);--> statement-breakpoint
CREATE INDEX `idx_package_components_package_order` ON `package_components` (`package_id`,`sort_order`);--> statement-breakpoint
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
	CONSTRAINT "package_labels_status_valid" CHECK("package_labels"."status" in ('draft', 'printed', 'void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_package_labels_version` ON `package_labels` (`package_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_package_labels_status` ON `package_labels` (`package_id`,`status`);--> statement-breakpoint
CREATE TABLE `product_components` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`component_code` text NOT NULL,
	`component_name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`traceability_required` integer DEFAULT true NOT NULL,
	`weight_required` integer DEFAULT true NOT NULL,
	`origin_required` integer DEFAULT false NOT NULL,
	`slaughterhouse_required` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_components_code` ON `product_components` (`product_id`,`component_code`);--> statement-breakpoint
CREATE INDEX `idx_product_components_product_order` ON `product_components` (`product_id`,`active`,`sort_order`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `idx_packages_item_sequence` ON `packages` (`order_item_id`,`package_sequence`);
--> statement-breakpoint
INSERT OR IGNORE INTO product_components (id,product_id,component_code,component_name,sort_order,traceability_required,weight_required,origin_required,slaughterhouse_required,active,created_at,updated_at) VALUES
('palyeong-skirt','palyeong','SKIRT','치마살',10,1,1,0,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('palyeong-flat-iron','palyeong','FLAT_IRON','부채살',20,1,1,0,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('palyeong-short-plate','palyeong','SHORT_PLATE','업진살',30,1,1,0,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('palyeong-rib','palyeong','RIB','갈비살',40,1,1,0,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('palyeong-chuck-tender','palyeong','CHUCK_TENDER','제비추리',50,1,1,0,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
--> statement-breakpoint
PRAGMA optimize;

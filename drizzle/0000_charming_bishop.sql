CREATE TABLE `operational_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`target_role` text NOT NULL,
	`order_id` text,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`requires_ack` integer DEFAULT false NOT NULL,
	`acknowledged_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_alerts_role_ack` ON `operational_alerts` (`target_role`,`acknowledged_at`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`event_type` text NOT NULL,
	`before_data` text,
	`after_data` text,
	`reason` text,
	`actor_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_order_events_order` ON `order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name_snapshot` text NOT NULL,
	`list_price_snapshot` integer NOT NULL,
	`sale_unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`line_total` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_order_items_order` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_no` text NOT NULL,
	`season_id` text NOT NULL,
	`buyer_name_snapshot` text NOT NULL,
	`buyer_phone_snapshot` text NOT NULL,
	`order_status` text DEFAULT 'submitted' NOT NULL,
	`fulfillment_type` text NOT NULL,
	`schedule_label` text NOT NULL,
	`recipient_name` text,
	`recipient_phone` text,
	`road_address` text,
	`detail_address` text,
	`customer_note` text DEFAULT '' NOT NULL,
	`total_amount` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`submitted_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `sales_seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_orders_idempotency` ON `orders` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_orders_phone` ON `orders` (`buyer_phone_snapshot`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`order_status`);--> statement-breakpoint
CREATE INDEX `idx_orders_schedule` ON `orders` (`schedule_label`);--> statement-breakpoint
CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`package_code` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name_snapshot` text NOT NULL,
	`package_status` text DEFAULT 'queued' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `packages_package_code_unique` ON `packages` (`package_code`);--> statement-breakpoint
CREATE INDEX `idx_packages_order` ON `packages` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_packages_status` ON `packages` (`package_status`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` integer NOT NULL,
	`customer_display_weight` text,
	`image_url` text,
	`badge` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);--> statement-breakpoint
CREATE INDEX `idx_products_active_order` ON `products` (`active`,`display_order`);--> statement-breakpoint
CREATE INDEX `idx_products_category` ON `products` (`category`);--> statement-breakpoint
CREATE TABLE `sales_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`holiday_date` text NOT NULL,
	`sales_start_date` text NOT NULL,
	`sales_end_date` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER orders_no_hard_delete BEFORE DELETE ON orders BEGIN SELECT RAISE(ABORT, 'orders cannot be deleted'); END;
--> statement-breakpoint
CREATE TRIGGER order_items_positive_insert BEFORE INSERT ON order_items WHEN NEW.quantity <= 0 BEGIN SELECT RAISE(ABORT, 'quantity must be positive'); END;
--> statement-breakpoint
CREATE TRIGGER order_items_positive_update BEFORE UPDATE OF quantity ON order_items WHEN NEW.quantity <= 0 BEGIN SELECT RAISE(ABORT, 'quantity must be positive'); END;
--> statement-breakpoint
CREATE TRIGGER orders_status_insert BEFORE INSERT ON orders WHEN NEW.order_status NOT IN ('submitted','confirmed','in_progress','ready','fulfilled','cancelled') BEGIN SELECT RAISE(ABORT, 'invalid order status'); END;
--> statement-breakpoint
CREATE TRIGGER orders_status_update BEFORE UPDATE OF order_status ON orders WHEN NEW.order_status NOT IN ('submitted','confirmed','in_progress','ready','fulfilled','cancelled') BEGIN SELECT RAISE(ABORT, 'invalid order status'); END;
--> statement-breakpoint
INSERT OR IGNORE INTO sales_seasons(id,name,holiday_date,sales_start_date,sales_end_date,active) VALUES('season-2026-chuseok','2026 추석','2026-09-25','2026-08-01','2026-09-25',1);
--> statement-breakpoint
INSERT OR IGNORE INTO products(id,category,code,name,subtitle,description,price,customer_display_weight,image_url,badge,display_order,active) VALUES
('practical','진공세트','VAC-PRACTICAL','실속세트','부담 없이 전하는 알찬 구성','정일품의 기본 진공 포장 선물세트입니다.',144000,NULL,NULL,'실속',10,1),
('bonghwang','진공세트','VAC-BH','봉황세트','정일품 대표 명절 구성','감사의 마음을 정갈하게 담은 대표 선물세트입니다.',200000,NULL,NULL,'BEST',20,1),
('palyeong','진공세트','VAC-PY','팔영세트','더 풍성한 프리미엄 구성','귀한 분께 드리는 풍성한 진공 포장 세트입니다.',300000,NULL,NULL,NULL,30,1),
('jin','프리미엄','PRE-JIN','진','하루 20세트 한정','최상급 구성으로 준비하는 정일품 프리미엄 진 세트입니다.',320000,NULL,NULL,'PREMIUM',40,1),
('seon','프리미엄','PRE-SEON','선','하루 20세트 한정','품격과 실속을 균형 있게 담은 프리미엄 선 세트입니다.',270000,NULL,NULL,NULL,50,1),
('mi','프리미엄','PRE-MI','미','하루 30세트 한정','선물하기 좋은 구성의 프리미엄 미 세트입니다.',220000,NULL,NULL,NULL,60,1),
('omeat-signature','O''meat','OM-SIG','O''meat Signature','정일품 시그니처 큐레이션','오미트만의 감각적인 육류 큐레이션 세트입니다.',289000,NULL,NULL,'SIGNATURE',70,1),
('omeat-prestige','O''meat','OM-PRE','O''meat Prestige','최상위 프레스티지 구성','가장 특별한 분을 위한 오미트 최상위 세트입니다.',389000,NULL,NULL,'PRESTIGE',80,1),
('la-1','LA갈비','LA-1','LA갈비 1호','1.8kg · 미국산 Prime Excel','900g 두 팩으로 나누어 편리하게 구성했습니다.',99000,'1.8kg',NULL,NULL,90,1),
('la-2','LA갈비','LA-2','LA갈비 2호','2.7kg · 넉넉한 가족 구성','명절 가족 식탁에 알맞은 넉넉한 LA갈비 세트입니다.',148000,'2.7kg',NULL,NULL,100,1),
('bone-1','뼈세트','BONE-1','사골×우족','4~5kg 구성','정성스러운 보양식을 위한 사골과 우족 구성입니다.',59000,'4~5kg',NULL,NULL,110,1),
('bone-2','뼈세트','BONE-2','사골×잡뼈×꼬리','6~7kg 구성','사골, 잡뼈, 꼬리를 함께 담은 풍성한 보양 구성입니다.',99000,'6~7kg',NULL,NULL,120,1);
--> statement-breakpoint
PRAGMA optimize;

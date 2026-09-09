CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`rail_order` integer,
	`rail_label` text DEFAULT '' NOT NULL,
	`rail_assist` text,
	`rail_variant` text DEFAULT 'default' NOT NULL,
	`is_custom_order_link` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "categories_rail_variant_valid" CHECK("categories"."rail_variant" in ('default', 'single', 'omeat'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_name` ON `categories` (`name`);--> statement-breakpoint
CREATE INDEX `idx_categories_active_sort_order` ON `categories` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `work_item_events` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text,
	`order_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_value` text,
	`to_value` text,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_work_item_events_work_item_created` ON `work_item_events` (`work_item_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_work_item_events_order_created` ON `work_item_events` (`order_id`,`created_at`);--> statement-breakpoint
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
	CONSTRAINT "work_items_quantity_positive" CHECK("work_items"."quantity" >= 0),
	CONSTRAINT "work_items_line_total_nonnegative" CHECK("work_items"."line_total" >= 0),
	CONSTRAINT "work_items_delivery_method_valid" CHECK("work_items"."delivery_method" in ('onsite_sale', 'onsite_reservation', 'delivery')),
	CONSTRAINT "work_items_status_valid" CHECK("work_items"."work_status" in ('received', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `idx_work_items_order` ON `work_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_work_items_due_status` ON `work_items` (`due_at`,`work_status`);--> statement-breakpoint
CREATE INDEX `idx_work_items_product_due` ON `work_items` (`product_id`,`due_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `buyer_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `buyer_phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_status` text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_arrived_at` text;--> statement-breakpoint
CREATE INDEX `idx_orders_buyer_phone` ON `orders` (`buyer_phone`);--> statement-breakpoint
ALTER TABLE `packages` ADD `work_item_id` text REFERENCES work_items(id);--> statement-breakpoint
ALTER TABLE `products` ADD `display_weight` text;--> statement-breakpoint
ALTER TABLE `products` ADD `daily_limit` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `created_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO categories(id,name,sort_order,rail_order,rail_label,rail_assist,rail_variant,is_custom_order_link,active,created_at,updated_at) VALUES
('vacuum-set','진공세트',0,0,'진공세트','VACUUM','default',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('premium-set','프리미엄',1,1,'프리미엄','PREMIUM','default',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('omeat','O''meat',2,4,'O''','meat','omeat',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('la-galbi','LA갈비',3,2,'LA갈비','LA','default',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('bone-set','뼈세트',4,3,'뼈세트',NULL,'single',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('custom-order','맞춤주문',5,NULL,'맞춤주문','CUSTOM ORDER','default',1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);--> statement-breakpoint
UPDATE products
SET display_weight=customer_display_weight,
    daily_limit=(SELECT l.daily_limit FROM product_daily_limits l WHERE l.product_id=products.id AND l.active=1),
    sort_order=display_order,
    created_at=COALESCE(NULLIF(updated_at,''),CURRENT_TIMESTAMP);--> statement-breakpoint
UPDATE orders
SET buyer_name=buyer_name_snapshot,
    buyer_phone=buyer_phone_snapshot,
    paid_amount=COALESCE((
      SELECT SUM(CASE
        WHEN p.type='payment' THEN p.amount
        WHEN p.type='refund' THEN -p.amount
        ELSE p.amount
      END)
      FROM payments p
      WHERE p.order_id=orders.id
    ),0),
    payment_status=CASE
      WHEN COALESCE((
        SELECT SUM(CASE
          WHEN p.type='payment' THEN p.amount
          WHEN p.type='refund' THEN -p.amount
          ELSE p.amount
        END)
        FROM payments p
        WHERE p.order_id=orders.id
      ),0) >= total_amount THEN 'paid'
      WHEN COALESCE((
        SELECT SUM(CASE
          WHEN p.type='payment' THEN p.amount
          WHEN p.type='refund' THEN -p.amount
          ELSE p.amount
        END)
        FROM payments p
        WHERE p.order_id=orders.id
      ),0) > 0 THEN 'partial'
      ELSE 'unpaid'
    END,
    customer_arrived_at=(
      SELECT CASE WHEN f.customer_arrived=1 THEN COALESCE(f.updated_at,f.pickup_at) ELSE NULL END
      FROM fulfillments f
      WHERE f.order_id=orders.id
      LIMIT 1
    );--> statement-breakpoint
INSERT OR IGNORE INTO work_items(
  id,order_id,product_id,product_name_snapshot,unit_price_snapshot,quantity,line_total,
  delivery_method,due_at,work_status,recipient_name,recipient_phone,postal_code,road_addr,
  road_addr_reference,jibun_addr,detail_addr,customization_json,note,version,created_at,updated_at
)
SELECT
  'legacy-' || i.id,
  i.order_id,
  i.product_id,
  i.product_name_snapshot,
  i.sale_unit_price,
  i.quantity,
  i.line_total,
  CASE
    WHEN f.fulfillment_type='shipping' THEN 'delivery'
    WHEN f.fulfillment_type='onsite' THEN 'onsite_sale'
    ELSE 'onsite_reservation'
  END,
  COALESCE(f.pickup_at,CASE WHEN f.ship_date IS NOT NULL THEN f.ship_date || 'T00:00:00+09:00' END,o.submitted_at),
  CASE o.order_status
    WHEN 'submitted' THEN 'received'
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'ready' THEN 'ready'
    WHEN 'fulfilled' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'received'
  END,
  f.recipient_name,
  f.recipient_phone,
  f.postal_code,
  f.road_addr,
  f.road_addr_reference,
  f.jibun_addr,
  f.detail_addr,
  NULLIF(c.other_request,''),
  COALESCE(NULLIF(f.note,''),o.customer_note,''),
  o.version,
  i.created_at,
  COALESCE(o.updated_at,i.created_at)
FROM order_items i
JOIN orders o ON o.id=i.order_id
LEFT JOIN fulfillments f ON f.order_id=i.order_id
LEFT JOIN order_item_customizations c ON c.order_item_id=i.id;--> statement-breakpoint
UPDATE packages
SET work_item_id='legacy-' || order_item_id
WHERE work_item_id IS NULL AND order_item_id IS NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO work_item_events(
  id,work_item_id,order_id,event_type,from_value,to_value,actor,created_at
)
SELECT
  'migration-' || i.id,
  'legacy-' || i.id,
  i.order_id,
  'legacy_order_migrated',
  NULL,
  json_object('source','legacy_order_items'),
  'system:migration',
  i.created_at
FROM order_items i;

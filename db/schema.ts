import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(),
  customerDisplayWeight: text("customer_display_weight"),
  imageUrl: text("image_url"),
  badge: text("badge"),
  displayOrder: integer("display_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [
  index("idx_products_active_order").on(table.active, table.displayOrder),
  index("idx_products_category").on(table.category),
]);

export const salesSeasons = sqliteTable("sales_seasons", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  holidayDate: text("holiday_date").notNull(),
  salesStartDate: text("sales_start_date").notNull(),
  salesEndDate: text("sales_end_date").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  orderNo: text("order_no").notNull().unique(),
  seasonId: text("season_id").notNull().references(() => salesSeasons.id),
  buyerNameSnapshot: text("buyer_name_snapshot").notNull(),
  buyerPhoneSnapshot: text("buyer_phone_snapshot").notNull(),
  orderStatus: text("order_status").notNull().default("submitted"),
  fulfillmentType: text("fulfillment_type").notNull(),
  scheduleLabel: text("schedule_label").notNull(),
  recipientName: text("recipient_name"),
  recipientPhone: text("recipient_phone"),
  roadAddress: text("road_address"),
  detailAddress: text("detail_address"),
  customerNote: text("customer_note").notNull().default(""),
  totalAmount: integer("total_amount").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  version: integer("version").notNull().default(1),
  submittedAt: text("submitted_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_orders_idempotency").on(table.idempotencyKey),
  index("idx_orders_phone").on(table.buyerPhoneSnapshot),
  index("idx_orders_status").on(table.orderStatus),
  index("idx_orders_schedule").on(table.scheduleLabel),
]);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  productId: text("product_id").notNull().references(() => products.id),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  listPriceSnapshot: integer("list_price_snapshot").notNull(),
  saleUnitPrice: integer("sale_unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: integer("line_total").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_order_items_order").on(table.orderId)]);

export const packages = sqliteTable("packages", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  packageCode: text("package_code").notNull().unique(),
  productId: text("product_id").notNull().references(() => products.id),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  packageStatus: text("package_status").notNull().default("queued"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_packages_order").on(table.orderId),
  index("idx_packages_status").on(table.packageStatus),
]);

export const operationalAlerts = sqliteTable("operational_alerts", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  targetRole: text("target_role").notNull(),
  orderId: text("order_id").references(() => orders.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  requiresAck: integer("requires_ack", { mode: "boolean" }).notNull().default(false),
  acknowledgedAt: text("acknowledged_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_alerts_role_ack").on(table.targetRole, table.acknowledgedAt)]);

export const orderEvents = sqliteTable("order_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  eventType: text("event_type").notNull(),
  beforeData: text("before_data"),
  afterData: text("after_data"),
  reason: text("reason"),
  actorId: text("actor_id"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_order_events_order").on(table.orderId, table.createdAt)]);

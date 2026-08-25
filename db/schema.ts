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
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at"),
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
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at"),
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

export const fulfillments = sqliteTable("fulfillments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  fulfillmentType: text("fulfillment_type").notNull(),
  pickupAt: text("pickup_at"),
  shipDate: text("ship_date"),
  recipientName: text("recipient_name"),
  recipientPhone: text("recipient_phone"),
  postalCode: text("postal_code"),
  roadAddr: text("road_addr"),
  roadAddrReference: text("road_addr_reference"),
  jibunAddr: text("jibun_addr"),
  detailAddr: text("detail_addr"),
  status: text("status").notNull().default("scheduled"),
  customerArrived: integer("customer_arrived", { mode: "boolean" }).notNull().default(false),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_fulfillments_order").on(table.orderId),
  index("idx_fulfillments_pickup_at").on(table.pickupAt),
  index("idx_fulfillments_ship_date").on(table.shipDate),
  index("idx_fulfillments_status").on(table.status),
]);

export const fulfillmentItems = sqliteTable("fulfillment_items", {
  id: text("id").primaryKey(),
  fulfillmentId: text("fulfillment_id").notNull().references(() => fulfillments.id),
  orderItemId: text("order_item_id").notNull().references(() => orderItems.id),
  quantity: integer("quantity").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_fulfillment_items_fulfillment").on(table.fulfillmentId),
  uniqueIndex("idx_fulfillment_items_pair").on(table.fulfillmentId, table.orderItemId),
]);

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

export const customOrderRequests = sqliteTable("custom_order_requests", {
  id: text("id").primaryKey(),
  requestNo: text("request_no").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  giftType: text("gift_type").notNull(),
  quantity: integer("quantity").notNull(),
  budgetRange: text("budget_range").notNull(),
  fulfillmentPreference: text("fulfillment_preference").notNull(),
  preferredSchedule: text("preferred_schedule").notNull().default(""),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("submitted"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_custom_orders_idempotency").on(table.idempotencyKey),
  index("idx_custom_orders_status_created").on(table.status, table.createdAt),
  index("idx_custom_orders_phone").on(table.customerPhone),
]);

export const customOrderEvents = sqliteTable("custom_order_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().references(() => customOrderRequests.id),
  eventType: text("event_type").notNull(),
  afterData: text("after_data"),
  actorId: text("actor_id"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_custom_order_events_request").on(table.requestId, table.createdAt)]);

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

export const configurationEvents = sqliteTable("configuration_events", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeData: text("before_data"),
  afterData: text("after_data"),
  actorId: text("actor_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_configuration_events_entity").on(table.entityType, table.entityId, table.createdAt)]);

import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const orderItemCustomizations = sqliteTable("order_item_customizations", {
  id: text("id").primaryKey(),
  orderItemId: text("order_item_id").notNull().references(() => orderItems.id),
  category: text("category").notNull(),
  budgetOption: text("budget_option").notNull(),
  desiredComposition: text("desired_composition").notNull().default(""),
  preferredCut: text("preferred_cut").notNull().default(""),
  fatPreference: text("fat_preference").notNull().default(""),
  packagingRequest: text("packaging_request").notNull().default(""),
  otherRequest: text("other_request").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_order_item_customizations_item").on(table.orderItemId),
]);

export const productDailyLimits = sqliteTable("product_daily_limits", {
  productId: text("product_id").primaryKey().references(() => products.id),
  dailyLimit: integer("daily_limit").notNull(),
  scheduleBasis: text("schedule_basis").notNull().default("fulfillment_date"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("product_daily_limits_positive", sql`${table.dailyLimit} > 0`),
]);

export const productDailyReservations = sqliteTable("product_daily_reservations", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  orderItemId: text("order_item_id").notNull().references(() => orderItems.id),
  productId: text("product_id").notNull().references(() => products.id),
  reserveDate: text("reserve_date").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  releasedAt: text("released_at"),
}, (table) => [
  uniqueIndex("idx_daily_reservations_item").on(table.orderItemId),
  index("idx_daily_reservations_product_date").on(table.productId, table.reserveDate, table.status),
  index("idx_daily_reservations_order").on(table.orderId),
  check("product_daily_reservations_quantity_positive", sql`${table.quantity} > 0`),
  check("product_daily_reservations_status_valid", sql`${table.status} in ('active', 'released')`),
]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  type: text("type").notNull(),
  method: text("method"),
  amount: integer("amount").notNull(),
  paidAt: text("paid_at").notNull(),
  recordedBy: text("recorded_by").notNull(),
  memo: text("memo").notNull().default(""),
  relatedPaymentId: text("related_payment_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_payments_idempotency").on(table.idempotencyKey),
  index("idx_payments_order_paid_at").on(table.orderId, table.paidAt),
  check("payments_valid_entry", sql`
    (${table.type} = 'payment' and ${table.method} is not null and ${table.method} in ('card', 'cash', 'bank_transfer') and ${table.amount} > 0)
    or (${table.type} = 'refund' and ${table.amount} > 0)
    or (${table.type} = 'adjustment' and ${table.amount} <> 0)
  `),
]);

export const orderCreditTerms = sqliteTable("order_credit_terms", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  outstandingAmount: integer("outstanding_amount").notNull(),
  dueDate: text("due_date"),
  memo: text("memo").notNull().default(""),
  status: text("status").notNull().default("open"),
  recordedBy: text("recorded_by").notNull(),
  createdAt: text("created_at").notNull(),
  settledAt: text("settled_at"),
}, (table) => [
  index("idx_order_credit_terms_order_status").on(table.orderId, table.status),
  check("order_credit_terms_outstanding_positive", sql`${table.outstandingAmount} > 0`),
  check("order_credit_terms_status_valid", sql`${table.status} in ('open', 'settled')`),
]);

export const customerAccounts = sqliteTable("customer_accounts", {
  id: text("id").primaryKey(),
  normalizedName: text("normalized_name").notNull(),
  normalizedPhone: text("normalized_phone").notNull(),
  displayName: text("display_name").notNull(),
  displayPhone: text("display_phone").notNull(),
  ledgerSequence: integer("ledger_sequence").notNull().default(1),
  ledgerLabel: text("ledger_label").notNull().default(""),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_customer_accounts_identity_sequence").on(table.normalizedName, table.normalizedPhone, table.ledgerSequence),
  index("idx_customer_accounts_phone").on(table.normalizedPhone, table.isPrimary),
]);

export const orderCustomerAccounts = sqliteTable("order_customer_accounts", {
  orderId: text("order_id").primaryKey().references(() => orders.id),
  customerAccountId: text("customer_account_id").notNull().references(() => customerAccounts.id),
  linkedAt: text("linked_at").notNull(),
  linkedBy: text("linked_by"),
  linkReason: text("link_reason").notNull().default("order_identity"),
}, (table) => [
  index("idx_order_customer_accounts_customer").on(table.customerAccountId, table.linkedAt),
]);

export const customerLedgerTransactions = sqliteTable("customer_ledger_transactions", {
  id: text("id").primaryKey(),
  customerAccountId: text("customer_account_id").notNull().references(() => customerAccounts.id),
  type: text("type").notNull(),
  method: text("method"),
  amount: integer("amount").notNull(),
  transactedAt: text("transacted_at").notNull(),
  payerName: text("payer_name"),
  payerPhone: text("payer_phone"),
  payerRelation: text("payer_relation"),
  memo: text("memo").notNull().default(""),
  relatedTransactionId: text("related_transaction_id"),
  consultationId: text("consultation_id"),
  legacyPaymentId: text("legacy_payment_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  recordedBy: text("recorded_by").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_customer_ledger_transactions_idempotency").on(table.idempotencyKey),
  uniqueIndex("idx_customer_ledger_transactions_legacy_payment").on(table.legacyPaymentId),
  index("idx_customer_ledger_transactions_customer_time").on(table.customerAccountId, table.transactedAt),
  uniqueIndex("idx_customer_ledger_transactions_reversal_once")
    .on(table.relatedTransactionId)
    .where(sql`${table.type} = 'reversal'`),
  check("customer_ledger_transactions_valid", sql`
    (${table.type} = 'payment' and ${table.method} in ('card', 'cash', 'bank_transfer') and ${table.amount} > 0)
    or (${table.type} = 'reversal' and ${table.amount} > 0 and ${table.relatedTransactionId} is not null)
    or (${table.type} in ('transfer_in', 'transfer_out') and ${table.amount} > 0 and ${table.consultationId} is not null)
    or (${table.type} = 'adjustment' and ${table.amount} <> 0)
  `),
]);

export const customerLedgerConsultations = sqliteTable("customer_ledger_consultations", {
  id: text("id").primaryKey(),
  customerAccountId: text("customer_account_id").notNull().references(() => customerAccounts.id),
  note: text("note").notNull(),
  status: text("status").notNull().default("pending"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  appliedBy: text("applied_by"),
  appliedAt: text("applied_at"),
  targetCustomerAccountId: text("target_customer_account_id").references(() => customerAccounts.id),
  transferAmount: integer("transfer_amount").notNull().default(0),
  applicationMemo: text("application_memo").notNull().default(""),
}, (table) => [
  index("idx_customer_ledger_consultations_customer_status").on(table.customerAccountId, table.status, table.createdAt),
  check("customer_ledger_consultations_status_valid", sql`${table.status} in ('pending', 'applied')`),
  check("customer_ledger_consultations_transfer_nonnegative", sql`${table.transferAmount} >= 0`),
]);

export const customerLedgerConsultationOrders = sqliteTable("customer_ledger_consultation_orders", {
  id: text("id").primaryKey(),
  consultationId: text("consultation_id").notNull().references(() => customerLedgerConsultations.id),
  orderId: text("order_id").notNull().references(() => orders.id),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_customer_ledger_consultation_order").on(table.consultationId, table.orderId),
  index("idx_customer_ledger_consultation_orders_order").on(table.orderId),
]);

export const customerLedgerEvents = sqliteTable("customer_ledger_events", {
  id: text("id").primaryKey(),
  customerAccountId: text("customer_account_id").notNull().references(() => customerAccounts.id),
  eventType: text("event_type").notNull(),
  beforeData: text("before_data"),
  afterData: text("after_data"),
  reason: text("reason"),
  actorId: text("actor_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_customer_ledger_events_customer_time").on(table.customerAccountId, table.createdAt),
]);

export const packages = sqliteTable("packages", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  orderItemId: text("order_item_id").references(() => orderItems.id),
  packageSequence: integer("package_sequence"),
  assemblyKey: text("assembly_key"),
  packageCode: text("package_code").notNull().unique(),
  productId: text("product_id").notNull().references(() => products.id),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  packageStatus: text("package_status").notNull().default("queued"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_packages_order").on(table.orderId),
  uniqueIndex("idx_packages_item_sequence").on(table.orderItemId, table.packageSequence),
  uniqueIndex("idx_packages_assembly_key").on(table.assemblyKey),
  index("idx_packages_status").on(table.packageStatus),
]);

export const productComponents = sqliteTable("product_components", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id),
  componentCode: text("component_code").notNull(),
  componentName: text("component_name").notNull(),
  quantityPerProduct: integer("quantity_per_product").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  traceabilityRequired: integer("traceability_required", { mode: "boolean" }).notNull().default(true),
  weightRequired: integer("weight_required", { mode: "boolean" }).notNull().default(true),
  originRequired: integer("origin_required", { mode: "boolean" }).notNull().default(false),
  slaughterhouseRequired: integer("slaughterhouse_required", { mode: "boolean" }).notNull().default(false),
  storageMethodDefault: text("storage_method_default").notNull().default(""),
  expiryTextDefault: text("expiry_text_default").notNull().default(""),
  packagingMaterialDefault: text("packaging_material_default").notNull().default(""),
  foodTypeDefault: text("food_type_default").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_product_components_code").on(table.productId, table.componentCode),
  index("idx_product_components_product_order").on(table.productId, table.active, table.sortOrder),
  index("idx_product_components_component_code").on(table.componentCode, table.active),
  check("product_components_quantity_positive", sql.raw("quantity_per_product > 0")),
]);

export const traceabilityRecords = sqliteTable("traceability_records", {
  traceabilityNo: text("traceability_no").primaryKey(),
  lastRawScan: text("last_raw_scan").notNull(),
  origin: text("origin").notNull().default(""),
  slaughterhouse: text("slaughterhouse").notNull().default(""),
  cattleType: text("cattle_type").notNull().default(""),
  grade: text("grade").notNull().default(""),
  source: text("source").notNull().default("manual"),
  verifiedAt: text("verified_at"),
  lastUsedBy: text("last_used_by").notNull(),
  lastUsedAt: text("last_used_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_traceability_recent_worker").on(table.lastUsedBy, table.lastUsedAt),
]);

export const productionBatches = sqliteTable("production_batches", {
  id: text("id").primaryKey(),
  productionDate: text("production_date").notNull(),
  parentBatchId: text("parent_batch_id"),
  segmentNo: integer("segment_no").notNull().default(1),
  componentCode: text("component_code").notNull(),
  cutNameSnapshot: text("cut_name_snapshot").notNull(),
  requiredQuantity: integer("required_quantity").notNull(),
  availableQuantityAtStart: integer("available_quantity_at_start").notNull(),
  additionalNeeded: integer("additional_needed").notNull(),
  productionTarget: integer("production_target").notNull(),
  producedQuantity: integer("produced_quantity").notNull().default(0),
  traceabilityNo: text("traceability_no").notNull().references(() => traceabilityRecords.traceabilityNo),
  origin: text("origin").notNull().default(""),
  slaughterhouse: text("slaughterhouse").notNull().default(""),
  cattleType: text("cattle_type").notNull().default(""),
  grade: text("grade").notNull().default(""),
  storageMethod: text("storage_method").notNull().default(""),
  expiryText: text("expiry_text").notNull().default(""),
  packagingMaterial: text("packaging_material").notNull().default(""),
  foodType: text("food_type").notNull().default(""),
  status: text("status").notNull().default("in_progress"),
  startedBy: text("started_by").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_production_batches_date_component").on(table.productionDate, table.componentCode, table.status),
  uniqueIndex("idx_production_batches_parent_segment").on(table.parentBatchId, table.segmentNo),
  check("production_batches_required_nonnegative", sql.raw("required_quantity >= 0")),
  check("production_batches_available_nonnegative", sql.raw("available_quantity_at_start >= 0")),
  check("production_batches_additional_nonnegative", sql.raw("additional_needed >= 0")),
  check("production_batches_target_nonnegative", sql.raw("production_target >= 0")),
  check("production_batches_produced_nonnegative", sql.raw("produced_quantity >= 0")),
  check("production_batches_produced_within_target", sql.raw("produced_quantity <= production_target")),
  check("production_batches_status_valid", sql.raw("status in ('planned','in_progress','completed','cancelled')")),
]);

export const skinPacks = sqliteTable("skin_packs", {
  id: text("id").primaryKey(),
  productionBatchId: text("production_batch_id").notNull().references(() => productionBatches.id),
  batchSequence: integer("batch_sequence").notNull(),
  skinPackCode: text("skin_pack_code").notNull().unique(),
  componentCode: text("component_code").notNull(),
  cutNameSnapshot: text("cut_name_snapshot").notNull(),
  weightG: integer("weight_g").notNull(),
  traceabilityNo: text("traceability_no").notNull().references(() => traceabilityRecords.traceabilityNo),
  origin: text("origin").notNull().default(""),
  slaughterhouse: text("slaughterhouse").notNull().default(""),
  cattleType: text("cattle_type").notNull().default(""),
  grade: text("grade").notNull().default(""),
  manufacturedAt: text("manufactured_at").notNull(),
  storageMethod: text("storage_method").notNull().default(""),
  expiryText: text("expiry_text").notNull().default(""),
  packagingMaterial: text("packaging_material").notNull().default(""),
  foodType: text("food_type").notNull().default(""),
  status: text("status").notNull().default("available"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdBy: text("created_by").notNull(),
  assignedAt: text("assigned_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_skin_packs_batch_sequence").on(table.productionBatchId, table.batchSequence),
  index("idx_skin_packs_available_component").on(table.componentCode, table.status, table.createdAt),
  index("idx_skin_packs_batch").on(table.productionBatchId, table.createdAt),
  check("skin_packs_weight_positive", sql.raw("weight_g > 0")),
  check("skin_packs_status_valid", sql.raw("status in ('available','assigned','voided','consumed')")),
]);

export const skinPackLabels = sqliteTable("skin_pack_labels", {
  id: text("id").primaryKey(),
  skinPackId: text("skin_pack_id").notNull().references(() => skinPacks.id),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  payloadJson: text("payload_json").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  printedBy: text("printed_by"),
  printedAt: text("printed_at"),
  voidedBy: text("voided_by"),
  voidedAt: text("voided_at"),
  voidReason: text("void_reason"),
}, (table) => [
  uniqueIndex("idx_skin_pack_labels_version").on(table.skinPackId, table.version),
  index("idx_skin_pack_labels_status").on(table.skinPackId, table.status),
  check("skin_pack_labels_status_valid", sql.raw("status in ('draft','printed','void')")),
]);

export const packageSkinPacks = sqliteTable("package_skin_packs", {
  id: text("id").primaryKey(),
  packageId: text("package_id").notNull().references(() => packages.id),
  skinPackId: text("skin_pack_id").notNull().references(() => skinPacks.id),
  productComponentId: text("product_component_id").notNull().references(() => productComponents.id),
  quantitySlot: integer("quantity_slot").notNull().default(1),
  assignedBy: text("assigned_by").notNull(),
  assignedAt: text("assigned_at").notNull(),
}, (table) => [
  uniqueIndex("idx_package_skin_packs_skin_pack").on(table.skinPackId),
  uniqueIndex("idx_package_skin_packs_component_slot").on(table.packageId, table.productComponentId, table.quantitySlot),
  index("idx_package_skin_packs_package").on(table.packageId, table.assignedAt),
]);

export const packageLabels = sqliteTable("package_labels", {
  id: text("id").primaryKey(),
  packageId: text("package_id").notNull().references(() => packages.id),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  payloadJson: text("payload_json").notNull(),
  qrValue: text("qr_value").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  printedBy: text("printed_by"),
  printedAt: text("printed_at"),
  voidedBy: text("voided_by"),
  voidedAt: text("voided_at"),
  voidReason: text("void_reason"),
}, (table) => [
  uniqueIndex("idx_package_labels_version").on(table.packageId, table.version),
  index("idx_package_labels_status").on(table.packageId, table.status),
  check("package_labels_status_valid", sql.raw("status in ('draft','printed','void')")),
]);

export const packageAssignmentHistory = sqliteTable("package_assignment_history", {
  id: text("id").primaryKey(),
  packageId: text("package_id").notNull().references(() => packages.id),
  fromOrderId: text("from_order_id").references(() => orders.id),
  toOrderId: text("to_order_id").notNull().references(() => orders.id),
  reason: text("reason").notNull(),
  changedBy: text("changed_by").notNull(),
  changedAt: text("changed_at").notNull(),
}, (table) => [
  index("idx_package_assignment_history_package").on(table.packageId, table.changedAt),
  index("idx_package_assignment_history_order").on(table.toOrderId, table.changedAt),
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

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function order(overrides = {}) {
  return {
    id: "order-1",
    orderNo: "JI-260924-0001",
    buyerName: "테스트 고객",
    buyerPhone: "01012345678",
    status: "confirmed",
    fulfillmentType: "pickup",
    scheduleLabel: "9월 24일 목 10:00",
    fulfillmentId: "fulfillment-1",
    pickupAt: "2026-09-24T10:00:00+09:00",
    shipDate: null,
    recipientName: null,
    recipientPhone: null,
    postalCode: null,
    roadAddress: null,
    roadAddrReference: null,
    jibunAddr: null,
    detailAddress: null,
    customerArrived: false,
    note: "",
    totalAmount: 220000,
    paidAmount: 0,
    balance: 220000,
    paymentStatus: "unpaid",
    creditDueDate: null,
    creditMemo: null,
    customerAccountId: "customer-1",
    customerTotalOrdered: 220000,
    customerNetReceived: 0,
    customerReceivable: 220000,
    customerAdvance: 0,
    customerPaymentStatus: "credit",
    version: 1,
    submittedAt: "2026-09-23T00:00:00.000Z",
    items: [{ id: "item-1", productId: "mi", name: "미", quantity: 1, unitPrice: 220000 }],
    payments: [],
    packageCodes: [],
    packageTotal: 0,
    packageCompleted: 0,
    hasUnacknowledgedChange: false,
    events: [],
    ...overrides,
  };
}

test("sales API keeps cancelled history searchable and exposes work progress, customer ledger, and events", async () => {
  const [api, sales, workItems] = await Promise.all([
    read("app/api/orders/route.ts"),
    read("app/components/SalesApp.tsx"),
    read("app/api/work-items/route.ts"),
  ]);
  assert.match(api, /else if \(q\)[\s\S]*SALES_SEARCH_ORDERS_SQL/);
  assert.match(api, /packageCompleted/);
  assert.match(api, /hasUnacknowledgedChange/);
  assert.match(api, /events: events\.map/);
  assert.match(workItems, /customerArrivedAt/);
  assert.match(sales, /setInterval\([\s\S]{0,100}2500\)/);
  assert.match(sales, /addEventListener\("focus"/);
  assert.match(sales, /addEventListener\("online"/);
  assert.match(sales, /useCallback\([\s\S]*\}, \[selectedDate\]\)/);
  for (const label of ["시간", "고객", "상품", "수량", "구분", "작업상태", "결제", "고객상태", "변경"]) assert.match(sales, new RegExp(label));
  assert.match(workItems, /prepareWorkStatusTransition/);
});

test("settings can update a legacy product whose updated_at is null without losing conflict detection", async () => {
  const api = await read("app/api/settings/route.ts");
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      daily_limit INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT
    );
    INSERT INTO products(id, daily_limit) VALUES ('legacy-product', NULL);
  `);

  const revisionSql = "COALESCE(NULLIF(updated_at, ''), 'legacy:' || CAST(version AS TEXT))";
  const legacy = database.prepare(`SELECT ${revisionSql} AS version_token FROM products WHERE id = ?`)
    .get("legacy-product");
  assert.equal(legacy.version_token, "legacy:1");

  const update = database.prepare(`
    UPDATE products
    SET daily_limit = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND ${revisionSql} = ? AND active IN (0, 1)
  `);
  const updatedAt = "2026-09-10T00:00:00.000Z";
  assert.equal(update.run(25, updatedAt, "legacy-product", legacy.version_token).changes, 1);
  const saved = database.prepare("SELECT daily_limit, version, updated_at FROM products WHERE id = ?")
    .get("legacy-product");
  assert.equal(saved.daily_limit, 25);
  assert.equal(saved.version, 2);
  assert.equal(saved.updated_at, updatedAt);
  assert.equal(update.run(30, "2026-09-10T00:01:00.000Z", "legacy-product", legacy.version_token).changes, 0);

  assert.match(api, /PRODUCT_REVISION_SQL = "COALESCE\(NULLIF\(updated_at, ''\), 'legacy:' \|\| CAST\(version AS TEXT\)\)"/);
  assert.match(api, /SET daily_limit = \?, version = version \+ 1, updated_at = \?/);
  assert.match(api, /WHERE id = \? AND \$\{PRODUCT_REVISION_SQL\} = \? AND active IN \(0, 1\)/);
});

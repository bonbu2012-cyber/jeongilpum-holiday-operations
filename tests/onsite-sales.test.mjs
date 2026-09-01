import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { SALES_DATE_ORDERS_SQL } from "../app/lib/sales-order-query.ts";
import { WORKSHOP_DATE_ORDERS_SQL } from "../app/lib/workshop-operations.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function applyBreakpointMigration(database, path) {
  const sql = await read(path);
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) database.exec(statement);
  }
}

async function applyProviderSafeMigration(database, path) {
  const sql = await read(path);
  for (const statement of sql.split(";").map((value) => value.replaceAll("--> statement-breakpoint", "").trim()).filter(Boolean)) {
    database.exec(statement);
  }
}

async function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const migration of [
    "drizzle/0000_charming_bishop.sql",
    "drizzle/0001_confused_swarm.sql",
    "drizzle/0002_deep_giant_girl.sql",
    "drizzle/0003_cancel_production_smoke_orders.sql",
  ]) await applyBreakpointMigration(database, migration);
  await applyProviderSafeMigration(database, "drizzle/0004_brown_omega_red.sql");
  await applyBreakpointMigration(database, "drizzle/0005_chunky_sway.sql");
  await applyBreakpointMigration(database, "drizzle/0006_hot_hercules.sql");
  return database;
}

test("onsite sale reuses the valid immediate-pickup fulfillment while preserving an onsite order type", async () => {
  const database = await migratedDatabase();
  const soldAt = "2026-09-01T10:15:00+09:00";
  const createdAt = "2026-09-01T01:15:00.000Z";
  database.exec("BEGIN");
  try {
    database.prepare("INSERT INTO customer_accounts(id,normalized_name,normalized_phone,display_name,display_phone,ledger_sequence,ledger_label,is_primary,created_at,updated_at) VALUES('customer-onsite','현장고객','01012345678','현장 고객','01012345678',1,'',1,?,?)").run(createdAt, createdAt);
    database.prepare("INSERT INTO orders(id,order_no,season_id,buyer_name_snapshot,buyer_phone_snapshot,order_status,fulfillment_type,schedule_label,customer_note,total_amount,idempotency_key,version,submitted_at,created_at,updated_at) VALUES('order-onsite','JI-260901-1001','season-2026-chuseok','현장 고객','01012345678','fulfilled','onsite','현장판매 · 10:15','',220000,'onsite-order-key',1,?,?,?)").run(createdAt, createdAt, createdAt);
    database.prepare("INSERT INTO order_customer_accounts(order_id,customer_account_id,linked_at,link_reason) VALUES('order-onsite','customer-onsite',?,'order_identity')").run(createdAt);
    database.prepare("INSERT INTO order_items(id,order_id,product_id,product_name_snapshot,list_price_snapshot,sale_unit_price,quantity,line_total,created_at) VALUES('item-onsite','order-onsite','mi','미',220000,220000,1,220000,?)").run(createdAt);
    database.prepare("INSERT INTO fulfillments(id,order_id,fulfillment_type,pickup_at,status,customer_arrived,note,created_at,updated_at) VALUES('fulfillment-onsite','order-onsite','pickup',?,'fulfilled',0,'',?,?)").run(soldAt, createdAt, createdAt);
    database.prepare("INSERT INTO fulfillment_items(id,fulfillment_id,order_item_id,quantity,created_at) VALUES('fi-onsite','fulfillment-onsite','item-onsite',1,?)").run(createdAt);
    database.prepare("INSERT INTO customer_ledger_transactions(id,customer_account_id,type,method,amount,transacted_at,payer_name,payer_phone,payer_relation,memo,idempotency_key,recorded_by,created_at) VALUES('payment-onsite','customer-onsite','payment','card',220000,?,'현장 고객','01012345678','본인','현장판매 JI-260901-1001','onsite-order-key:onsite-payment','operator-1',?)").run(createdAt, createdAt);
    database.prepare("INSERT INTO customer_ledger_events(id,customer_account_id,event_type,after_data,actor_id,created_at) VALUES('ledger-event-onsite','customer-onsite','payment_recorded','{}','operator-1',?)").run(createdAt);
    database.prepare("INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) VALUES('order-event-onsite','order-onsite','onsite_sale_completed','{}','operator-1',?)").run(createdAt);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  assert.equal(database.prepare("SELECT fulfillment_type FROM orders WHERE id='order-onsite'").get().fulfillment_type, "onsite");
  assert.equal(database.prepare("SELECT fulfillment_type FROM fulfillments WHERE order_id='order-onsite'").get().fulfillment_type, "pickup");
  assert.equal(database.prepare("SELECT amount FROM customer_ledger_transactions WHERE customer_account_id='customer-onsite'").get().amount, 220000);
  assert.deepEqual(database.prepare(SALES_DATE_ORDERS_SQL).all("2026-09-01", "2026-09-01", "2026-09-01").map((row) => row.id), ["order-onsite"]);
  assert.deepEqual(database.prepare(WORKSHOP_DATE_ORDERS_SQL).all("2026-09-01", "2026-09-01"), []);
  assert.throws(
    () => database.prepare("INSERT INTO fulfillments(id,order_id,fulfillment_type,pickup_at,status,customer_arrived,note,created_at,updated_at) VALUES('bad-onsite','order-onsite','onsite',?,'fulfilled',0,'',?,?)").run(soldAt, createdAt, createdAt),
    /invalid fulfillment type/,
  );
  database.close();
});

test("onsite sale selection advances immediately while the API keeps operator access and one atomic financial write", async () => {
  const [kiosk, api, access] = await Promise.all([
    read("app/components/KioskApp.tsx"),
    read("app/api/orders/route.ts"),
    read("app/api/orders/onsite-access/route.ts"),
  ]);
  for (const label of ["현장판매", "방문수령", "택배발송", "결제방식을 선택해주세요", "현금", "카드", "계좌이체"]) {
    assert.match(kiosk, new RegExp(label));
  }
  assert.doesNotMatch(kiosk, /fetch\("\/api\/orders\/onsite-access"/);
  assert.match(kiosk, /go\(type==="onsite"\?"onsite-info"/);
  assert.match(kiosk, /직원 로그인 후 계속/);
  assert.match(access, /getChatGPTUser/);
  assert.match(access, /isConfiguredOperator/);
  assert.match(api, /fulfillmentType === "onsite"/);
  assert.match(api, /getChatGPTUser/);
  assert.match(api, /isOperator/);
  assert.match(api, /INSERT INTO customer_ledger_transactions/);
  assert.match(api, /onsite_sale_completed/);
  assert.match(api, /runtimeEnv\.DB\.batch\(statements\)/);
  assert.match(api, /orderStatus = fulfillmentType === "onsite" \? "fulfilled"/);
});

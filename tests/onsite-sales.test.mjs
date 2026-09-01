import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { SALES_DATE_ORDERS_SQL } from "../app/lib/sales-order-query.ts";
import { WORKSHOP_DATE_ORDERS_SQL } from "../app/lib/workshop-operations.ts";
import {
  isLocalDevelopmentHost,
  isLocalDevelopmentRequest,
  isLocalPreviewActor,
  LOCAL_PREVIEW_ACTOR_EMAIL,
  LOCAL_PREVIEW_ACTOR_ID,
} from "../app/lib/local-preview-auth.ts";

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

test("local onsite completion is limited to development HTTP loopback requests", () => {
  assert.equal(LOCAL_PREVIEW_ACTOR_ID, "local-preview-operator");
  assert.equal(LOCAL_PREVIEW_ACTOR_EMAIL, "local-preview@localhost.invalid");
  assert.equal(isLocalDevelopmentRequest("http://localhost:3000/api/orders", true), true);
  assert.equal(isLocalDevelopmentRequest("http://127.0.0.1:3000/api/orders", true), true);
  assert.equal(isLocalDevelopmentRequest("http://[::1]:3000/api/orders", true), true);
  assert.equal(isLocalDevelopmentRequest("http://localhost:3000/api/orders", false), false);
  assert.equal(isLocalDevelopmentRequest("https://localhost/api/orders", true), false);
  assert.equal(isLocalDevelopmentRequest("http://192.168.0.10:3000/api/orders", true), false);
  assert.equal(isLocalDevelopmentRequest("not a url", true), false);
  assert.equal(isLocalDevelopmentHost("localhost:3000", true), true);
  assert.equal(isLocalDevelopmentHost("127.0.0.1:3000", true), true);
  assert.equal(isLocalDevelopmentHost("example.com", true), false);
  assert.equal(isLocalDevelopmentHost("localhost:3000", false), false);
  assert.equal(isLocalPreviewActor(LOCAL_PREVIEW_ACTOR_ID, "http://localhost:3000/api/orders", true), true);
  assert.equal(isLocalPreviewActor(LOCAL_PREVIEW_ACTOR_ID, "https://example.com/api/orders", true), false);
});

test("anonymous onsite sale reuses the valid immediate-pickup fulfillment while preserving an onsite order type", async () => {
  const database = await migratedDatabase();
  const soldAt = "2026-09-01T10:15:00+09:00";
  const createdAt = "2026-09-01T01:15:00.000Z";
  database.exec("BEGIN");
  try {
    database.prepare("INSERT INTO customer_accounts(id,normalized_name,normalized_phone,display_name,display_phone,ledger_sequence,ledger_label,is_primary,created_at,updated_at) VALUES('customer-onsite','현장판매고객','','현장판매 고객','',1,'',1,?,?)").run(createdAt, createdAt);
    database.prepare("INSERT INTO orders(id,order_no,season_id,buyer_name_snapshot,buyer_phone_snapshot,order_status,fulfillment_type,schedule_label,customer_note,total_amount,idempotency_key,version,submitted_at,created_at,updated_at) VALUES('order-onsite','JI-260901-1001','season-2026-chuseok','현장판매 고객','','fulfilled','onsite','현장판매 · 10:15','',220000,'onsite-order-key',1,?,?,?)").run(createdAt, createdAt, createdAt);
    database.prepare("INSERT INTO order_customer_accounts(order_id,customer_account_id,linked_at,link_reason) VALUES('order-onsite','customer-onsite',?,'order_identity')").run(createdAt);
    database.prepare("INSERT INTO order_items(id,order_id,product_id,product_name_snapshot,list_price_snapshot,sale_unit_price,quantity,line_total,created_at) VALUES('item-onsite','order-onsite','mi','미',220000,220000,1,220000,?)").run(createdAt);
    database.prepare("INSERT INTO fulfillments(id,order_id,fulfillment_type,pickup_at,status,customer_arrived,note,created_at,updated_at) VALUES('fulfillment-onsite','order-onsite','pickup',?,'fulfilled',0,'',?,?)").run(soldAt, createdAt, createdAt);
    database.prepare("INSERT INTO fulfillment_items(id,fulfillment_id,order_item_id,quantity,created_at) VALUES('fi-onsite','fulfillment-onsite','item-onsite',1,?)").run(createdAt);
    database.prepare("INSERT INTO customer_ledger_transactions(id,customer_account_id,type,method,amount,transacted_at,payer_name,payer_phone,payer_relation,memo,idempotency_key,recorded_by,created_at) VALUES('payment-onsite','customer-onsite','payment','card',220000,?,'현장판매 고객','','본인','현장판매 JI-260901-1001','onsite-order-key:onsite-payment','operator-1',?)").run(createdAt, createdAt);
    database.prepare("INSERT INTO customer_ledger_events(id,customer_account_id,event_type,after_data,actor_id,created_at) VALUES('ledger-event-onsite','customer-onsite','payment_recorded','{}','operator-1',?)").run(createdAt);
    database.prepare("INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) VALUES('order-event-onsite','order-onsite','onsite_sale_completed','{}','operator-1',?)").run(createdAt);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  assert.equal(database.prepare("SELECT fulfillment_type FROM orders WHERE id='order-onsite'").get().fulfillment_type, "onsite");
  const anonymousBuyer = database.prepare("SELECT buyer_name_snapshot,buyer_phone_snapshot FROM orders WHERE id='order-onsite'").get();
  assert.equal(anonymousBuyer.buyer_name_snapshot, "현장판매 고객");
  assert.equal(anonymousBuyer.buyer_phone_snapshot, "");
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

test("onsite sale stays in a separate staff zone, skips customer info, and keeps protected atomic writes", async () => {
  const [kiosk, css, api, access, auth, availability] = await Promise.all([
    read("app/components/KioskApp.tsx"),
    read("app/kiosk-flow.css"),
    read("app/api/orders/route.ts"),
    read("app/api/orders/onsite-access/route.ts"),
    read("app/chatgpt-auth.ts"),
    read("app/api/availability/route.ts"),
  ]);
  for (const label of ["현장판매", "방문수령", "택배발송", "결제방식을 선택해주세요", "현금", "카드", "계좌이체"]) {
    assert.match(kiosk, new RegExp(label));
  }
  assert.doesNotMatch(kiosk, /fetch\("\/api\/orders\/onsite-access"/);
  assert.match(kiosk, /className="onsite-sale-zone"/);
  assert.match(kiosk, /className="fulfillment-customer-options"/);
  assert.match(kiosk, /go\(type==="onsite"\?"payment"/);
  assert.doesNotMatch(kiosk, /"onsite-info"/);
  assert.doesNotMatch(kiosk, /직원 도움|StaffHelp|className="staff-help"/);
  assert.match(kiosk, /미기입 현장판매/);
  assert.match(css, /\.onsite-sale-zone\{/);
  assert.match(api, /fulfillmentType === "onsite" \? "현장판매 고객"/);
  assert.match(api, /fulfillmentType === "onsite" \? ""/);
  assert.match(api, /fulfillmentType !== "onsite" && \(!buyer \|\| phone\.length < 10\)/);
  assert.match(api, /orderStatus,\s+fulfillmentType,\s+scheduleLabel/);
  assert.match(api, /fulfillmentType === "onsite" \? "pickup" : fulfillmentType,\s+pickupAt/);
  assert.match(kiosk, /response\.status===401&&draft\.fulfillmentType==="onsite"/);
  assert.match(kiosk, /\["localhost","127\.0\.0\.1","\[::1\]"\]\.includes\(location\.hostname\)/);
  assert.match(kiosk, /로컬 미리보기에서는 현장판매를 저장할 수 없습니다/);
  assert.match(kiosk, /signin-with-chatgpt\?return_to=%2Fkiosk%3Fresume%3Dpayment/);
  assert.match(kiosk, /resume==="payment"&&restored\.fulfillmentType==="onsite"&&restored\.paymentMethod&&hasItems/);
  assert.match(access, /getChatGPTUser/);
  assert.match(access, /isConfiguredOperator/);
  assert.match(api, /fulfillmentType === "onsite"/);
  assert.match(api, /isLocalDevelopmentRequest\(request\.url, import\.meta\.env\.DEV\)/);
  assert.match(api, /user\?\.userId \?\? LOCAL_PREVIEW_ACTOR_ID/);
  assert.match(api, /isLocalPreviewActor\(user\.userId, request\.url, import\.meta\.env\.DEV\)/);
  assert.match(auth, /isLocalDevelopmentHost\(host, import\.meta\.env\.DEV\)/);
  assert.match(auth, /displayName: "로컬 개발 직원"/);
  assert.match(availability, /isLocalPreviewActor\(user\.userId, request\.url, import\.meta\.env\.DEV\)/);
  assert.match(api, /getChatGPTUser/);
  assert.match(api, /isOperator/);
  assert.match(api, /INSERT INTO customer_ledger_transactions/);
  assert.match(api, /onsite_sale_completed/);
  assert.match(api, /runtimeEnv\.DB\.batch\(statements\)/);
  assert.match(api, /orderStatus = fulfillmentType === "onsite" \? "fulfilled"/);
});

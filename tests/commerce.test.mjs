import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  for (const migration of [
    "drizzle/0000_charming_bishop.sql",
    "drizzle/0001_confused_swarm.sql",
    "drizzle/0002_deep_giant_girl.sql",
    "drizzle/0004_brown_omega_red.sql",
  ]) {
    const sql = await read(migration);
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) database.exec(statement);
    }
  }
  return database;
}

function insertOrder(database, id, totalAmount = 220_000) {
  const now = "2026-09-01T00:00:00.000Z";
  database.prepare(`
    INSERT INTO orders(
      id,order_no,season_id,buyer_name_snapshot,buyer_phone_snapshot,
      order_status,fulfillment_type,schedule_label,customer_note,total_amount,
      idempotency_key,version,submitted_at,created_at,updated_at
    ) VALUES(?,?,?,'테스트 고객','01012345678','submitted','pickup','9월 10일 · 10:00','',?,?,1,?,?,?)
  `).run(id, `TEST-${id}`, "season-2026-chuseok", totalAmount, `idem-${id}`, now, now, now);
}

function insertItem(database, orderId, itemId, quantity = 1) {
  database.prepare(`
    INSERT INTO order_items(
      id,order_id,product_id,product_name_snapshot,list_price_snapshot,
      sale_unit_price,quantity,line_total,created_at
    ) VALUES(?,?,?,'미',220000,220000,?,?,?)
  `).run(itemId, orderId, "mi", quantity, 220_000 * quantity, "2026-09-01T00:00:00.000Z");
}

test("custom order integrates into the main order draft and enforces 200,000 won", async () => {
  const [custom, kiosk, api] = await Promise.all([
    read("app/components/CustomOrderApp.tsx"),
    read("app/components/KioskApp.tsx"),
    read("app/api/orders/route.ts"),
  ]);
  for (const category of ["진공세트", "프리미엄", "O'meat", "LA갈비", "뼈세트"]) {
    assert.match(custom, new RegExp(category.replace("'", "\\'")));
  }
  for (const budget of ["20만원대", "25만원대", "30만원대", "40만원대", "50만원 이상", "금액 직접 입력"]) {
    assert.match(custom, new RegExp(budget));
  }
  assert.match(custom, /맞춤주문은 20만원부터 가능합니다/);
  assert.match(custom, /orderDraft\.customItem/);
  assert.match(custom, /window\.location\.assign\("\/kiosk\?resume=cart"\)/);
  assert.match(kiosk, /customItem:draft\.customItem/);
  assert.match(kiosk, /custom-review-item/);
  assert.match(api, /order_item_customizations/);
  assert.match(api, /customAmount >= 200_000/);
});

test("pickup and shipping calendars expose today, selected, and closed labels together", async () => {
  const [kiosk, css] = await Promise.all([
    read("app/components/KioskApp.tsx"),
    read("app/kiosk-flow.css"),
  ]);
  assert.match(kiosk, /date===today&&<small>오늘<\/small>/);
  assert.match(kiosk, /value===date&&<small>✓ 선택<\/small>/);
  assert.match(kiosk, /<small>예약마감<\/small>/);
  assert.match(css, /button\.today/);
  assert.match(kiosk, /type="pickup"/);
  assert.match(kiosk, /type="shipping"/);
});

test("database trigger prevents premium daily limit oversell at the 29 + 2 boundary", async () => {
  const database = await migratedDatabase();
  insertOrder(database, "limit-base", 6_380_000);
  insertItem(database, "limit-base", "item-base", 29);
  database.prepare("INSERT INTO product_daily_reservations(id,order_id,order_item_id,product_id,reserve_date,quantity,status,created_at) VALUES(?,?,?,?,?,29,'active',?)")
    .run("reservation-base", "limit-base", "item-base", "mi", "2026-09-10", "2026-09-01T00:00:00.000Z");

  insertOrder(database, "limit-a");
  insertItem(database, "limit-a", "item-a");
  insertOrder(database, "limit-b");
  insertItem(database, "limit-b", "item-b");
  const reserve = database.prepare("INSERT INTO product_daily_reservations(id,order_id,order_item_id,product_id,reserve_date,quantity,status,created_at) VALUES(?,?,?,?,?,1,'active',?)");
  reserve.run("reservation-a", "limit-a", "item-a", "mi", "2026-09-10", "2026-09-01T00:00:00.000Z");
  assert.throws(
    () => reserve.run("reservation-b", "limit-b", "item-b", "mi", "2026-09-10", "2026-09-01T00:00:00.000Z"),
    /daily product limit exceeded/,
  );
  const row = database.prepare("SELECT SUM(quantity) AS reserved FROM product_daily_reservations WHERE product_id='mi' AND reserve_date='2026-09-10' AND status='active'").get();
  assert.equal(row.reserved, 30);
});

test("cancelling an order releases its limited-product reservation", async () => {
  const database = await migratedDatabase();
  insertOrder(database, "cancel-limit");
  insertItem(database, "cancel-limit", "cancel-item");
  database.prepare("INSERT INTO product_daily_reservations(id,order_id,order_item_id,product_id,reserve_date,quantity,status,created_at) VALUES(?,?,?,?,?,1,'active',?)")
    .run("cancel-reservation", "cancel-limit", "cancel-item", "mi", "2026-09-10", "2026-09-01T00:00:00.000Z");
  database.prepare("UPDATE orders SET order_status='cancelled' WHERE id='cancel-limit'").run();
  const row = database.prepare("SELECT status,released_at FROM product_daily_reservations WHERE id='cancel-reservation'").get();
  assert.equal(row.status, "released");
  assert.ok(row.released_at);
});

test("partial payments remain append-only and calculate paid amount and balance", async () => {
  const database = await migratedDatabase();
  insertOrder(database, "payment-order", 300_000);
  const insert = database.prepare("INSERT INTO payments(id,order_id,type,method,amount,paid_at,recorded_by,memo,idempotency_key,created_at) VALUES(?,?,'payment',?,?,?,?,?,?,?)");
  insert.run("pay-1", "payment-order", "card", 100_000, "2026-09-01T10:00:00.000Z", "operator", "", "pay-idem-1", "2026-09-01T10:00:00.000Z");
  insert.run("pay-2", "payment-order", "bank_transfer", 150_000, "2026-09-01T11:00:00.000Z", "operator", "", "pay-idem-2", "2026-09-01T11:00:00.000Z");
  const row = database.prepare("SELECT SUM(CASE WHEN type='payment' THEN amount WHEN type='refund' THEN -amount ELSE amount END) AS paid FROM payments WHERE order_id='payment-order'").get();
  assert.equal(row.paid, 250_000);
  assert.equal(300_000 - row.paid, 50_000);
  assert.throws(() => database.prepare("UPDATE payments SET amount=1 WHERE id='pay-1'").run(), /append-only/);
});

test("credit status settles automatically after the final bank transfer", async () => {
  const database = await migratedDatabase();
  insertOrder(database, "credit-order", 300_000);
  const insert = database.prepare("INSERT INTO payments(id,order_id,type,method,amount,paid_at,recorded_by,memo,idempotency_key,created_at) VALUES(?,?,'payment',?,?,?,?,?,?,?)");
  insert.run("credit-pay-1", "credit-order", "card", 100_000, "2026-09-01T10:00:00.000Z", "operator", "", "credit-idem-1", "2026-09-01T10:00:00.000Z");
  insert.run("credit-pay-2", "credit-order", "bank_transfer", 150_000, "2026-09-01T11:00:00.000Z", "operator", "", "credit-idem-2", "2026-09-01T11:00:00.000Z");
  database.prepare("INSERT INTO order_credit_terms(id,order_id,outstanding_amount,due_date,memo,status,recorded_by,created_at) VALUES(?,?,50000,'2026-09-20','잔금','open','operator',?)")
    .run("credit-term", "credit-order", "2026-09-01T11:30:00.000Z");
  assert.equal(database.prepare("SELECT status FROM order_credit_terms WHERE id='credit-term'").get().status, "open");
  insert.run("credit-pay-3", "credit-order", "bank_transfer", 50_000, "2026-09-02T10:00:00.000Z", "operator", "", "credit-idem-3", "2026-09-02T10:00:00.000Z");
  assert.equal(database.prepare("SELECT status FROM order_credit_terms WHERE id='credit-term'").get().status, "settled");
  const paid = database.prepare("SELECT SUM(amount) AS paid FROM payments WHERE order_id='credit-order'").get().paid;
  assert.equal(paid, 300_000);
});

test("sales shows payments while workshop remains payment-free", async () => {
  const [admin, workshop, paymentApi, availabilityApi] = await Promise.all([
    read("app/components/AdminApp.tsx"),
    read("app/components/WorkshopApp.tsx"),
    read("app/api/orders/payments/route.ts"),
    read("app/api/availability/route.ts"),
  ]);
  for (const label of ["총 주문금액", "결제누계", "잔액", "결제상태", "결제 기록", "외상 처리"]) {
    assert.match(admin, new RegExp(label));
  }
  assert.match(paymentApi, /card/);
  assert.match(paymentApi, /cash/);
  assert.match(paymentApi, /bank_transfer/);
  assert.doesNotMatch(workshop, /결제누계|결제수단|외상 처리/);
  assert.match(availabilityApi, /dailyLimit/);
  assert.match(availabilityApi, /remainingQuantity/);
});

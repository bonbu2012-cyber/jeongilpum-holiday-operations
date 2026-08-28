import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  filterOperationalOrders,
  isDueWithinThirtyMinutes,
  scheduleDate,
  sortOperationalOrders,
  summarizeOperationalOrders,
  workStatusLabel,
} from "../app/lib/sales-operations.ts";
import {
  SALES_DATE_ORDERS_SQL,
  SALES_SEARCH_ORDERS_SQL,
} from "../app/lib/sales-order-query.ts";

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

test("selected date uses pickup_at for visits and ship_date for shipping", () => {
  assert.equal(scheduleDate(order()), "2026-09-24");
  assert.equal(scheduleDate(order({
    fulfillmentType: "shipping",
    pickupAt: null,
    shipDate: "2026-09-25",
  })), "2026-09-25");
});

test("visit, shipping, incomplete, ready, and cancelled rules are deterministic", () => {
  const fixture = [
    order({ id: "pickup" }),
    order({ id: "shipping", fulfillmentType: "shipping", pickupAt: null, shipDate: "2026-09-24" }),
    order({ id: "ready", status: "ready" }),
    order({ id: "done", status: "fulfilled" }),
    order({ id: "cancelled", status: "cancelled" }),
  ];
  assert.deepEqual(filterOperationalOrders(fixture, "pickup", null).map((item) => item.id), ["pickup", "ready", "done"]);
  assert.deepEqual(filterOperationalOrders(fixture, "shipping", null).map((item) => item.id), ["shipping"]);
  assert.deepEqual(filterOperationalOrders(fixture, "incomplete", null).map((item) => item.id), ["pickup", "shipping", "ready"]);
  assert.deepEqual(filterOperationalOrders(fixture, "ready", null).map((item) => item.id), ["ready"]);
  assert.equal(filterOperationalOrders(fixture, "all", null).some((item) => item.status === "cancelled"), false);
});

test("customer arrival and due-soon orders sort before ordinary work, completed orders last", () => {
  const now = new Date("2026-09-24T00:40:00.000Z");
  const sorted = sortOperationalOrders([
    order({ id: "done", status: "fulfilled" }),
    order({ id: "ordinary", pickupAt: "2026-09-24T11:00:00+09:00" }),
    order({ id: "changed", hasUnacknowledgedChange: true, pickupAt: "2026-09-24T10:30:00+09:00" }),
    order({ id: "due", pickupAt: "2026-09-24T10:00:00+09:00" }),
    order({ id: "arrived", customerArrived: true, pickupAt: "2026-09-24T12:00:00+09:00" }),
  ], now);
  assert.deepEqual(sorted.map((item) => item.id), ["arrived", "due", "changed", "ordinary", "done"]);
  assert.equal(isDueWithinThirtyMinutes(sorted[1], now), true);
});

test("more than 100 orders keep stable priority sorting and filtering", () => {
  const fixture = Array.from({ length: 120 }, (_, index) => order({
    id: "fixture-" + index,
    buyerName: "고객 " + index,
    pickupAt: "2026-09-24T" + String(8 + Math.floor(index / 10)).padStart(2, "0") + ":" + String((index % 2) * 30).padStart(2, "0") + ":00+09:00",
    customerArrived: index === 119,
    status: index === 118 ? "submitted" : index < 10 ? "fulfilled" : index % 3 === 0 ? "ready" : "confirmed",
  }));
  const visible = filterOperationalOrders(fixture, "all", null);
  const sorted = sortOperationalOrders(visible, new Date("2026-09-23T00:00:00.000Z"));
  assert.equal(sorted.length, 120);
  assert.equal(sorted[0].id, "fixture-119");
  assert.equal(sorted.at(-1).status, "fulfilled");
  const summary = summarizeOperationalOrders(visible);
  assert.equal(summary.total, 120);
  assert.equal(summary.fulfilled, 10);
  assert.equal(visible.some((item) => item.id === "fixture-118" && item.status === "submitted"), true);
});

test("sales date SQL selects pickup and shipping schedules, excludes cancelled, and keeps history searchable", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE orders(id TEXT PRIMARY KEY,order_no TEXT,buyer_name_snapshot TEXT,buyer_phone_snapshot TEXT,order_status TEXT,recipient_name TEXT,recipient_phone TEXT,created_at TEXT)");
  database.exec("CREATE TABLE fulfillments(id TEXT PRIMARY KEY,order_id TEXT,fulfillment_type TEXT,pickup_at TEXT,ship_date TEXT,recipient_name TEXT,recipient_phone TEXT)");
  const add = (id, status, type, pickupAt, shipDate) => {
    database.prepare("INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)").run(id, "JI-" + id, "고객 " + id, "01000000000", status, null, null, "2026-08-28T03:00:00.000Z");
    database.prepare("INSERT INTO fulfillments VALUES(?,?,?,?,?,?,?)").run("f-" + id, id, type, pickupAt, shipDate, null, null);
  };
  add("today-pickup", "submitted", "pickup", "2026-08-28T11:00:00+09:00", null);
  add("future-pickup", "submitted", "pickup", "2026-08-31T11:00:00+09:00", null);
  add("shipping", "submitted", "shipping", null, "2026-08-30");
  add("cancelled", "cancelled", "pickup", "2026-08-28T12:00:00+09:00", null);

  const idsForDate = (date) => database.prepare(SALES_DATE_ORDERS_SQL).all(date, date).map((row) => row.id);
  assert.deepEqual(idsForDate("2026-08-28"), ["today-pickup"]);
  assert.deepEqual(idsForDate("2026-08-31"), ["future-pickup"]);
  assert.deepEqual(idsForDate("2026-08-30"), ["shipping"]);
  const cancelledSearch = database.prepare(SALES_SEARCH_ORDERS_SQL).all("%cancelled%", "%cancelled%", "%cancelled%", "%cancelled%", "%cancelled%");
  assert.deepEqual(cancelledSearch.map((row) => row.id), ["cancelled"]);
  database.close();
});

test("customer arrival SQL is idempotent and leaves one audit event", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE fulfillments(order_id TEXT PRIMARY KEY,fulfillment_type TEXT,customer_arrived INTEGER,updated_at TEXT)");
  database.exec("CREATE TABLE order_events(id TEXT PRIMARY KEY,order_id TEXT,event_type TEXT,after_data TEXT,actor_id TEXT,created_at TEXT)");
  database.prepare("INSERT INTO fulfillments VALUES('order-1','pickup',0,'before')").run();

  const arrive = (eventId) => {
    database.prepare("INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) SELECT ?,'order-1','CUSTOMER_ARRIVED','{}','operator','2026-09-24' WHERE EXISTS(SELECT 1 FROM fulfillments WHERE order_id='order-1' AND fulfillment_type='pickup' AND customer_arrived=0) AND NOT EXISTS(SELECT 1 FROM order_events WHERE order_id='order-1' AND event_type='CUSTOMER_ARRIVED')")
      .run(eventId);
    database.prepare("UPDATE fulfillments SET customer_arrived=1,updated_at='2026-09-24' WHERE order_id='order-1' AND fulfillment_type='pickup' AND customer_arrived=0").run();
  };
  arrive("event-1");
  arrive("event-2");

  assert.equal(database.prepare("SELECT customer_arrived FROM fulfillments").get().customer_arrived, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM order_events").get().count, 1);
  database.close();
});

test("sales API keeps cancelled history searchable and exposes work progress, payments, and events", async () => {
  const [api, queries, arrival, sales, detail, availability] = await Promise.all([
    read("app/api/orders/route.ts"),
    read("app/lib/sales-order-query.ts"),
    read("app/api/orders/arrival/route.ts"),
    read("app/components/SalesApp.tsx"),
    read("app/components/SalesOrderDetail.tsx"),
    read("app/api/availability/route.ts"),
  ]);
  assert.match(queries, /o\.order_status!='cancelled'/);
  assert.match(api, /else if \(q\)[\s\S]*SALES_SEARCH_ORDERS_SQL/);
  assert.match(queries, /LIMIT 500/);
  assert.match(api, /packageCompleted/);
  assert.match(api, /hasUnacknowledgedChange/);
  assert.match(api, /events: events\.map/);
  assert.match(arrival, /CUSTOMER_ARRIVED/);
  assert.match(arrival, /customer_arrived=0/);
  assert.match(sales, /setInterval\([\s\S]{0,100}2500\)/);
  assert.match(sales, /addEventListener\("focus"/);
  assert.match(sales, /addEventListener\("online"/);
  assert.match(sales, /useCallback\([\s\S]*\}, \[selectedDate\]\)/);
  for (const label of ["시간", "고객", "상품", "수량", "수령", "작업상태", "고객상태", "변경"]) assert.match(sales, new RegExp(label));
  for (const label of ["총 주문금액", "결제누계", "잔액", "결제내역"]) assert.match(detail, new RegExp(label));
  assert.match(availability, /remainingQuantity/);
  assert.equal(workStatusLabel(order({ status: "fulfilled", fulfillmentType: "shipping" })), "출고완료");
});

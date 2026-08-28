import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  WORKSHOP_DATE_ORDERS_SQL,
  aggregateWorkshopProducts,
  canApplyWorkshopAction,
  sortWorkshopOrders,
  summarizeWorkshopOrders,
  workshopActionEventType,
  workshopActionNextStatus,
  workshopPriorityRank,
} from "../app/lib/workshop-operations.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function order(overrides = {}) {
  return {
    id: "order-1",
    orderNo: "JI-260924-0001",
    buyerName: "테스트 작업",
    status: "confirmed",
    version: 1,
    submittedAt: "2026-09-23T00:00:00.000Z",
    fulfillmentId: "fulfillment-1",
    fulfillmentType: "pickup",
    pickupAt: "2026-09-24T11:00:00+09:00",
    shipDate: null,
    scheduleLabel: "2026-09-24 11:00 방문",
    customerArrived: false,
    note: "",
    items: [{ id: "item-1", productId: "mi", name: "미", quantity: 2, packageTotal: 2, packageCompleted: 0 }],
    packageTotal: 2,
    packageCompleted: 0,
    hasUnacknowledgedChange: false,
    workAcceptedAt: null,
    workStartedAt: null,
    workCompletedAt: null,
    events: [],
    ...overrides,
  };
}

test("workshop date SQL returns only the selected pickup or shipping work date", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE orders(id TEXT PRIMARY KEY,order_no TEXT,buyer_name_snapshot TEXT,order_status TEXT,customer_note TEXT,version INTEGER,submitted_at TEXT,created_at TEXT)");
  database.exec("CREATE TABLE fulfillments(id TEXT PRIMARY KEY,order_id TEXT,fulfillment_type TEXT,pickup_at TEXT,ship_date TEXT,customer_arrived INTEGER,note TEXT)");
  const add = (id, status, type, pickupAt, shipDate) => {
    database.prepare("INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)").run(id, "JI-" + id, "고객", status, "", 1, "2026-09-01", "2026-09-01");
    database.prepare("INSERT INTO fulfillments VALUES(?,?,?,?,?,?,?)").run("f-" + id, id, type, pickupAt, shipDate, 0, "");
  };
  add("today", "confirmed", "pickup", "2026-09-24T10:00:00+09:00", null);
  add("future", "confirmed", "pickup", "2026-09-25T10:00:00+09:00", null);
  add("shipping", "in_progress", "shipping", null, "2026-09-24");
  add("cancelled", "cancelled", "pickup", "2026-09-24T12:00:00+09:00", null);
  const ids = database.prepare(WORKSHOP_DATE_ORDERS_SQL).all("2026-09-24", "2026-09-24").map((row) => row.id);
  assert.deepEqual(ids, ["today", "shipping"]);
  database.close();
});

test("customer arrival, due-soon, changes, active work, waiting, and ready sort in operational order", () => {
  const now = new Date("2026-09-24T00:40:00.000Z");
  const fixture = [
    order({ id: "ready", status: "ready", pickupAt: "2026-09-24T08:00:00+09:00" }),
    order({ id: "waiting", pickupAt: "2026-09-24T14:00:00+09:00" }),
    order({ id: "accepted", workAcceptedAt: "2026-09-23T01:00:00Z", pickupAt: "2026-09-24T13:00:00+09:00" }),
    order({ id: "working", status: "in_progress", pickupAt: "2026-09-24T11:00:00+09:00" }),
    order({ id: "changed", hasUnacknowledgedChange: true, pickupAt: "2026-09-24T10:30:00+09:00" }),
    order({ id: "due", pickupAt: "2026-09-24T10:00:00+09:00" }),
    order({ id: "arrived", customerArrived: true, pickupAt: "2026-09-24T12:00:00+09:00" }),
  ];
  assert.deepEqual(sortWorkshopOrders(fixture, now).map((item) => item.id), ["arrived", "due", "changed", "working", "accepted", "waiting", "ready"]);
  assert.equal(workshopPriorityRank(fixture.at(-1), now), 0);
});

test("work acceptance, start, and completion transitions are explicit and safe", () => {
  assert.equal(canApplyWorkshopAction(order(), "accept"), true);
  assert.equal(canApplyWorkshopAction(order({ workAcceptedAt: "2026-09-24" }), "accept"), false);
  assert.equal(canApplyWorkshopAction(order({ workAcceptedAt: "2026-09-24" }), "start"), true);
  assert.equal(canApplyWorkshopAction(order({ status: "in_progress" }), "complete"), true);
  assert.equal(workshopActionNextStatus("accept"), "confirmed");
  assert.equal(workshopActionNextStatus("start"), "in_progress");
  assert.equal(workshopActionNextStatus("complete"), "ready");
  assert.equal(workshopActionEventType("accept"), "WORK_ACCEPTED");
  assert.equal(workshopActionEventType("start"), "WORK_STARTED");
  assert.equal(workshopActionEventType("complete"), "WORK_COMPLETED");
});

test("product totals use ordered quantity and only actual completed packages", () => {
  const products = aggregateWorkshopProducts([
    order({ id: "one", items: [{ id: "a", productId: "mi", name: "미", quantity: 15, packageTotal: 15, packageCompleted: 8 }] }),
    order({ id: "two", items: [{ id: "b", productId: "mi", name: "미", quantity: 3, packageTotal: 0, packageCompleted: 0 }] }),
  ]);
  assert.deepEqual(products, [{ productId: "mi", name: "미", total: 18, completed: 8, remaining: 10 }]);
});

test("120 work orders preserve priority and summary counts", () => {
  const fixture = Array.from({ length: 120 }, (_, index) => order({
    id: "fixture-" + index,
    status: index < 10 ? "ready" : index % 4 === 0 ? "in_progress" : "confirmed",
    customerArrived: index === 119,
    pickupAt: "2026-09-24T" + String(8 + Math.floor(index / 12)).padStart(2, "0") + ":" + String((index % 2) * 30).padStart(2, "0") + ":00+09:00",
  }));
  const sorted = sortWorkshopOrders(fixture, new Date("2026-09-23T00:00:00.000Z"));
  assert.equal(sorted.length, 120);
  assert.equal(sorted[0].id, "fixture-119");
  assert.equal(sorted.at(-1).status, "ready");
  assert.equal(summarizeWorkshopOrders(fixture).total, 120);
});

test("a failed statement rolls back the whole work transition", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE orders(id TEXT PRIMARY KEY,order_status TEXT,version INTEGER); CREATE TABLE order_events(id TEXT PRIMARY KEY,order_id TEXT,event_type TEXT); CREATE TRIGGER fail_work_event BEFORE INSERT ON order_events WHEN NEW.event_type='WORK_STARTED' BEGIN SELECT RAISE(ABORT,'forced failure'); END;");
  database.prepare("INSERT INTO orders VALUES('order-1','confirmed',1)").run();
  assert.throws(() => {
    database.exec("BEGIN");
    try {
      database.prepare("UPDATE orders SET order_status='in_progress',version=version+1 WHERE id='order-1'").run();
      database.prepare("INSERT INTO order_events VALUES('event-1','order-1','WORK_STARTED')").run();
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  });
  const preserved = database.prepare("SELECT order_status,version FROM orders").get();
  assert.equal(preserved.order_status, "confirmed");
  assert.equal(preserved.version, 1);
  database.close();
});

test("workshop API and UI omit payment data and keep polling plus shared sales state", async () => {
  const [api, actions, app, client, salesApi, salesOps] = await Promise.all([
    read("app/api/workshop/orders/route.ts"),
    read("app/api/workshop/actions/route.ts"),
    read("app/components/WorkshopApp.tsx"),
    read("app/lib/workshop-client.ts"),
    read("app/api/orders/route.ts"),
    read("app/lib/sales-operations.ts"),
  ]);
  for (const source of [api, app]) {
    assert.doesNotMatch(source, /payments|paidAmount|balance|creditDueDate|카드결제|계좌이체|외상|잔액/);
  }
  assert.match(api, /Cache-Control/);
  assert.match(client, /cache: "no-store"/);
  assert.match(app, /setInterval\([\s\S]{0,100}2500\)/);
  assert.match(app, /addEventListener\("focus"/);
  assert.match(app, /addEventListener\("online"/);
  assert.match(app, /\[selectedDate\]/);
  assert.match(actions, /runtimeEnv\.DB\.batch/);
  assert.match(actions, /WORK_ACCEPTED/);
  assert.match(actions, /package_status='in_progress'/);
  assert.match(actions, /package_status='completed'/);
  assert.match(salesApi, /workAcceptedAt/);
  assert.match(salesOps, /작업수락/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  WORKSHOP_DATE_ORDERS_SQL,
  aggregateWorkshopProducts,
  arrivalOffsetMinutes,
  arrivalTimingLabel,
  canApplyWorkshopAction,
  completedQuantityForItem,
  filterWorkshopOrdersByProduct,
  findSubstituteCandidates,
  isWorkshopDueSoon,
  pickupUrgency,
  sortTimelineOrders,
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
    actualArrivedAt: null,
    arrivalOffsetMinutes: null,
    note: "",
    hasSpecialRequest: false,
    items: [{ id: "item-1", productId: "mi", name: "미", quantity: 2, packageTotal: 2, packageCompleted: 0, hasCustomization: false }],
    packageTotal: 2,
    packageCompleted: 0,
    hasUnacknowledgedChange: false,
    changeSeverity: null,
    workAcceptedAt: null,
    workAcceptedBy: null,
    workStartedAt: null,
    workCompletedAt: null,
    substituteCandidates: [],
    events: [],
    ...overrides,
  };
}

test("selected production date uses pickup_at or ship_date, not accepted date", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE orders(id TEXT PRIMARY KEY,order_no TEXT,buyer_name_snapshot TEXT,order_status TEXT,customer_note TEXT,version INTEGER,submitted_at TEXT,created_at TEXT)");
  database.exec("CREATE TABLE fulfillments(id TEXT PRIMARY KEY,order_id TEXT,fulfillment_type TEXT,pickup_at TEXT,ship_date TEXT,customer_arrived INTEGER,note TEXT)");
  const add = (id, status, type, pickupAt, shipDate, createdAt = "2026-09-24T00:00:00Z") => {
    database.prepare("INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)").run(id, "JI-" + id, "고객", status, "", 1, createdAt, createdAt);
    database.prepare("INSERT INTO fulfillments VALUES(?,?,?,?,?,?,?)").run("f-" + id, id, type, pickupAt, shipDate, 0, "");
  };
  add("today", "confirmed", "pickup", "2026-09-24T10:00:00+09:00", null);
  add("accepted-today-produced-tomorrow", "confirmed", "pickup", "2026-09-25T10:00:00+09:00", null);
  add("shipping", "in_progress", "shipping", null, "2026-09-24");
  add("cancelled", "cancelled", "pickup", "2026-09-24T12:00:00+09:00", null);
  const today = database.prepare(WORKSHOP_DATE_ORDERS_SQL).all("2026-09-24", "2026-09-24").map((row) => row.id);
  const tomorrow = database.prepare(WORKSHOP_DATE_ORDERS_SQL).all("2026-09-25", "2026-09-25").map((row) => row.id);
  assert.deepEqual(today, ["today", "shipping"]);
  assert.deepEqual(tomorrow, ["accepted-today-produced-tomorrow"]);
  database.close();
});

test("customer arrival, due-soon, changes, active work, accepted, waiting, and ready sort operationally", () => {
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
  assert.equal(isWorkshopDueSoon(fixture[5], now), true);
});

test("work acceptance, start, and completion transitions stay separate", () => {
  assert.equal(canApplyWorkshopAction(order(), "accept"), true);
  assert.equal(canApplyWorkshopAction(order({ workAcceptedAt: "2026-09-24" }), "accept"), false);
  assert.equal(canApplyWorkshopAction(order({ workAcceptedAt: "2026-09-24" }), "start"), true);
  assert.equal(canApplyWorkshopAction(order({ status: "in_progress" }), "complete"), true);
  assert.equal(canApplyWorkshopAction(order(), "complete"), false);
  assert.equal(workshopActionNextStatus("accept"), "confirmed");
  assert.equal(workshopActionNextStatus("start"), "in_progress");
  assert.equal(workshopActionNextStatus("complete"), "ready");
  assert.equal(workshopActionEventType("accept"), "WORK_ACCEPTED");
  assert.equal(workshopActionEventType("start"), "WORK_STARTED");
  assert.equal(workshopActionEventType("complete"), "WORK_COMPLETED");
});

test("product board calculates total, evidence-based completion, remaining, and earliest unfinished due", () => {
  const products = aggregateWorkshopProducts([
    order({ id: "nine-ready", status: "ready", pickupAt: "2026-09-24T09:00:00+09:00", items: [{ id: "a", productId: "phoenix", name: "봉황", quantity: 2, packageTotal: 2, packageCompleted: 2 }] }),
    order({ id: "ten", status: "in_progress", pickupAt: "2026-09-24T10:00:00+09:00", items: [{ id: "b", productId: "phoenix", name: "봉황", quantity: 1, packageTotal: 1, packageCompleted: 0 }] }),
    order({ id: "eleven", pickupAt: "2026-09-24T11:30:00+09:00", items: [{ id: "c", productId: "phoenix", name: "봉황", quantity: 3, packageTotal: 0, packageCompleted: 0 }] }),
  ]);
  assert.deepEqual(products, [{ productId: "phoenix", name: "봉황", total: 6, completed: 2, remaining: 4, nextDueAt: "2026-09-24T10:00:00+09:00" }]);
});

test("package-less ready orders use whole-order evidence but never invent partial completion", () => {
  const pending = order({ status: "in_progress", items: [{ id: "p", productId: "mi", name: "미", quantity: 5, packageTotal: 0, packageCompleted: 0 }] });
  const ready = order({ status: "ready", items: [{ id: "r", productId: "mi", name: "미", quantity: 5, packageTotal: 0, packageCompleted: 0 }] });
  assert.equal(completedQuantityForItem(pending, pending.items[0]), 0);
  assert.equal(completedQuantityForItem(ready, ready.items[0]), 5);
  const withPackages = order({ status: "ready", items: [{ id: "e", productId: "mi", name: "미", quantity: 5, packageTotal: 5, packageCompleted: 3 }] });
  assert.equal(completedQuantityForItem(withPackages, withPackages.items[0]), 3);
});

test("product board sorts by earliest unfinished time, remaining quantity, then name", () => {
  const result = aggregateWorkshopProducts([
    order({ id: "late", pickupAt: "2026-09-24T11:00:00+09:00", items: [{ id: "l", productId: "later", name: "팔영", quantity: 9, packageTotal: 0, packageCompleted: 0 }] }),
    order({ id: "early", pickupAt: "2026-09-24T09:00:00+09:00", items: [{ id: "e", productId: "early", name: "봉황", quantity: 1, packageTotal: 0, packageCompleted: 0 }] }),
  ]);
  assert.deepEqual(result.map((item) => item.productId), ["early", "later"]);
});

test("timeline uses visit time and clearly separates shipping", () => {
  const fixture = [
    order({ id: "late", pickupAt: "2026-09-24T12:00:00+09:00" }),
    order({ id: "shipping", fulfillmentType: "shipping", pickupAt: null, shipDate: "2026-09-24" }),
    order({ id: "early", pickupAt: "2026-09-24T09:00:00+09:00" }),
  ];
  assert.deepEqual(sortTimelineOrders(fixture).map((item) => item.id), ["early", "late", "shipping"]);
});

test("summary distinguishes accepted from waiting and product filter returns matching orders", () => {
  const fixture = [
    order({ id: "waiting" }),
    order({ id: "accepted", workAcceptedAt: "2026-09-24T00:00:00Z" }),
    order({ id: "working", status: "in_progress" }),
    order({ id: "ready", status: "ready" }),
  ];
  const summary = summarizeWorkshopOrders(fixture);
  assert.deepEqual([summary.total, summary.waiting, summary.accepted, summary.inProgress, summary.completed], [4, 1, 1, 1, 1]);
  assert.deepEqual(filterWorkshopOrdersByProduct(fixture, "mi").map((item) => item.id), ["waiting", "accepted", "working", "ready"]);
  assert.equal(filterWorkshopOrdersByProduct(fixture, "none").length, 0);
});

test("a newly polled order immediately increases total and remaining quantity", () => {
  const before = aggregateWorkshopProducts([order({ id: "existing" })])[0];
  const after = aggregateWorkshopProducts([order({ id: "existing" }), order({ id: "new", items: [{ id: "new-item", productId: "mi", name: "미", quantity: 2, packageTotal: 0, packageCompleted: 0 }] })])[0];
  assert.deepEqual([before.total, before.remaining], [2, 2]);
  assert.deepEqual([after.total, after.remaining], [4, 4]);
});

test("120 orders keep timeline, totals, completion split, and priority deterministic", () => {
  const fixture = Array.from({ length: 120 }, (_, index) => order({
    id: "fixture-" + index,
    status: index < 10 ? "ready" : index % 4 === 0 ? "in_progress" : "confirmed",
    customerArrived: index === 119,
    pickupAt: "2026-09-24T" + String(8 + Math.floor(index / 12)).padStart(2, "0") + ":" + String((index % 2) * 30).padStart(2, "0") + ":00+09:00",
    items: [{ id: "item-" + index, productId: "mi", name: "미", quantity: 1, packageTotal: 0, packageCompleted: 0 }],
  }));
  assert.equal(sortTimelineOrders(fixture).length, 120);
  assert.equal(sortWorkshopOrders(fixture, new Date("2026-09-23T00:00:00Z"))[0].id, "fixture-119");
  assert.deepEqual([aggregateWorkshopProducts(fixture)[0].total, aggregateWorkshopProducts(fixture)[0].completed], [120, 10]);
  assert.equal(summarizeWorkshopOrders(fixture).completed, 10);
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

test("digital whiteboard UI ties checkmarks to ready, separates completed, and omits money", async () => {
  const [api, actions, app, client, salesApi, salesOps] = await Promise.all([
    read("app/api/workshop/orders/route.ts"),
    read("app/api/workshop/actions/route.ts"),
    read("app/components/WorkshopApp.tsx"),
    read("app/lib/workshop-client.ts"),
    read("app/api/orders/route.ts"),
    read("app/lib/sales-operations.ts"),
  ]);
  for (const source of [api, app]) {
    assert.doesNotMatch(source, /payments|paidAmount|balance|creditDueDate|카드결제|계좌이체|외상|잔액|totalAmount|금액/);
  }
  assert.match(app, /order\.status === "ready" \? "✓" : "☐"/);
  assert.match(app, /준비완료 \{completed\.length\}건/);
  assert.match(app, /전체 보기/);
  assert.match(app, /오늘 상품별 생산량/);
  assert.match(app, /시간대별 작업 타임라인/);
  assert.match(app, /setInterval\([\s\S]{0,100}2500\)/);
  assert.match(app, /addEventListener\("focus"/);
  assert.match(app, /addEventListener\("online"/);
  assert.match(api, /fulfillment_items/);
  assert.match(api, /changeSeverity/);
  assert.match(api, /workAcceptedBy/);
  assert.match(api, /Cache-Control/);
  assert.match(client, /cache: "no-store"/);
  assert.match(actions, /runtimeEnv\.DB\.batch/);
  assert.match(actions, /WORK_ACCEPTED/);
  assert.match(actions, /package_status='in_progress'/);
  assert.match(actions, /package_status='completed'/);
  assert.match(salesApi, /workAcceptedAt/);
  assert.match(salesOps, /작업수락/);
});
test("next due advances after completion and clears when every matching item is complete", () => {
  const nine = order({ id: "nine", status: "ready", pickupAt: "2026-09-24T09:00:00+09:00", items: [{ id: "n", productId: "phoenix", name: "봉황", quantity: 2, packageTotal: 2, packageCompleted: 2, hasCustomization: false }] });
  const ten = order({ id: "ten", status: "in_progress", pickupAt: "2026-09-24T10:00:00+09:00", items: [{ id: "t", productId: "phoenix", name: "봉황", quantity: 1, packageTotal: 1, packageCompleted: 0, hasCustomization: false }] });
  const eleven = order({ id: "eleven", pickupAt: "2026-09-24T11:30:00+09:00", items: [{ id: "e", productId: "phoenix", name: "봉황", quantity: 3, packageTotal: 3, packageCompleted: 0, hasCustomization: false }] });
  const before = aggregateWorkshopProducts([nine, ten, eleven])[0];
  assert.equal(before.nextDueAt, "2026-09-24T10:00:00+09:00");
  assert.deepEqual([before.total, before.completed, before.remaining], [6, 2, 4]);
  const completedTen = { ...ten, status: "ready", items: [{ ...ten.items[0], packageCompleted: 1 }] };
  const after = aggregateWorkshopProducts([nine, completedTen, eleven])[0];
  assert.equal(after.nextDueAt, "2026-09-24T11:30:00+09:00");
  assert.deepEqual([after.total, after.completed, after.remaining], [6, 3, 3]);
  const finished = aggregateWorkshopProducts([nine, completedTen, { ...eleven, status: "ready", items: [{ ...eleven.items[0], packageCompleted: 3 }] }])[0];
  assert.equal(finished.nextDueAt, null);
  assert.deepEqual([finished.total, finished.completed, finished.remaining], [6, 6, 0]);
});

test("pickup urgency covers 60, 30, 15 minutes and overdue while excluding ready", () => {
  const now = new Date("2026-09-24T01:00:00.000Z");
  assert.equal(pickupUrgency(order({ pickupAt: "2026-09-24T10:50:00+09:00" }), now)?.level, "hour");
  assert.equal(pickupUrgency(order({ pickupAt: "2026-09-24T10:25:00+09:00" }), now)?.level, "due");
  assert.equal(pickupUrgency(order({ pickupAt: "2026-09-24T10:10:00+09:00" }), now)?.level, "urgent");
  assert.match(pickupUrgency(order({ pickupAt: "2026-09-24T09:55:00+09:00" }), now)?.label ?? "", /지연/);
  assert.equal(pickupUrgency(order({ status: "ready", pickupAt: "2026-09-24T10:05:00+09:00" }), now), null);
});

test("actual CUSTOMER_ARRIVED time calculates 45 minute early arrival and ready arrival stays out of urgency", () => {
  assert.equal(arrivalOffsetMinutes("2026-09-24T11:00:00+09:00", "2026-09-24T10:15:00+09:00"), 45);
  assert.equal(arrivalTimingLabel(45), "고객 조기도착 · 45분 빠름");
  const readyArrival = order({ status: "ready", customerArrived: true, actualArrivedAt: "2026-09-24T10:15:00+09:00" });
  assert.equal(pickupUrgency(readyArrival, new Date("2026-09-24T01:20:00Z")), null);
  assert.equal(workshopPriorityRank(readyArrival, new Date("2026-09-24T01:20:00Z")), 7);
});

test("early unfinished order finds only same-date later compatible completed package", () => {
  const target = order({ id: "target", orderNo: "TARGET", customerArrived: true, actualArrivedAt: "2026-09-24T10:15:00+09:00", pickupAt: "2026-09-24T11:00:00+09:00" });
  const source = order({ id: "source", orderNo: "SOURCE", status: "ready", pickupAt: "2026-09-24T12:30:00+09:00" });
  const nextDay = order({ id: "next-day", orderNo: "NEXT", status: "ready", pickupAt: "2026-09-25T12:30:00+09:00" });
  const packages = [
    { id: "target-pending", packageCode: "MI-TARGET", orderId: "target", productId: "mi", packageStatus: "in_progress" },
    { id: "same", packageCode: "MI-001", orderId: "source", productId: "mi", packageStatus: "completed" },
    { id: "other", packageCode: "ETC-001", orderId: "source", productId: "other", packageStatus: "completed" },
    { id: "tomorrow", packageCode: "MI-002", orderId: "next-day", productId: "mi", packageStatus: "completed" },
  ];
  const candidates = findSubstituteCandidates([target, source, nextDay], packages);
  assert.deepEqual(candidates.get("target")?.map((item) => item.packageId), ["same"]);
  assert.equal(findSubstituteCandidates([target, { ...source, items: [{ ...source.items[0], hasCustomization: true }] }], packages).has("target"), false);
  assert.equal(findSubstituteCandidates([{ ...target, hasSpecialRequest: true }, source], packages).has("target"), false);
  assert.equal(findSubstituteCandidates([target, source], packages, new Set(["same"])).has("target"), false);
});

test("one-for-one package reassignment preserves total and records non-PII audit data", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE orders(id TEXT PRIMARY KEY,order_status TEXT,version INTEGER); CREATE TABLE order_items(order_id TEXT,product_id TEXT,quantity INTEGER); CREATE TABLE packages(id TEXT PRIMARY KEY,order_id TEXT,product_id TEXT,package_status TEXT); CREATE TABLE order_events(id TEXT PRIMARY KEY,order_id TEXT,event_type TEXT,after_data TEXT,reason TEXT,actor_id TEXT,created_at TEXT)");
  database.prepare("INSERT INTO orders VALUES('early','in_progress',1),('later','ready',1)").run();
  database.prepare("INSERT INTO order_items VALUES('early','mi',1),('later','mi',1)").run();
  database.prepare("INSERT INTO packages VALUES('early-p','early','mi','in_progress'),('MI-001','later','mi','completed')").run();
  const totalBefore = database.prepare("SELECT SUM(quantity) total FROM order_items").get().total;
  database.exec("BEGIN");
  database.prepare("UPDATE packages SET order_id='early' WHERE id='MI-001' AND order_id='later' AND package_status='completed'").run();
  database.prepare("UPDATE packages SET order_id='later' WHERE id='early-p' AND order_id='early' AND package_status='in_progress'").run();
  database.prepare("UPDATE orders SET order_status='ready',version=version+1 WHERE id='early'").run();
  database.prepare("UPDATE orders SET order_status='in_progress',version=version+1 WHERE id='later'").run();
  database.prepare("INSERT INTO order_events VALUES('event','early','PACKAGE_REASSIGNED','{\"packageId\":\"MI-001\",\"replacementPackageId\":\"early-p\",\"fromOrderId\":\"later\",\"toOrderId\":\"early\",\"workerId\":\"worker\",\"performedAt\":\"2026-09-24T01:15:00Z\",\"labelActionRequired\":\"VOID_AND_REPRINT\"}','EARLY_CUSTOMER_ARRIVAL','worker','2026-09-24T01:15:00Z')").run();
  database.exec("COMMIT");
  assert.equal(database.prepare("SELECT SUM(quantity) total FROM order_items").get().total, totalBefore);
  assert.equal(database.prepare("SELECT COUNT(*) count FROM packages WHERE order_id='early'").get().count, 1);
  assert.equal(database.prepare("SELECT COUNT(*) count FROM packages WHERE order_id='later'").get().count, 1);
  assert.equal(database.prepare("SELECT order_status FROM orders WHERE id='early'").get().order_status, "ready");
  assert.equal(database.prepare("SELECT order_status FROM orders WHERE id='later'").get().order_status, "in_progress");
  const event = database.prepare("SELECT * FROM order_events").get();
  assert.equal(event.event_type, "PACKAGE_REASSIGNED");
  assert.equal(event.reason, "EARLY_CUSTOMER_ARRIVAL");
  assert.match(event.after_data, /VOID_AND_REPRINT/);
  assert.doesNotMatch(event.after_data, /buyerName|phone|address/);
  database.close();
});

test("integrated APIs expose arrival, reassignment, audit, and label hooks without migration", async () => {
  const [ordersApi, reassignApi, workshop, salesDetail] = await Promise.all([
    read("app/api/workshop/orders/route.ts"),
    read("app/api/workshop/packages/reassign/route.ts"),
    read("app/components/WorkshopApp.tsx"),
    read("app/components/SalesOrderDetail.tsx"),
  ]);
  assert.match(ordersApi, /actualArrivedAt/);
  assert.match(ordersApi, /fulfillment_items/);
  assert.match(ordersApi, /findSubstituteCandidates/);
  assert.match(reassignApi, /PACKAGE_REASSIGNED/);
  assert.match(reassignApi, /EARLY_CUSTOMER_ARRIVAL/);
  assert.match(reassignApi, /order_item_customizations/);
  assert.match(reassignApi, /labelActionRequired/);
  assert.match(reassignApi, /workerId/);
  assert.match(reassignApi, /performedAt/);
  assert.match(workshop, /대체 완성품 적용/);
  assert.match(salesDetail, /실제도착시간/);
  assert.match(salesDetail, /바로 전달 가능/);
});
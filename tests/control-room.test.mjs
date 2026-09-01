import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function runTypeScript(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJsModule = { exports: {} };
  vm.runInNewContext(output, {
    module: commonJsModule,
    exports: commonJsModule.exports,
    URLSearchParams,
    Date,
    Intl,
    Map,
    Set,
    Number,
    Math,
  });
  return commonJsModule.exports;
}

test("control-room access requires both operator and administrator allowlists", async () => {
  const operatorSource = await read("app/lib/operator-auth.ts");
  const accessSource = (await read("app/lib/control-room-auth.ts")).replaceAll("\r\n", "\n");
  const start = accessSource.indexOf("export function hasControlRoomAccess");
  const end = accessSource.indexOf("\n}\n\nfunction configuredAccess", start) + 2;
  const { hasControlRoomAccess } = runTypeScript(`${operatorSource}\n${accessSource.slice(start, end)}`);
  const user = { userId: "operator-1", email: "admin@example.com" };

  assert.equal(hasControlRoomAccess(user, {}), false);
  assert.equal(hasControlRoomAccess(user, { operatorUserIds: "operator-1" }), false);
  assert.equal(hasControlRoomAccess(user, { adminEmails: "ADMIN@example.com" }), false);
  assert.equal(hasControlRoomAccess(user, { operatorUserIds: "operator-1", adminEmails: "ADMIN@example.com" }), true);
});

test("operational date helpers validate dates and preserve date query values", async () => {
  const helpers = runTypeScript(await read("app/lib/operational-date.ts"));
  assert.equal(helpers.isValidOperationalDate("2026-09-01"), true);
  assert.equal(helpers.isValidOperationalDate("2026-02-30"), false);
  assert.equal(helpers.isValidOperationalDate("09-01-2026"), false);
  assert.equal(helpers.operationalDateFromSearch("?date=2026-09-07"), "2026-09-07");
  assert.equal(helpers.operationalDateFromSearch("?date=bad"), null);
  assert.equal(helpers.addOperationalDays("2026-09-01", 7), "2026-09-08");
});

test("today summary excludes cancelled orders and derives fixed priority alerts", async () => {
  const source = await read("app/lib/control-room-data.ts");
  const start = source.indexOf("const changeEventTypes");
  const end = source.indexOf("\nfunction productionSummary", start);
  const { summarizeControlRoomOrders } = runTypeScript(source.slice(start, end));
  const base = {
    pickup_at: null,
    ship_date: null,
    customer_arrived: 0,
    total_quantity: 1,
    package_total: 1,
    package_completed: 0,
  };
  const rows = [
    { ...base, id: "arrived", order_no: "A-1", order_status: "submitted", fulfillment_type: "pickup", pickup_at: "2026-09-01T09:25:00+09:00", customer_arrived: 1 },
    { ...base, id: "overdue", order_no: "A-2", order_status: "confirmed", fulfillment_type: "pickup", pickup_at: "2026-09-01T08:55:00+09:00" },
    { ...base, id: "soon", order_no: "A-3", order_status: "in_progress", fulfillment_type: "pickup", pickup_at: "2026-09-01T09:20:00+09:00", total_quantity: 2 },
    { ...base, id: "changed", order_no: "A-4", order_status: "ready", fulfillment_type: "shipping", ship_date: "2026-09-01", package_completed: 1 },
    { ...base, id: "onsite", order_no: "A-5", order_status: "fulfilled", fulfillment_type: "onsite", pickup_at: "2026-09-01T09:00:00+09:00", package_completed: 1 },
    { ...base, id: "cancelled", order_no: "A-6", order_status: "cancelled", fulfillment_type: "pickup", pickup_at: "2026-09-01T09:00:00+09:00", customer_arrived: 1 },
  ];
  const events = [{ order_id: "changed", event_type: "order_changed", created_at: "2026-09-01T00:01:00.000Z" }];
  const result = summarizeControlRoomOrders(rows, events, "2026-09-01", new Date("2026-09-01T00:10:00.000Z"));

  assert.deepEqual(
    { total: result.orders.total, onsite: result.orders.onsite, pickup: result.orders.pickup, shipping: result.orders.shipping, fulfilled: result.orders.fulfilled },
    { total: 5, onsite: 1, pickup: 3, shipping: 1, fulfilled: 1 },
  );
  assert.equal(result.orders.totalSets, 6);
  assert.equal(result.orders.arrived, 1);
  assert.equal(result.orders.overdue, 1);
  assert.equal(result.orders.changes, 1);
  assert.equal(result.packages.total, 5);
  assert.equal(result.packages.completed, 2);
  assert.deepEqual(
    Array.from(result.alerts, (alert) => alert.id),
    ["arrived:arrived", "overdue:overdue", "due:soon", "change:changed"],
  );
  assert.ok(result.alerts.every((alert) => alert.href.endsWith("?date=2026-09-01")));
});

test("live API source enforces production alerts, priority ordering, and no-store errors", async () => {
  const [data, auth, live, forecast] = await Promise.all([
    read("app/lib/control-room-data.ts"),
    read("app/lib/control-room-auth.ts"),
    read("app/api/control-room/live/route.ts"),
    read("app/api/control-room/forecast/route.ts"),
  ]);
  assert.match(data, /production:missing-bom/);
  assert.match(data, /production:shortage/);
  assert.match(data, /severityRank\[left\.severity\].*severityRank\[right\.severity\]/s);
  assert.match(data, /order_status NOT IN \('cancelled','fulfilled'\).*fulfillment_type!='onsite'/s);
  assert.match(auth, /status: 401, headers: controlRoomNoStoreHeaders/);
  assert.match(auth, /status: 403, headers: controlRoomNoStoreHeaders/);
  assert.match(live, /status: 400, headers: controlRoomNoStoreHeaders/);
  assert.match(forecast, /days > 7/);
  assert.match(forecast, /status: 400, headers: controlRoomNoStoreHeaders/);
});

test("dashboard keeps finance locked and propagates dates to all operating surfaces", async () => {
  const [app, nav, sales, workshop, production] = await Promise.all([
    read("app/components/ControlRoomApp.tsx"),
    read("app/components/AppNav.tsx"),
    read("app/components/SalesApp.tsx"),
    read("app/components/WorkshopApp.tsx"),
    read("app/components/ProductionApp.tsx"),
  ]);
  assert.match(app, /ledgerState === "locked"[\s\S]*금액은 고객 장부 5분 세션을 열어야 표시됩니다/);
  assert.match(app, /ledgerState === "unlocked" && ledgerSummary/);
  assert.match(app, /setInterval\(\(\) => void loadLive\(true\), 2500\)/);
  assert.match(app, /setInterval\(\(\) => void loadForecast\(true\), 60_000\)/);
  assert.match(app, /\/sales\?date=\$\{day\.date\}/);
  assert.match(app, /\/workshop\?date=\$\{day\.date\}/);
  assert.match(app, /\/workshop\/production\?date=\$\{day\.date\}/);
  assert.match(nav, /href: "\/control-room"/);
  assert.match(nav, /current === "kiosk" \? links\.filter\(\(link\) => link\.key !== "control-room"\)/);
  for (const source of [sales, workshop, production]) assert.match(source, /operationalDateFromSearch\(window\.location\.search\)/);
});

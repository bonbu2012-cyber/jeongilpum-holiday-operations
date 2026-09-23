import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { generatePackingLabels } from "../app/lib/workshop-packing-slip.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const splitMigration = (sql) => sql.split(/--> statement-breakpoint\s*/).map((v) => v.trim()).filter(Boolean);

function apply(database, sql) {
  for (const statement of splitMigration(sql)) database.exec(statement);
}

function applyProviderSafe(database, sql) {
  const statements = sql.split(";").map((v) => v.replaceAll("--> statement-breakpoint", "").trim()).filter(Boolean);
  for (const statement of statements) database.exec(statement);
}

async function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const name of ["0000_charming_bishop.sql", "0001_confused_swarm.sql", "0002_deep_giant_girl.sql", "0003_cancel_production_smoke_orders.sql"]) {
    apply(database, await read(`drizzle/${name}`));
  }
  applyProviderSafe(database, await read("drizzle/0004_brown_omega_red.sql"));
  applyProviderSafe(database, await read("drizzle/0005_chunky_sway.sql"));
  applyProviderSafe(database, await read("drizzle/0006_hot_hercules.sql"));
  applyProviderSafe(database, await read("drizzle/0007_curly_rattler.sql"));
  applyProviderSafe(database, await read("drizzle/0008_glamorous_magus.sql"));
  return database;
}

test("generatePackingLabels sets isAlreadyPrinted=false when item has no print count", () => {
  const items = [
    {
      id: "w-1",
      orderNo: "ORD-001",
      productId: "bonghwang",
      productName: "봉황세트",
      quantity: 2,
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-23T14:00:00+09:00",
      workStatus: "confirmed",
      buyerName: "홍길동",
      buyerPhone: "01011112222",
      labelPrintCount: 0,
      labelPrintedAt: null,
    },
  ];

  const labels = generatePackingLabels(items, "2026-09-23");
  assert.equal(labels.length, 2);
  assert.equal(labels[0].isAlreadyPrinted, false);
  assert.equal(labels[0].labelPrintCount, 0);
  assert.equal(labels[1].isAlreadyPrinted, false);
  assert.equal(labels[1].labelPrintCount, 0);
});

test("generatePackingLabels sets isAlreadyPrinted=true and preserves labelPrintCount when count > 0", () => {
  const items = [
    {
      id: "w-2",
      orderNo: "ORD-002",
      productId: "palyeong",
      productName: "팔영세트",
      quantity: 1,
      deliveryMethod: "delivery",
      dueAt: "2026-09-23T18:00:00+09:00",
      workStatus: "confirmed",
      buyerName: "김영희",
      buyerPhone: "01033334444",
      labelPrintCount: 3,
      labelPrintedAt: "2026-09-23T10:15:00+09:00",
    },
  ];

  const labels = generatePackingLabels(items, "2026-09-23");
  assert.equal(labels.length, 1);
  assert.equal(labels[0].isAlreadyPrinted, true);
  assert.equal(labels[0].labelPrintCount, 3);
  assert.equal(labels[0].labelPrintedAt, "2026-09-23T10:15:00+09:00");
});

test("Database subqueries for label_print_count and label_printed_at correctly aggregate work_item_events", async () => {
  const db = await migratedDatabase();
  const season = db.prepare("SELECT id FROM sales_seasons LIMIT 1").get();

  db.prepare(`
    INSERT INTO orders(id, order_no, season_id, buyer_name_snapshot, buyer_phone_snapshot, buyer_name, buyer_phone, payment_status, paid_amount, total_amount, order_status, fulfillment_type, schedule_label, idempotency_key, version, submitted_at, created_at, updated_at)
    VALUES('order-lbl-1', 'ORD-LBL-1', ?, '이몽룡', '01099998888', '이몽룡', '01099998888', 'paid', 250000, 250000, 'confirmed', 'pickup', '14:00 방문', 'idem-lbl-1', 1, '2026-09-23T08:00:00Z', '2026-09-23T08:00:00Z', '2026-09-23T08:00:00Z')
  `).run(season.id);

  db.prepare(`
    INSERT INTO work_items(id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total, delivery_method, due_at, work_status, note, created_at, updated_at)
    VALUES
      ('item-unprinted', 'order-lbl-1', 'bonghwang', '봉황세트', 250000, 1, 250000, 'onsite_reservation', '2026-09-23T14:00:00+09:00', 'received', '', '2026-09-23T08:00:00Z', '2026-09-23T08:00:00Z'),
      ('item-printed', 'order-lbl-1', 'palyeong', '팔영세트', 200000, 1, 200000, 'onsite_reservation', '2026-09-23T14:00:00+09:00', 'received', '', '2026-09-23T08:00:00Z', '2026-09-23T08:00:00Z')
  `).run();

  // Initial query: both should have 0 prints
  const selectSql = `
    SELECT
      w.id,
      w.product_name_snapshot,
      (SELECT COUNT(1) FROM work_item_events e WHERE e.work_item_id = w.id AND e.event_type = 'label_printed') AS label_print_count,
      (SELECT MAX(e.created_at) FROM work_item_events e WHERE e.work_item_id = w.id AND e.event_type = 'label_printed') AS label_printed_at
    FROM work_items w
    WHERE w.order_id = 'order-lbl-1'
    ORDER BY w.id ASC
  `;

  const initialRows = db.prepare(selectSql).all();
  assert.equal(initialRows.length, 2);
  assert.equal(initialRows[0].label_print_count, 0);
  assert.equal(initialRows[0].label_printed_at, null);
  assert.equal(initialRows[1].label_print_count, 0);
  assert.equal(initialRows[1].label_printed_at, null);

  // Simulate first label print for item-printed
  db.prepare(`
    INSERT INTO work_item_events(id, work_item_id, order_id, actor, event_type, from_value, to_value, created_at)
    VALUES('evt-1', 'item-printed', 'order-lbl-1', 'operator', 'label_printed', NULL, 'print_1', '2026-09-23T10:00:00+09:00')
  `).run();

  const afterFirstPrint = db.prepare(selectSql).all();
  const printedRow = afterFirstPrint.find((r) => r.id === "item-printed");
  const unprintedRow = afterFirstPrint.find((r) => r.id === "item-unprinted");

  assert.equal(unprintedRow.label_print_count, 0);
  assert.equal(unprintedRow.label_printed_at, null);
  assert.equal(printedRow.label_print_count, 1);
  assert.equal(printedRow.label_printed_at, "2026-09-23T10:00:00+09:00");

  // Simulate duplicate/re-print for item-printed
  db.prepare(`
    INSERT INTO work_item_events(id, work_item_id, order_id, actor, event_type, from_value, to_value, created_at)
    VALUES('evt-2', 'item-printed', 'order-lbl-1', 'operator', 'label_printed', 'print_1', 'print_2', '2026-09-23T11:30:00+09:00')
  `).run();

  const afterSecondPrint = db.prepare(selectSql).all();
  const secondPrintedRow = afterSecondPrint.find((r) => r.id === "item-printed");
  assert.equal(secondPrintedRow.label_print_count, 2);
  assert.equal(secondPrintedRow.label_printed_at, "2026-09-23T11:30:00+09:00");

  db.close();
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("payment summary calculation aggregates unpaid, partial, and paid amounts accurately in SQLite", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      buyer_phone TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE work_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_name_snapshot TEXT NOT NULL,
      recipient_name TEXT,
      recipient_phone TEXT,
      due_at TEXT NOT NULL,
      work_status TEXT NOT NULL
    );

    -- Order 1: Unpaid, 200,000 won, due 2026-09-12
    INSERT INTO orders VALUES ('o1', 'JI-001', '김철수', '01011112222', 'unpaid', 0, 200000);
    INSERT INTO work_items VALUES ('w1', 'o1', '정일품 갈비세트', '김철수', '01011112222', '2026-09-12T10:00:00+09:00', 'received');

    -- Order 2: Partial, Total 300,000, Paid 100,000, Balance 200,000, due 2026-09-12
    INSERT INTO orders VALUES ('o2', 'JI-002', '이영희', '01022223333', 'partial', 100000, 300000);
    INSERT INTO work_items VALUES ('w2', 'o2', '정일품 등심세트', '이영희', '01022223333', '2026-09-12T14:00:00+09:00', 'confirmed');

    -- Order 3: Paid, Total 150,000, Paid 150,000, due 2026-09-12
    INSERT INTO orders VALUES ('o3', 'JI-003', '박민수', '01033334444', 'paid', 150000, 150000);
    INSERT INTO work_items VALUES ('w3', 'o3', '정일품 불고기세트', '박민수', '01033334444', '2026-09-12T16:00:00+09:00', 'completed');

    -- Order 4: Unpaid, 500,000 won, due 2026-09-20 (different date)
    INSERT INTO orders VALUES ('o4', 'JI-004', '정대한', '01044445555', 'unpaid', 0, 500000);
    INSERT INTO work_items VALUES ('w4', 'o4', '정일품 한우특선', '정대한', '01044445555', '2026-09-20T10:00:00+09:00', 'received');

    -- Order 5: Cancelled work item, should be excluded from summary
    INSERT INTO orders VALUES ('o5', 'JI-005', '최취소', '01055556666', 'unpaid', 0, 100000);
    INSERT INTO work_items VALUES ('w5', 'o5', '정일품 국거리', '최취소', '01055556666', '2026-09-12T10:00:00+09:00', 'cancelled');
  `);

  const summaryQuery = `
    SELECT
      COUNT(CASE WHEN o.payment_status = 'unpaid' THEN 1 END) AS unpaid_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_amount ELSE 0 END), 0) AS unpaid_amount,
      COUNT(CASE WHEN o.payment_status = 'partial' THEN 1 END) AS partial_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'partial' THEN (o.total_amount - o.paid_amount) ELSE 0 END), 0) AS partial_amount,
      COUNT(CASE WHEN o.payment_status = 'paid' THEN 1 END) AS paid_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.paid_amount ELSE 0 END), 0) AS paid_amount,
      COALESCE(SUM(CASE WHEN o.payment_status IN ('unpaid', 'partial') THEN (o.total_amount - o.paid_amount) ELSE 0 END), 0) AS total_outstanding_amount
    FROM orders o
    WHERE EXISTS (
      SELECT 1 FROM work_items w
      WHERE w.order_id = o.id
        AND w.work_status != 'cancelled'
        AND substr(w.due_at, 1, 10) >= ?
        AND substr(w.due_at, 1, 10) <= ?
    )
  `;

  // 1. Single day query (2026-09-12)
  const todayRow = db.prepare(summaryQuery).get("2026-09-12", "2026-09-12");
  assert.equal(todayRow.unpaid_count, 1);
  assert.equal(todayRow.unpaid_amount, 200000);
  assert.equal(todayRow.partial_count, 1);
  assert.equal(todayRow.partial_amount, 200000);
  assert.equal(todayRow.paid_count, 1);
  assert.equal(todayRow.paid_amount, 150000);
  assert.equal(todayRow.total_outstanding_amount, 400000);

  // 2. All time query (no date constraint, non-cancelled)
  const allTimeQuery = `
    SELECT
      COUNT(CASE WHEN o.payment_status = 'unpaid' THEN 1 END) AS unpaid_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_amount ELSE 0 END), 0) AS unpaid_amount,
      COUNT(CASE WHEN o.payment_status = 'partial' THEN 1 END) AS partial_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'partial' THEN (o.total_amount - o.paid_amount) ELSE 0 END), 0) AS partial_amount,
      COUNT(CASE WHEN o.payment_status = 'paid' THEN 1 END) AS paid_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.paid_amount ELSE 0 END), 0) AS paid_amount,
      COALESCE(SUM(CASE WHEN o.payment_status IN ('unpaid', 'partial') THEN (o.total_amount - o.paid_amount) ELSE 0 END), 0) AS total_outstanding_amount
    FROM orders o
    WHERE EXISTS (
      SELECT 1 FROM work_items w
      WHERE w.order_id = o.id
        AND w.work_status != 'cancelled'
    )
  `;
  const allTimeRow = db.prepare(allTimeQuery).get();
  assert.equal(allTimeRow.unpaid_count, 2); // o1 and o4
  assert.equal(allTimeRow.unpaid_amount, 700000);
  assert.equal(allTimeRow.partial_count, 1); // o2
  assert.equal(allTimeRow.partial_amount, 200000);
  assert.equal(allTimeRow.paid_count, 1); // o3
  assert.equal(allTimeRow.paid_amount, 150000);
  assert.equal(allTimeRow.total_outstanding_amount, 900000);

  db.close();
});

test("sales API and SalesApp UI expose payment summary chips, payment filter, and quick date presets", async () => {
  const [salesApp, workItemsApi, css] = await Promise.all([
    read("app/components/SalesApp.tsx"),
    read("app/api/work-items/route.ts"),
    read("app/sales/work-table.css"),
  ]);

  // SalesApp UI checks
  assert.match(salesApp, /sales-payment-summary/);
  assert.match(salesApp, /미수고객 조회/);
  assert.match(salesApp, /총 미수금/);
  assert.match(salesApp, /미결제/);
  assert.match(salesApp, /부분결제/);
  assert.match(salesApp, /결제완료/);
  assert.match(salesApp, /sales-date-presets/);
  assert.match(salesApp, /오늘/);
  assert.match(salesApp, /전체/);
  assert.match(salesApp, /matchesPaymentFilter/);
  assert.match(salesApp, /paymentSummary/);

  // API checks
  assert.match(workItemsApi, /paymentSummaryFilters/);
  assert.match(workItemsApi, /createPaymentSummary/);
  assert.match(workItemsApi, /total_outstanding_amount/);
  assert.match(workItemsApi, /paymentFilter/);

  // CSS checks
  assert.match(css, /\.sales-payment-summary/);
  assert.match(css, /\.sales-payment-chip/);
  assert.match(css, /\.sales-date-presets/);
  assert.match(css, /\.sales-work-table__filter-button--outstanding/);
});

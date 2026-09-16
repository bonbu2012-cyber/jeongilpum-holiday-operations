import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

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

test("today ledger queries sort onsite orders by time, separate shipping orders, and group multi-item orders", async () => {
  const db = await migratedDatabase();

  const season = db.prepare("SELECT id FROM sales_seasons LIMIT 1").get();
  const today = "2026-09-16";

  // 1. 방문수령 주문 1: 오후 14:00 수령, 2개 상품 (봉황 1, 팔영 1), 결제완료
  db.prepare(`
    INSERT INTO orders(id, order_no, season_id, buyer_name_snapshot, buyer_phone_snapshot, buyer_name, buyer_phone, payment_status, paid_amount, total_amount, order_status, fulfillment_type, schedule_label, customer_note, idempotency_key, version, submitted_at, created_at, updated_at)
    VALUES('order-onsite-14', 'ORD-1400', ?, '홍길동', '01012345678', '홍길동', '01012345678', 'paid', 450000, 450000, 'confirmed', 'pickup', '14:00 방문', '얼음 많이 넣어주세요', 'idem-1', 1, '2026-09-16T08:00:00Z', '2026-09-16T08:00:00Z', '2026-09-16T08:00:00Z')
  `).run(season.id);

  db.prepare(`
    INSERT INTO work_items(id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total, delivery_method, due_at, work_status, note, created_at, updated_at)
    VALUES
      ('item-14-1', 'order-onsite-14', 'bonghwang', '봉황세트', 250000, 1, 250000, 'onsite_reservation', '2026-09-16T14:00:00+09:00', 'received', '', '2026-09-16T08:00:00Z', '2026-09-16T08:00:00Z'),
      ('item-14-2', 'order-onsite-14', 'palyeong', '팔영세트', 200000, 1, 200000, 'onsite_reservation', '2026-09-16T14:00:00+09:00', 'received', '', '2026-09-16T08:00:00Z', '2026-09-16T08:00:00Z')
  `).run();

  // 2. 방문수령 주문 2: 오전 10:30 수령, 1개 상품 (갈비 1), 미결제
  db.prepare(`
    INSERT INTO orders(id, order_no, season_id, buyer_name_snapshot, buyer_phone_snapshot, buyer_name, buyer_phone, payment_status, paid_amount, total_amount, order_status, fulfillment_type, schedule_label, customer_note, idempotency_key, version, submitted_at, created_at, updated_at)
    VALUES('order-onsite-10', 'ORD-1030', ?, '이순신', '01087654321', '이순신', '01087654321', 'unpaid', 0, 180000, 'confirmed', 'pickup', '10:30 방문', '', 'idem-2', 1, '2026-09-16T08:05:00Z', '2026-09-16T08:05:00Z', '2026-09-16T08:05:00Z')
  `).run(season.id);

  db.prepare(`
    INSERT INTO work_items(id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total, delivery_method, due_at, work_status, note, created_at, updated_at)
    VALUES('item-10-1', 'order-onsite-10', 'la-1', 'LA갈비 1호', 180000, 1, 180000, 'onsite_reservation', '2026-09-16T10:30:00+09:00', 'received', '', '2026-09-16T08:05:00Z', '2026-09-16T08:05:00Z')
  `).run();

  // 3. 택배 주문: 오늘 발송, 1개 상품, 일부결제 (총 300,000원 중 100,000원 입금)
  db.prepare(`
    INSERT INTO orders(id, order_no, season_id, buyer_name_snapshot, buyer_phone_snapshot, buyer_name, buyer_phone, payment_status, paid_amount, total_amount, order_status, fulfillment_type, schedule_label, customer_note, idempotency_key, version, submitted_at, created_at, updated_at)
    VALUES('order-delivery', 'ORD-SHIP', ?, '강감찬', '01099998888', '강감찬', '01099998888', 'partial', 100000, 300000, 'confirmed', 'shipping', '오늘 발송', '경비실에 맡겨주세요', 'idem-3', 1, '2026-09-16T08:10:00Z', '2026-09-16T08:10:00Z', '2026-09-16T08:10:00Z')
  `).run(season.id);

  db.prepare(`
    INSERT INTO work_items(id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total, delivery_method, due_at, work_status, note, recipient_name, recipient_phone, road_addr, detail_addr, created_at, updated_at)
    VALUES('item-ship-1', 'order-delivery', 'omeat-signature', '오미트 시그니처', 300000, 1, 300000, 'delivery', '2026-09-16T00:00:00+09:00', 'received', '', '김유신', '01077776666', '서울시 강남구 테헤란로 123', '101동 202호', '2026-09-16T08:10:00Z', '2026-09-16T08:10:00Z')
  `).run();

  // 4. 취소된 주문: 목록에 절대 나오면 안 됨
  db.prepare(`
    INSERT INTO orders(id, order_no, season_id, buyer_name_snapshot, buyer_phone_snapshot, buyer_name, buyer_phone, payment_status, paid_amount, total_amount, order_status, fulfillment_type, schedule_label, customer_note, idempotency_key, version, submitted_at, created_at, updated_at)
    VALUES('order-cancelled', 'ORD-CANCEL', ?, '취소자', '01000001111', '취소자', '01000001111', 'unpaid', 0, 100000, 'cancelled', 'pickup', '취소', '', 'idem-4', 1, '2026-09-16T08:20:00Z', '2026-09-16T08:20:00Z', '2026-09-16T08:20:00Z')
  `).run(season.id);

  db.prepare(`
    INSERT INTO work_items(id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total, delivery_method, due_at, work_status, note, created_at, updated_at)
    VALUES('item-cancel-1', 'order-cancelled', 'bonghwang', '봉황세트', 100000, 1, 100000, 'onsite_reservation', '2026-09-16T11:00:00+09:00', 'cancelled', '', '2026-09-16T08:20:00Z', '2026-09-16T08:20:00Z')
  `).run();

  // SQL 실행 (TodayLedger API 로직과 동일)
  const sql = `
    SELECT
      w.id,
      w.order_id,
      o.order_no,
      o.buyer_name,
      o.buyer_phone,
      o.payment_status,
      o.paid_amount,
      o.total_amount,
      w.product_name_snapshot,
      w.quantity,
      w.delivery_method,
      w.due_at,
      w.work_status
    FROM work_items w
    JOIN orders o ON o.id = w.order_id
    WHERE substr(w.due_at, 1, 10) = ?
      AND w.work_status != 'cancelled'
      AND o.order_status != 'cancelled'
    ORDER BY w.due_at ASC, w.created_at ASC, w.id ASC
  `;

  const rows = db.prepare(sql).all(today);

  // 취소된 주문 제외 확인
  assert.equal(rows.some((r) => r.order_no === "ORD-CANCEL"), false, "Cancelled order must be excluded");

  // 그룹화 및 분리
  const orderMap = new Map();
  for (const row of rows) {
    if (!orderMap.has(row.order_id)) {
      orderMap.set(row.order_id, { info: row, items: [] });
    }
    orderMap.get(row.order_id).items.push(`${row.product_name_snapshot} ${row.quantity}개`);
  }

  const onsite = [];
  const shipping = [];

  for (const { info, items } of orderMap.values()) {
    const obj = {
      orderNo: info.order_no,
      buyerName: info.buyer_name,
      dueAt: info.due_at,
      paymentStatus: info.payment_status,
      totalAmount: info.total_amount,
      paidAmount: info.paid_amount,
      balance: info.total_amount - info.paid_amount,
      itemsSummary: items.join(", "),
    };
    if (info.delivery_method === "delivery") {
      shipping.push(obj);
    } else {
      onsite.push(obj);
    }
  }

  onsite.sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  // 검증 1: 방문수령 2건 확인
  assert.equal(onsite.length, 2, "Should have 2 onsite orders");

  // 검증 2: 시간순 오름차순 정렬 확인 (10:30이 14:00보다 앞에 옴)
  assert.equal(onsite[0].orderNo, "ORD-1030", "10:30 order must be first");
  assert.equal(onsite[0].paymentStatus, "unpaid");
  assert.equal(onsite[0].balance, 180000);

  assert.equal(onsite[1].orderNo, "ORD-1400", "14:00 order must be second");
  assert.equal(onsite[1].paymentStatus, "paid");
  assert.equal(onsite[1].balance, 0);
  assert.equal(onsite[1].itemsSummary, "봉황세트 1개, 팔영세트 1개", "Multi-items must be summarized in one line");

  // 검증 3: 택배 발송 1건 확인 및 분리
  assert.equal(shipping.length, 1, "Should have 1 shipping order");
  assert.equal(shipping[0].orderNo, "ORD-SHIP");
  assert.equal(shipping[0].paymentStatus, "partial");
  assert.equal(shipping[0].balance, 200000);
});

test("today ledger payment change updates payment_status, paid_amount and increments order version", async () => {
  const db = await migratedDatabase();
  const season = db.prepare("SELECT id FROM sales_seasons LIMIT 1").get();

  // 미결제 주문 생성
  db.prepare(`
    INSERT INTO orders(id, order_no, season_id, buyer_name_snapshot, buyer_phone_snapshot, buyer_name, buyer_phone, payment_status, paid_amount, total_amount, order_status, fulfillment_type, schedule_label, customer_note, idempotency_key, version, submitted_at, created_at, updated_at)
    VALUES('order-test-pay', 'ORD-PAY-1', ?, '홍길동', '01012345678', '홍길동', '01012345678', 'unpaid', 0, 250000, 'confirmed', 'pickup', '11:00 방문', '', 'idem-pay-1', 1, '2026-09-16T08:00:00Z', '2026-09-16T08:00:00Z', '2026-09-16T08:00:00Z')
  `).run(season.id);

  db.prepare(`
    INSERT INTO work_items(id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total, delivery_method, due_at, work_status, note, created_at, updated_at)
    VALUES('item-pay-1', 'order-test-pay', 'bonghwang', '봉황세트', 250000, 1, 250000, 'onsite_reservation', '2026-09-16T11:00:00+09:00', 'received', '', '2026-09-16T08:00:00Z', '2026-09-16T08:00:00Z')
  `).run();

  // 1. 초기 상태 확인 (version=1, payment_status=unpaid, paid_amount=0)
  const initial = db.prepare("SELECT version, payment_status, paid_amount, total_amount FROM orders WHERE id='order-test-pay'").get();
  assert.equal(initial.version, 1);
  assert.equal(initial.payment_status, "unpaid");
  assert.equal(initial.paid_amount, 0);

  // 2. 수령 시 결제완료 처리 (PATCH /api/orders/payment 로직 모사)
  const now = new Date().toISOString();
  const updateResult = db.prepare(`
    UPDATE orders
    SET payment_status='paid', paid_amount=total_amount, version=version+1, updated_at=?
    WHERE id='order-test-pay' AND version=1
  `).run(now);

  assert.equal(updateResult.changes, 1, "Should update 1 order row");

  // 3. 결제완료 후 상태 확인 (version=2, payment_status=paid, paid_amount=total_amount)
  const updated = db.prepare("SELECT version, payment_status, paid_amount, total_amount FROM orders WHERE id='order-test-pay'").get();
  assert.equal(updated.version, 2);
  assert.equal(updated.payment_status, "paid");
  assert.equal(updated.paid_amount, 250000);

  // 4. 낙관적 잠금 (Optimistic Concurrency Control): 이전 version(1)으로 다시 수정 시도시 변경 0건이어야 함
  const conflictResult = db.prepare(`
    UPDATE orders
    SET payment_status='unpaid', paid_amount=0, version=version+1, updated_at=?
    WHERE id='order-test-pay' AND version=1
  `).run(now);
  assert.equal(conflictResult.changes, 0, "Conflicting version update must fail (changes = 0)");
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  BAND_POLICY_VERSION,
  PICKUP_WINDOWS,
  isValidPhone,
  normalizePhone,
  publicSale,
  saleState,
} from "../app/lib/band-reservation.ts";

test("BAND MVP normalizes and validates Korean mobile numbers", () => {
  assert.equal(normalizePhone("010-1234-5678"), "01012345678");
  assert.equal(isValidPhone("010-1234-5678"), true);
  assert.equal(isValidPhone("061-123-4567"), false);
});

test("BAND MVP keeps pickup windows advisory and includes unknown option", () => {
  assert.deepEqual(PICKUP_WINDOWS, [
    "10:00~12:00",
    "12:00~14:00",
    "14:00~16:00",
    "16:00~18:00",
    "18:00 이후",
    "아직 모름",
  ]);
});

test("sale state respects schedule and production limit", () => {
  const sale = {
    id: "sale-1",
    product_id: "p1",
    title: "테스트 상품",
    subtitle: "",
    price: 12900,
    production_limit: 10,
    reserved_qty: 4,
    deposit_per_unit: 1000,
    reservation_start_at: "2026-10-12T00:00:00.000Z",
    reservation_end_at: "2026-10-13T00:00:00.000Z",
    production_lock_at: "2026-10-13T05:00:00.000Z",
    pickup_date: "2026-10-14",
    pickup_start: "10:00",
    pickup_end: "19:00",
    pickup_location: "테스트 장소",
    status: "open",
    active: true,
  };

  assert.equal(saleState(sale, new Date("2026-10-12T01:00:00.000Z")), "open");
  assert.equal(publicSale(sale).remainingQty, 6);
  assert.equal(saleState({ ...sale, reserved_qty: 10 }, new Date("2026-10-12T01:00:00.000Z")), "sold_out");
  assert.equal(saleState(sale, new Date("2026-10-14T01:00:00.000Z")), "closed");
});

test("policy version is explicit and stable for stored consent", () => {
  assert.equal(BAND_POLICY_VERSION, "2026-10-mvp-1");
});

test("migration contains production capacity, idempotency and audit tables", async () => {
  const migration = await readFile(new URL("../drizzle/0009_band_reservation_mvp.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `band_sales`/);
  assert.match(migration, /production_limit/);
  assert.match(migration, /reserved_qty/);
  assert.match(migration, /idempotency_key/);
  assert.match(migration, /idx_band_reservations_idempotency/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `band_reservation_events`/);
});

test("public UI states that October MVP does not charge a real deposit", async () => {
  const source = await readFile(new URL("../app/components/BandReserveApp.tsx", import.meta.url), "utf8");
  assert.match(source, /10월 MVP 테스트 기간에는 실제 예약금이 결제되지 않습니다/);
  assert.match(source, /생산 확정 이후, 수령 당일 취소 및 노쇼는 예약금이 환불되지 않습니다/);
  assert.match(source, /선택한 시간을 반드시 지킬 필요는 없습니다/);
});

test("new BAND APIs use the database abstraction instead of direct provider imports", async () => {
  const paths = [
    "../app/api/band-sales/route.ts",
    "../app/api/band-reservations/route.ts",
    "../app/api/band-reservations/[id]/route.ts",
    "../app/api/band-customers/route.ts",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /supabaseAdmin/);
    assert.match(source, /getDb/);
  }
});

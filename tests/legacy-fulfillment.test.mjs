import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy orders remain searchable and appear as unscheduled in date views", async () => {
  const [ordersApi, admin] = await Promise.all([
    read("app/api/orders/route.ts"),
    read("app/components/AdminApp.tsx"),
  ]);

  assert.match(ordersApi, /LEFT JOIN fulfillments f/);
  assert.match(ordersApi, /f\.id IS NULL/);
  assert.match(ordersApi, /일정 미지정 · 기존 주문/);
  assert.match(ordersApi, /buyer_name_snapshot LIKE/);
  assert.match(ordersApi, /buyer_phone_snapshot LIKE/);
  assert.match(ordersApi, /order_no LIKE/);
  assert.match(admin, /일정 미지정 주문/);
  assert.match(admin, /기존 주문 원본은 변경하지 않으며/);
});

test("operator assignment creates fulfillment records without mutating legacy orders", async () => {
  const route = await read("app/api/orders/fulfillment/route.ts");

  assert.match(route, /INSERT INTO fulfillments/);
  assert.match(route, /INSERT INTO fulfillment_items/);
  assert.match(route, /fulfillment_assigned/);
  assert.match(route, /runtimeEnv\.DB\.batch/);
  assert.doesNotMatch(route, /UPDATE orders/);
  assert.match(route, /이미 일정이 지정된 주문입니다/);
});

test("legacy schedule editor requires an explicit fulfillment type and date", async () => {
  const admin = await read("app/components/AdminApp.tsx");

  assert.match(admin, /수령방법·일정 지정/);
  assert.match(admin, /type="date"/);
  assert.match(admin, /방문수령/);
  assert.match(admin, /택배발송/);
  assert.match(admin, /length: 27/);
  assert.match(admin, /8 \* 60 \+ index \* 30/);
});

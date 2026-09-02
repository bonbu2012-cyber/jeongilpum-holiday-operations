import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy orders remain searchable and appear as unscheduled in date views", async () => {
  const [ordersApi, orderQueries, sales] = await Promise.all([
    read("app/api/orders/route.ts"),
    read("app/lib/sales-order-query.ts"),
    read("app/components/SalesApp.tsx"),
  ]);

  assert.match(orderQueries, /LEFT JOIN fulfillments f/);
  assert.match(orderQueries, /f\.id IS NULL/);
  assert.match(ordersApi, /일정 미지정 · 기존 주문/);
  assert.match(orderQueries, /buyer_name_snapshot LIKE/);
  assert.match(orderQueries, /buyer_phone_snapshot LIKE/);
  assert.match(orderQueries, /order_no LIKE/);
  assert.match(sales, /일정 미지정 주문/);
  assert.match(sales, /기존 주문 원본 날짜는 추정하지 않습니다/);
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
  const detail = await read("app/components/SalesOrderDetail.tsx");

  assert.match(detail, /수령방법·일정 지정/);
  assert.match(detail, /type="date"/);
  assert.match(detail, /방문수령/);
  assert.match(detail, /택배발송/);
  assert.match(detail, /length: 27/);
  assert.match(detail, /8 \* 60 \+ index \* 30/);
});

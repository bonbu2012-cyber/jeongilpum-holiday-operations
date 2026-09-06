import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("settings counts active sales for today's limited products", async () => {
  const [settingsApi, settings] = await Promise.all([
    read("app/api/settings/route.ts"),
    read("app/components/SettingsApp.tsx"),
  ]);

  assert.match(settingsApi, /timeZone:"Asia\/Seoul"/);
  assert.match(settingsApi, /SUM\(r\.quantity\)/);
  assert.match(settingsApi, /r\.reserve_date=\?/);
  assert.match(settingsApi, /r\.status='active'/);
  assert.match(settingsApi, /remainingQuantity=active\?Math\.max\(0,dailyLimit-reservedQuantity\):null/);
  assert.match(settingsApi, /autoSoldOut:active&&remainingQuantity===0/);
  assert.match(settings, /오늘 판매/);
  assert.match(settings, /남은 수량/);
  assert.match(settings, /취소 주문 제외/);
  assert.match(settings, /item\.autoSoldOut\?"자동 품절"/);
});

test("the kiosk and order API keep automatic sell-out enforcement", async () => {
  const [productsApi, kiosk, ordersApi] = await Promise.all([
    read("app/api/products/route.ts"),
    read("app/components/KioskApp.tsx"),
    read("app/api/orders/route.ts"),
  ]);

  assert.match(productsApi, /sum\(\$\{productDailyReservations\.quantity\}\)/);
  assert.match(productsApi, /eq\(productDailyReservations\.status, "active"\)/);
  assert.match(productsApi, /Math\.max\(0, dailyLimit - reservedQuantity\)/);
  assert.match(kiosk, /disabled=\{soldOut\}/);
  assert.match(kiosk, /isProductSoldOut\(product\)/);
  assert.match(kiosk, /return <article className=\{soldOut/);
  assert.doesNotMatch(kiosk, /return <button className=\{soldOut\?"product-card/);
  assert.match(ordersApi, /product_daily_reservations/);
  assert.match(ordersApi, /daily product limit exceeded/);
});

test("cancelled reservations are excluded from automatic sold-out counts", async () => {
  const [settingsApi, statusApi] = await Promise.all([
    read("app/api/settings/route.ts"),
    read("app/api/orders/status/route.ts"),
  ]);

  assert.match(settingsApi, /r\.status='active'/);
  assert.match(statusApi, /UPDATE product_daily_reservations SET status='released'/);
  assert.match(statusApi, /x\.status==="cancelled"/);
});

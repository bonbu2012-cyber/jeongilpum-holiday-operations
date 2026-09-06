import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("each card-shaped product editor exposes a durable sold-out action", async () => {
  const [settings, settingsApi] = await Promise.all([
    read("app/components/SettingsApp.tsx"),
    read("app/api/settings/route.ts"),
  ]);

  assert.match(settings, /products\.map\(item=>\{const availabilityKey/);
  assert.match(settings, /item\.soldOut\?"판매 재개":"품절 처리"/);
  assert.match(settings, /type:"product_availability"/);
  assert.match(settings, /expectedVersion:item\.availabilityVersion/);
  assert.match(settingsApi, /payload\.type==="product_availability"/);
  assert.match(settingsApi, /entity_type='product_availability'/);
  assert.match(settingsApi, /INSERT INTO configuration_events/);
  assert.match(settingsApi, /result\.meta\.changes/);
});

test("sold-out products remain visible but cannot be selected or ordered", async () => {
  const [kiosk, productsApi, ordersApi, kioskCss] = await Promise.all([
    read("app/components/KioskApp.tsx"),
    read("app/api/products/route.ts"),
    read("app/api/orders/route.ts"),
    read("app/kiosk-flow.css"),
  ]);

  assert.match(kiosk, /disabled=\{soldOut\}/);
  assert.match(kiosk, /aria-disabled=\{soldOut\}/);
  assert.match(kiosk, /clampCartToAvailability/);
  assert.match(kiosk, />품절<\/em>/);
  assert.match(productsApi, /remainingQuantity: soldOut/);
  assert.match(productsApi, /latestProductAvailability/);
  assert.match(ordersApi, /availabilityByProduct\.get\(product\.id\)\?\.soldOut/);
  assert.match(kioskCss, /\.product-card\.sold-out:disabled/);
});

test("sold-out state does not overwrite premium daily limits", async () => {
  const settingsApi = await read("app/api/settings/route.ts");
  const availabilityBranch = settingsApi.slice(
    settingsApi.indexOf('if(payload.type==="product_availability")'),
    settingsApi.indexOf('if(payload.type==="daily_limit")'),
  );

  assert.doesNotMatch(availabilityBranch, /UPDATE product_daily_limits/);
  assert.doesNotMatch(availabilityBranch, /INSERT INTO product_daily_limits/);
  assert.match(availabilityBranch, /before=\{soldOut:/);
  assert.match(availabilityBranch, /after=\{soldOut\}/);
});

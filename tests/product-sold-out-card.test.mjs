import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("each product table row exposes a durable sold-out action", async () => {
  const [settings, settingsApi] = await Promise.all([
    read("app/components/SettingsApp.tsx"),
    read("app/api/settings/route.ts"),
  ]);

  assert.match(settings, /header: "품절 관리"/);
  assert.match(settings, /product\.soldOut\s*\? "판매 재개"\s*: "품절 처리"/);
  assert.match(settings, /type: "product_availability"/);
  assert.match(settings, /expectedVersion: product\.availabilityVersion/);
  assert.match(settingsApi, /payload\.type === "product_availability"/);
  assert.match(settingsApi, /entity_type = 'product_availability'/);
  assert.match(settingsApi, /INSERT INTO configuration_events/);
  assert.match(settingsApi, /result\.meta\.changes/);
});

test("sold-out products remain visible but cannot be selected in the kiosk", async () => {
  const [kiosk, productsApi, kioskCss] = await Promise.all([
    read("app/components/KioskApp.tsx"),
    read("app/api/products/route.ts"),
    read("app/kiosk-flow.css"),
  ]);

  assert.match(kiosk, /disabled=\{soldOut\}/);
  assert.match(kiosk, /aria-disabled=\{soldOut\}/);
  assert.match(kiosk, /clampCartToAvailability/);
  assert.match(kiosk, />품절<\/em>/);
  assert.match(productsApi, /const remainingQuantity = soldOut/);
  assert.match(productsApi, /soldOut,[\s\S]*remainingQuantity,/);
  assert.match(productsApi, /latestProductAvailability/);
  assert.match(kioskCss, /\.product-card\.sold-out \.product-photo::after/);
});

test("sold-out state does not overwrite premium daily limits", async () => {
  const settingsApi = await read("app/api/settings/route.ts");
  const availabilityBranch = settingsApi.slice(
    settingsApi.indexOf("async function updateProductAvailability"),
    settingsApi.indexOf("export async function GET"),
  );

  assert.doesNotMatch(availabilityBranch, /SET daily_limit/);
  assert.doesNotMatch(availabilityBranch, /UPDATE products/);
  assert.match(availabilityBranch, /const before = \{ soldOut:/);
  assert.match(availabilityBranch, /const after = \{ soldOut \}/);
});

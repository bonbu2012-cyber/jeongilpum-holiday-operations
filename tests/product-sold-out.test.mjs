import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clampCartToAvailability, isProductSoldOut } from "../app/lib/product-availability.ts";

test("zero remaining quantity is sold out while unlimited products stay available", () => {
  assert.equal(isProductSoldOut({ remainingQuantity: 0 }), true);
  assert.equal(isProductSoldOut({ remainingQuantity: -1 }), true);
  assert.equal(isProductSoldOut({ remainingQuantity: 1 }), false);
  assert.equal(isProductSoldOut({ remainingQuantity: null }), false);
});

test("restored kiosk cart quantities are clamped to current availability", () => {
  assert.deepEqual(clampCartToAvailability(
    { soldOut: 2, limited: 5, unlimited: 3, removed: 1 },
    [
      { id: "soldOut", remainingQuantity: 0 },
      { id: "limited", remainingQuantity: 2 },
      { id: "unlimited", remainingQuantity: null },
    ],
  ), { soldOut: 0, limited: 2, unlimited: 3, removed: 0 });
});

test("kiosk and settings expose the sold-out interaction contract", async () => {
  const [kiosk, settings, css] = await Promise.all([
    readFile(new URL("../app/components/KioskApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SettingsApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/kiosk.css", import.meta.url), "utf8"),
  ]);

  assert.match(kiosk, /disabled=\{soldOut\}/);
  assert.match(kiosk, /if\(soldOut\)return/);
  assert.match(kiosk, /product-sold-out-label/);
  assert.match(settings, /0이면 품절입니다/);
  assert.match(settings, /sold_out: "품절"/);
  assert.match(css, /\.product-card\.sold-out/);
});

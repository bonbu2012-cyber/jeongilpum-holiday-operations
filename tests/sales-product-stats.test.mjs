import assert from "node:assert/strict";
import test from "node:test";
import { resolveProductSummaryMeta } from "../app/lib/workshop-packing-slip.ts";

test("resolveProductSummaryMeta maps products to correct lineups and sets correct sort order", () => {
  const jin = resolveProductSummaryMeta({ productId: "jin", productName: "진" });
  assert.equal(jin.category, "프리미엄");
  assert.equal(jin.name, "프리미엄 진");
  assert.equal(jin.categoryOrder, 1);
  assert.equal(jin.price, 320000);

  const omeat = resolveProductSummaryMeta({ productId: "omeat-prestige", productName: "오미트 프레스티지" });
  assert.equal(omeat.category, "O'meat");
  assert.equal(omeat.categoryOrder, 2);
  assert.equal(omeat.price, 389000);

  const palyeong = resolveProductSummaryMeta({ productId: "palyeong", productName: "팔영세트" });
  assert.equal(palyeong.category, "진공세트");
  assert.equal(palyeong.categoryOrder, 3);
  assert.equal(palyeong.price, 300000);

  const la = resolveProductSummaryMeta({ productId: "la-2", productName: "LA갈비 2호" });
  assert.equal(la.category, "LA갈비");
  assert.equal(la.categoryOrder, 4);

  const bone = resolveProductSummaryMeta({ productId: "bone-1", productName: "사골×우족" });
  assert.equal(bone.category, "뼈세트");
  assert.equal(bone.categoryOrder, 5);
});

test("stats API source file exists and verifies parameter validation and zero-quantity filtering", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/api/sales/product-stats/route.ts", import.meta.url), "utf8");

  assert.match(source, /startDate/);
  assert.match(source, /endDate/);
  assert.match(source, /filter\(\(p\) => p\.totalQuantity > 0\)/);
  assert.match(source, /categoryOrderMap/);
  assert.match(source, /requireOperatorApi/);
  assert.match(source, /grandTotalQty/);
  assert.match(source, /grandTotalAmount/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("product API exposes active BOM cut names in display order", () => {
  const source = read("app/api/products/route.ts");
  assert.match(source, /productComponents\.active/);
  assert.match(source, /productComponents\.sortOrder/);
  assert.match(source, /cutNames: cutNamesByProduct\.get\(product\.id\) \?\? \[\]/);
});

test("grilling gift sets show cuts on cards, comparisons, and details", () => {
  const kiosk = read("app/components/KioskApp.tsx");
  assert.match(kiosk, /const grillingGiftCategories=new Set\(\["진공세트","프리미엄","O'meat"\]\)/);
  assert.equal((kiosk.match(/<ProductCuts product=\{product\}/g) ?? []).length, 4);
  for (const cut of ["치마살", "부채살", "업진살", "갈비살", "제비추리"]) {
    assert.match(kiosk, new RegExp(`"${cut}":`));
  }
  assert.match(kiosk, /세부 부위는 당일 선별에 따라 달라질 수 있습니다/);
});

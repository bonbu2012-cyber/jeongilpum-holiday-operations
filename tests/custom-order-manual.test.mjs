import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("custom order draft uses only manual product name, amount, and request fields", async () => {
  const [custom, types] = await Promise.all([
    read("app/components/CustomOrderApp.tsx"),
    read("app/components/types.ts"),
  ]);

  assert.match(types, /CustomOrderDraftItem = \{\s+productName: string;\s+amount: number;\s+request: string;/);
  assert.doesNotMatch(types, /budgetOption|budgetAmount/);
  assert.match(custom, /<span>1<\/span> 품명/);
  assert.match(custom, /<span>2<\/span> 금액/);
  assert.match(custom, /<span>3<\/span> 요청사항/);
  assert.match(custom, /productName: draft\.productName\.trim\(\)/);
  assert.match(custom, /amount,/);
  assert.match(custom, /item\.directAmount/);
  assert.match(custom, /legacyOption\.match/);
  assert.doesNotMatch(custom, /budgetOptions|20만원부터/);
});

test("orders API stores the manual custom name and amount while accepting legacy drafts", async () => {
  const source = await read("app/api/orders/route.ts");

  assert.match(source, /productName\?: string/);
  assert.match(source, /amount\?: number/);
  assert.match(source, /custom\?\.amount \?\? custom\?\.budgetAmount/);
  assert.match(source, /productName: customName/);
  assert.match(source, /customAmount > 0/);
  assert.doesNotMatch(source, /customAmount >= 200_000/);
});

test("sales and workshop custom cells show amount and open the request modal", async () => {
  const [details, sales, workshop] = await Promise.all([
    read("app/components/CustomOrderDetails.tsx"),
    read("app/components/SalesApp.tsx"),
    read("app/components/WorkshopApp.tsx"),
  ]);

  assert.match(details, /<small>\{won\(amount\)\}<\/small>/);
  assert.match(details, />\s*요청사항\s*</);
  assert.match(details, /title="맞춤주문 요청사항"/);
  assert.match(details, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(details, /등록된 요청사항이 없습니다/);
  assert.match(sales, /item\.productId === "custom-order"/);
  assert.match(sales, /<CustomOrderDetails/);
  assert.match(workshop, /item\.productId === "custom-order"/);
  assert.equal((workshop.match(/<CustomOrderDetails/g) || []).length, 2);
});

test("kiosk normalizes old custom drafts and shows the new fields", async () => {
  const kiosk = await read("app/components/KioskApp.tsx");

  assert.match(kiosk, /normalizeCustomItem/);
  assert.match(kiosk, /item\.amount\?\?item\.budgetAmount/);
  assert.match(kiosk, /draft\.customItem\.productName/);
  assert.match(kiosk, /draft\.customItem\.amount/);
  assert.match(kiosk, /<span>품명<\/span>/);
  assert.match(kiosk, /<span>금액<\/span>/);
  assert.match(kiosk, /placeholder=""/);
});

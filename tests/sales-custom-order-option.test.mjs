import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("WorkItemEditor includes '기타 상품' (custom-order) in productOptions and handles price reset", async () => {
  const source = await read("app/components/WorkItemEditor.tsx");

  // Verify otherProductOption definition and custom-order fallback
  assert.match(source, /id:\s*"custom-order"/);
  assert.match(source, /name:\s*otherProductOptionName/);
  assert.match(source, /"기타 상품"/);
  assert.match(source, /products\.some\(\(product\) => product\.id === "custom-order"\)/);

  // Verify unitPrice handling when custom-order is selected
  assert.match(source, /if \(product\.id === "custom-order"\)/);
  assert.match(source, /onChange\("unitPrice",\s*"0"\)/);

  // Verify customization field provides clear guidance for custom/other products
  assert.match(source, /draft\.productId === "custom-order"\s*\?\s*"구성 정보 \(기타 상품/);
});

test("orders API prepareManualWorkItems sets productName to '기타 상품' for custom-order", async () => {
  const source = await read("app/api/orders/route.ts");

  assert.match(source, /item\.productId === "custom-order"\s*\?\s*\(item\.productName \|\| "기타 상품"\)\s*:\s*product\.name/);
  assert.match(source, /productName:\s*clean\(item\.productName\)/);
});

test("work-items API PATCH and POST set productName to '기타 상품' for custom-order", async () => {
  const source = await read("app/api/work-items/route.ts");

  assert.match(source, /productName = productId === "custom-order"/);
  assert.match(source, /"기타 상품"/);
  assert.match(source, /product\.id === "custom-order"/);
});

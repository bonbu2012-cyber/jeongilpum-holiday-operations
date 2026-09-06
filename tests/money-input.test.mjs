import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { koreanWonText } from "../app/lib/input-format.ts";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("money values are described in Korean units", () => {
  assert.equal(koreanWonText(""), "");
  assert.equal(koreanWonText("0"), "영 원");
  assert.equal(koreanWonText("10"), "십 원");
  assert.equal(koreanWonText("105"), "백오 원");
  assert.equal(koreanWonText("10,000"), "일만 원");
  assert.equal(koreanWonText("125800"), "십이만 오천팔백 원");
  assert.equal(koreanWonText("100010001"), "일억 일만 일 원");
});

test("every direct money editor uses the shared formatted input and Korean readout", async () => {
  const [custom, sales, settings, workItem, moneyInput] = await Promise.all([
    read("app/components/CustomOrderApp.tsx"),
    read("app/components/SalesApp.tsx"),
    read("app/components/SettingsApp.tsx"),
    read("app/components/WorkItemEditor.tsx"),
    read("app/components/MoneyInput.tsx"),
  ]);

  assert.match(custom, /<MoneyReadout value=\{draft\.amount\} \/>/);
  assert.match(sales, /<MoneyFieldInput id="sales-bulk-paid-amount"/);
  assert.match(sales, /<MoneyFieldInput id=\{`\$\{idPrefix\}-paid-amount`\}/);
  assert.match(sales, /<MoneyFieldInput id=\{`\$\{idPrefix\}-total-amount`\}/);
  assert.match(sales, /<MoneyFieldInput id="sales-paid-amount"/);
  assert.match(settings, /<MoneyFieldInput id="product-price"/);
  assert.match(workItem, /<MoneyFieldInput id=\{`\$\{idPrefix\}-unit-price`\}/);
  assert.match(moneyInput, /format="number"/);
  assert.match(moneyInput, /<MoneyReadout value=\{value\} \/>/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("SalesApp OrderFields exposes FieldSelect for payment-status with friendly Korean labels", async () => {
  const salesApp = await read("app/components/SalesApp.tsx");

  assert.match(
    salesApp,
    /<FieldSelect[\s\S]*?id=\{`\$\{idPrefix\}-payment-status`\}[\s\S]*?label="결제 상태"/,
    "OrderFields must render paymentStatus as FieldSelect instead of a raw text FieldInput",
  );
  assert.match(salesApp, /<option value="unpaid">미결제<\/option>/);
  assert.match(salesApp, /<option value="paid">결제완료<\/option>/);
  assert.match(salesApp, /<option value="partial">부분결제<\/option>/);
});

test("SalesApp NewOrderEditor synchronizes paymentStatus and paidAmount bidirectionally between work items and order draft", async () => {
  const salesApp = await read("app/components/SalesApp.tsx");

  // updateWorkItem syncs paymentStatus and recalculates paidAmount
  assert.match(salesApp, /if \(key === "paymentStatus"\)[\s\S]*?draft: \{ \.\.\.item\.draft, paymentStatus: value as "unpaid" \| "paid" \}/);
  assert.match(salesApp, /nextPaid = value === "paid" \? nextTotal : "0"/);

  // updateOrder syncs down to all work items
  assert.match(salesApp, /if \(key === "paymentStatus"\)[\s\S]*?setWorkItems\(\(current\) => current\.map/);

  // submit ensures isAnyPaid consistency
  assert.match(salesApp, /const isAnyPaid = draft\.paymentStatus === "paid" \|\| workItems\.some\(\(item\) => item\.draft\.paymentStatus === "paid"\)/);
  assert.match(salesApp, /paymentStatus: isAnyPaid \? "paid" : "unpaid"/);

  // Adding work item inherits order paymentStatus
  assert.match(salesApp, /draft: \{[\s\S]*?\.\.\.emptyWorkDraft\(\),[\s\S]*?paymentStatus: draft\.paymentStatus === "paid" \? "paid" : "unpaid"/);
});

test("SalesApp OrderEditor initializes work item paymentStatus and supports bidirectional sync", async () => {
  const salesApp = await read("app/components/SalesApp.tsx");

  assert.match(salesApp, /paymentStatus: initialDraft\.paymentStatus === "paid" \|\| item\.paymentStatus === "paid" \? "paid" : "unpaid"/);
  assert.match(salesApp, /updateWorkItemDraft/);
  assert.match(salesApp, /onChange=\{\(key, value\) => updateWorkItemDraft\(item\.id, key, value\)\}/);
});

test("api/orders manual-create supports item paymentStatus fallback to guarantee paid orders are saved with paid status", async () => {
  const ordersApi = await read("app/api/orders/route.ts");

  assert.match(ordersApi, /const hasPaidItem = \(payload\.items \?\? \[\]\)\.some\(\(item\) => isRecord\(item\) && item\.paymentStatus === "paid"\)/);
  assert.match(ordersApi, /const paymentStatus = \(hasPaidItem \|\| requestedStatus === "paid"\)/);
  assert.match(ordersApi, /const paidAmount = paymentStatus === "paid" \? Math\.max\(rawPaidAmount, totalAmount\) : rawPaidAmount/);
});

test("SalesApp notices provide clear visual feedback on payment status and collected amount", async () => {
  const salesApp = await read("app/components/SalesApp.tsx");

  assert.match(salesApp, /setNotice\(`새 주문을 등록했습니다\. \[\$\{paymentText\}\]`\)/);
  assert.match(salesApp, /setNotice\(`주문 정보를 저장했습니다\. \[\$\{paymentText\}\]`\)/);
  assert.match(salesApp, /setNotice\(`작업 행을 저장했습니다\.\$\{paymentNotice\}`\)/);
});


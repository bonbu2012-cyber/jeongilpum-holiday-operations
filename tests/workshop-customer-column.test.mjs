import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("workshop API provides customer details and WorkshopApp displays customer info without exposing payment data", async () => {
  const [api, app] = await Promise.all([
    read("app/api/workshop/orders/route.ts"),
    read("app/components/WorkshopApp.tsx"),
  ]);

  // API returns necessary customer information for operations
  assert.match(api, /buyerName:\s*row\.buyer_name/);
  assert.match(api, /buyerPhone:\s*row\.buyer_phone/);
  assert.match(api, /orderNo:\s*row\.order_no/);
  assert.match(api, /recipientName:\s*row\.recipient_name/);
  assert.match(api, /recipientPhone:\s*row\.recipient_phone/);

  // WorkshopApp includes customer column in onsite and delivery table definitions
  assert.match(app, /header:\s*"주문자"/);
  assert.match(app, /header:\s*"주문자 \/ 수령인"/);
  assert.match(app, /item\.buyerName \|\| "주문자 미입력"/);
  assert.match(app, /item\.buyerPhone.*item\.orderNo/);
  assert.match(app, /item\.recipientName/);

  // WorkshopApp does NOT expose payment amounts, status, or methods (AGENTS.md Rule 7)
  assert.doesNotMatch(app, /payments|paidAmount|balance|creditDueDate|카드결제|계좌이체|외상|잔액|totalAmount|paymentStatus/);
});

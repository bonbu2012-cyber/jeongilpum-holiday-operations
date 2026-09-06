import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateAndGroupBulkOrderRows } from "../app/lib/bulk-order-import.ts";
import { excelSerialToIsoDate, readBulkOrderWorkbook } from "../app/lib/xlsx-order-reader.ts";

const validRow = (changes = {}) => ({
  rowNumber: 6,
  groupKey: "1001",
  buyerName: "홍길동",
  buyerPhone: "010-1234-5678",
  recipientName: "김정일",
  recipientPhone: "010-2345-6789",
  postalCode: 6234,
  roadAddr: "서울 강남구 테헤란로 1",
  roadAddrReference: "",
  jibunAddr: "",
  detailAddr: "101호",
  shipDate: "2026-09-15",
  productCode: "vac-bh",
  quantity: 1,
  note: "오전 배송 희망",
  ...changes,
});

test("same group rows become one order and duplicate products merge", () => {
  const result = validateAndGroupBulkOrderRows([
    validRow(),
    validRow({ rowNumber: 7, quantity: 2 }),
    validRow({ rowNumber: 8, productCode: "PRE-MI", quantity: 1 }),
  ], "2026-09-06");

  assert.deepEqual(result.errors, []);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].postalCode, "06234");
  assert.equal(result.groups[0].buyerPhone, "01012345678");
  assert.deepEqual(result.groups[0].items, [
    { productCode: "VAC-BH", quantity: 3, rowNumbers: [6, 7] },
    { productCode: "PRE-MI", quantity: 1, rowNumbers: [8] },
  ]);
});

test("conflicting order-level fields are rejected before writes", () => {
  const result = validateAndGroupBulkOrderRows([
    validRow(),
    validRow({ rowNumber: 7, recipientName: "다른 수령인", note: "다른 메모" }),
  ], "2026-09-06");

  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.errors.map((error) => error.field), ["수령인명", "주문메모"]);
});

test("required shipping fields, dates, phone numbers, and quantity are validated", () => {
  const result = validateAndGroupBulkOrderRows([
    validRow({
      buyerPhone: "1234",
      recipientPhone: "010",
      postalCode: "123456",
      roadAddr: "서울",
      detailAddr: "",
      shipDate: "2026-09-05",
      productCode: "",
      quantity: 0,
    }),
  ], "2026-09-06");

  assert.deepEqual(result.errors.map((error) => error.field), [
    "주문자연락처",
    "수령인연락처",
    "우편번호",
    "도로명주소",
    "상세주소",
    "발송일",
    "상품코드",
    "수량",
  ]);
});

test("malformed API rows are reported instead of throwing", () => {
  const result = validateAndGroupBulkOrderRows([null], "2026-09-06");
  assert.equal(result.groups.length, 0);
  assert.deepEqual(result.errors, [{ rowNumber: null, field: "행", message: "주문 행 형식을 확인해주세요." }]);
});

test("committed workbook has the required upload sheet and no accidental data rows", async () => {
  const bytes = await readFile(new URL("../public/templates/jeongilpum-bulk-shipping-orders.xlsx", import.meta.url));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  assert.deepEqual(await readBulkOrderWorkbook(buffer), []);
  assert.equal(excelSerialToIsoDate(46280), "2026-09-15");
});

test("bulk route stays operator-only, idempotent, atomic per order, and auditable", async () => {
  const source = await readFile(new URL("../app/api/orders/bulk/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireOperatorApi\(\)/);
  assert.match(source, /bulk-xlsx:/);
  assert.match(source, /runtimeEnv\.DB\.batch\(statements\)/);
  assert.match(source, /source: "bulk_xlsx"/);
  assert.match(source, /redactedFields/);
  assert.doesNotMatch(source, /console\.(log|error)/);
});

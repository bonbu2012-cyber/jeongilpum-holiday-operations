import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateAndGroupBulkOrderRows } from "../app/lib/bulk-order-import.ts";
import { excelSerialToIsoDate, excelSerialToTime, readBulkOrderWorkbook } from "../app/lib/xlsx-order-reader.ts";

const validShippingRow = (changes = {}) => ({
  rowNumber: 6,
  groupKey: "1001",
  fulfillmentMethod: "택배발송",
  buyerName: "홍길동",
  buyerPhone: "010-1234-5678",
  recipientName: "김정일",
  recipientPhone: "010-2345-6789",
  postalCode: 6234,
  roadAddr: "서울 강남구 테헤란로 1",
  roadAddrReference: "",
  jibunAddr: "",
  detailAddr: "101호",
  scheduleDate: "2026-09-15",
  pickupTime: "",
  productCode: "vac-bh",
  quantity: 1,
  note: "오전 배송 희망",
  ...changes,
});

const validPickupRow = (changes = {}) => ({
  rowNumber: 8,
  groupKey: "1002",
  fulfillmentMethod: "현장수령",
  buyerName: "이정품",
  buyerPhone: "010-3456-7890",
  recipientName: "",
  recipientPhone: "",
  postalCode: "",
  roadAddr: "",
  roadAddrReference: "",
  jibunAddr: "",
  detailAddr: "",
  scheduleDate: "2026-09-16",
  pickupTime: "10:30",
  productCode: "LA-1",
  quantity: 1,
  note: "방문 전 연락",
  ...changes,
});

test("shipping rows group into one order and duplicate products merge", () => {
  const result = validateAndGroupBulkOrderRows([
    validShippingRow(),
    validShippingRow({ rowNumber: 7, quantity: 2 }),
    validShippingRow({ rowNumber: 8, productCode: "PRE-MI", quantity: 1 }),
  ], "2026-09-06");

  assert.deepEqual(result.errors, []);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].fulfillmentType, "shipping");
  assert.equal(result.groups[0].postalCode, "06234");
  assert.equal(result.groups[0].buyerPhone, "01012345678");
  assert.deepEqual(result.groups[0].items, [
    { productCode: "VAC-BH", quantity: 3, rowNumbers: [6, 7] },
    { productCode: "PRE-MI", quantity: 1, rowNumbers: [8] },
  ]);
});

test("pickup rows require a date and 30-minute pickup time but no shipping address", () => {
  const valid = validateAndGroupBulkOrderRows([validPickupRow()], "2026-09-06");
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.groups[0].fulfillmentType, "pickup");
  assert.equal(valid.groups[0].pickupTime, "10:30");
  assert.equal(valid.groups[0].recipientName, "");

  const invalid = validateAndGroupBulkOrderRows([validPickupRow({ pickupTime: "10:15" })], "2026-09-06");
  assert.deepEqual(invalid.errors.map((error) => error.field), ["현장수령시간"]);
});

test("one workbook can contain pickup and shipping groups", () => {
  const result = validateAndGroupBulkOrderRows([validShippingRow(), validPickupRow()], "2026-09-06");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.groups.map((group) => group.fulfillmentType), ["shipping", "pickup"]);
});

test("conflicting fulfillment and order-level fields are rejected before writes", () => {
  const result = validateAndGroupBulkOrderRows([
    validShippingRow(),
    validPickupRow({ rowNumber: 7, groupKey: "1001", note: "다른 메모" }),
  ], "2026-09-06");

  assert.equal(result.groups.length, 1);
  assert.ok(result.errors.some((error) => error.field === "수령방법"));
  assert.ok(result.errors.some((error) => error.field === "주문메모"));
});

test("shipping fields, dates, phone numbers, and quantity are validated", () => {
  const result = validateAndGroupBulkOrderRows([
    validShippingRow({
      buyerPhone: "1234",
      recipientPhone: "010",
      postalCode: "123456",
      roadAddr: "서울",
      detailAddr: "",
      scheduleDate: "2026-09-05",
      pickupTime: "10:30",
      productCode: "",
      quantity: 0,
    }),
  ], "2026-09-06");

  assert.deepEqual(result.errors.map((error) => error.field), [
    "주문자연락처",
    "수령/발송일",
    "수령인연락처",
    "우편번호",
    "도로명주소",
    "상세주소",
    "현장수령시간",
    "상품코드",
    "수량",
  ]);
});

test("malformed API rows are reported instead of throwing", () => {
  const result = validateAndGroupBulkOrderRows([null], "2026-09-06");
  assert.equal(result.groups.length, 0);
  assert.deepEqual(result.errors, [{ rowNumber: null, field: "행", message: "주문 행 형식을 확인해주세요." }]);
});

test("committed combined workbook has the required upload sheet and no accidental data rows", async () => {
  const bytes = await readFile(new URL("../public/templates/jeongilpum-bulk-orders.xlsx", import.meta.url));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  assert.deepEqual(await readBulkOrderWorkbook(buffer), []);
  assert.equal(excelSerialToIsoDate(46280), "2026-09-15");
  assert.equal(excelSerialToTime(0.4375), "10:30");
});

test("bulk route stays operator-only, idempotent, atomic, auditable, and supports both methods", async () => {
  const source = await readFile(new URL("../app/api/orders/bulk/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireOperatorApi\(\)/);
  assert.match(source, /bulk-xlsx:/);
  assert.match(source, /runtimeEnv\.DB\.batch\(statements\)/);
  assert.match(source, /source: "bulk_xlsx"/);
  assert.match(source, /onsite_reservation/);
  assert.match(source, /"delivery"/);
  assert.match(source, /fulfillmentType: group\.fulfillmentType/);
  assert.match(source, /redactedFields/);
  assert.doesNotMatch(source, /console\.(log|error)/);
});

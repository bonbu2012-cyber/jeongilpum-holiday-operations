import test from "node:test";
import assert from "node:assert/strict";
import {
  COURIER_INVOICE_HEADERS,
  buildCourierInvoiceRow,
  generateCourierInvoiceCsv,
  isShippingItem,
} from "../app/lib/courier-invoice-csv.ts";

test("courier invoice headers match the user standard template exactly", () => {
  assert.equal(COURIER_INVOICE_HEADERS.length, 11);
  assert.equal(COURIER_INVOICE_HEADERS[0], "보내는사람(지정)");
  assert.equal(COURIER_INVOICE_HEADERS[1], "주소(지정)");
  assert.equal(COURIER_INVOICE_HEADERS[2], "전화번호1(지정)");
  assert.equal(COURIER_INVOICE_HEADERS[3], "받는사람");
  assert.equal(COURIER_INVOICE_HEADERS[4], "전화번호1");
  assert.equal(COURIER_INVOICE_HEADERS[5], "우편번호");
  assert.equal(COURIER_INVOICE_HEADERS[6], "주소");
  assert.equal(COURIER_INVOICE_HEADERS[7], ""); // Column H
  assert.equal(COURIER_INVOICE_HEADERS[8], "수량(A타입)");
  assert.equal(COURIER_INVOICE_HEADERS[9], "상품명1");
  assert.equal(COURIER_INVOICE_HEADERS[10], "배송메시지");
});

test("buildCourierInvoiceRow formats shipping items matching sample image data", () => {
  // Sample 1: 박신자 건 (주문자 정일품)
  const item1 = {
    deliveryMethod: "delivery",
    buyerName: "정일품",
    buyerPhone: "010-7159-6872",
    recipientName: "박신자",
    recipientPhone: "010-5651-4225",
    postalCode: "",
    roadAddr: "전남 여수시 쌍봉로 113, 1층  한신전기",
    quantity: 1,
  };

  const row1 = buildCourierInvoiceRow(item1);
  assert.equal(row1[0], "정일품");
  assert.equal(row1[1], "");
  assert.equal(row1[2], "01071596872");
  assert.equal(row1[3], "박신자");
  assert.equal(row1[4], "01056514225");
  assert.equal(row1[5], "");
  assert.equal(row1[6], "전남 여수시 쌍봉로 113, 1층  한신전기");
  assert.equal(row1[7], "");
  assert.equal(row1[8], "1");
  assert.equal(row1[9], "신선식품. 육류");
  assert.equal(row1[10], "");

  // Sample 2: 조승연 건 (주문자 성지민)
  const item2 = {
    deliveryMethod: "delivery",
    buyerName: "성지민",
    buyerPhone: "010-8839-6686",
    recipientName: "조승연",
    recipientPhone: "010-9268-1774",
    postalCode: "57900",
    roadAddr: "전남 순천시 해룡면 신대로 97",
    detailAddr: "504동 701호",
    quantity: 2,
    customerNote: "문 앞에 놓아주세요",
  };

  const row2 = buildCourierInvoiceRow(item2);
  assert.equal(row2[0], "성지민");
  assert.equal(row2[1], "");
  assert.equal(row2[2], "01088396686");
  assert.equal(row2[3], "조승연");
  assert.equal(row2[4], "01092681774");
  assert.equal(row2[5], "57900");
  assert.equal(row2[6], "전남 순천시 해룡면 신대로 97 504동 701호");
  assert.equal(row2[7], "");
  assert.equal(row2[8], "2");
  assert.equal(row2[9], "신선식품. 육류");
  assert.equal(row2[10], "문 앞에 놓아주세요");
});

test("generateCourierInvoiceCsv filters out pickup and cancelled orders", () => {
  const items = [
    { id: "1", deliveryMethod: "delivery", buyerName: "배송고객", recipientName: "받는이", quantity: 1 },
    { id: "2", deliveryMethod: "onsite_reservation", buyerName: "방문고객", quantity: 1 },
    { id: "3", deliveryMethod: "delivery", workStatus: "cancelled", buyerName: "취소고객", quantity: 1 },
  ];

  const result = generateCourierInvoiceCsv(items);
  assert.equal(result.count, 1);
  assert.ok(result.csv.startsWith("\uFEFF"));
  assert.ok(result.csv.includes("배송고객"));
  assert.ok(!result.csv.includes("방문고객"));
  assert.ok(!result.csv.includes("취소고객"));
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  isLegacyOrderCsv,
  parseLegacyOrderRows,
  parseLegacyPickupTime,
  matchProduct,
} from "../app/lib/legacy-order-csv-importer.ts";

const SAMPLE_CSV = `"주문번호","출고일","시간","주문자","상품","수량","단가","수령방식","받는사람","받는사람 전화번호","받는주소","합계금액","결제상태","결제금액","출고상태","검수상태"
"ORD-037","2026-09-04","","봉황정","사골×우족 49000","1","미정","현장수령","","","","49000","미결제","0","수령완료","검수대기"
"ORD-027","2026-09-08","","한화손해보험","LA갈비 95,000원 세트","26","미정","택배","","","","2470000","결제완료","2470000","출고완료","검수대기"
"ORD-019","2026-09-09","","정종철","팔영세트","4","300000","택배","","","","1200000","결제완료","1200000","출고완료","검수대기"
"ORD-059","2026-09-14","","류승범","프리미엄 미","1","220000","택배","류성훈","01044481000","광주광역시 서구 풍암순환로 135-1, 203동 903호 (한국아델리움 아파트)","220000","결제완료","220000","출고예정","검수대기"
"ORD-066","2026-09-17","오후 7시","함형구","프리미엄 선","6","270000","현장수령","","","","1620000","미결제","0","출고예정","검수대기"
"ORD-042","2026-09-26","10:00","김보름","프리미엄 미 세트","1","미정","현장수령","","","","220000","결제완료","220000","출고예정","검수대기"`;

test("isLegacyOrderCsv correctly identifies the legacy header format", () => {
  assert.equal(isLegacyOrderCsv(SAMPLE_CSV), true);
  assert.equal(isLegacyOrderCsv("something,else,entirely"), false);
});

test("parseLegacyPickupTime handles afternoon, morning, and empty pickup times", () => {
  assert.equal(parseLegacyPickupTime("오후 7시", true), "19:00");
  assert.equal(parseLegacyPickupTime("10:00", true), "10:00");
  assert.equal(parseLegacyPickupTime("15:00", true), "15:00");
  assert.equal(parseLegacyPickupTime("오전", true), "10:00");
  assert.equal(parseLegacyPickupTime("", true), "10:00");
  assert.equal(parseLegacyPickupTime("", false), "");
});

test("matchProduct identifies catalog items vs custom items", () => {
  const palyeong = matchProduct("팔영세트");
  assert.equal(palyeong.isCustom, false);
  assert.equal(palyeong.product.id, "palyeong");

  const customBone = matchProduct("사골×우족 49000");
  assert.equal(customBone.isCustom, true);
  assert.equal(customBone.product.id, "custom-order");

  const jin = matchProduct("프리미엄 진 세트");
  assert.equal(jin.isCustom, false);
  assert.equal(jin.product.id, "jin");
});

test("parseLegacyOrderRows parses sample rows accurately", () => {
  const { orders, errors } = parseLegacyOrderRows(SAMPLE_CSV);
  assert.equal(errors.length, 0);
  assert.equal(orders.length, 6);

  // ORD-037
  assert.equal(orders[0].orderNo, "ORD-037");
  assert.equal(orders[0].buyerName, "봉황정");
  assert.equal(orders[0].fulfillmentType, "pickup");
  assert.equal(orders[0].workStatus, "completed");
  assert.equal(orders[0].paymentStatus, "unpaid");
  assert.equal(orders[0].totalAmount, 49000);

  // ORD-027
  assert.equal(orders[1].orderNo, "ORD-027");
  assert.equal(orders[1].buyerName, "한화손해보험");
  assert.equal(orders[1].quantity, 26);
  assert.equal(orders[1].fulfillmentType, "shipping");
  assert.equal(orders[1].paymentStatus, "paid");
  assert.equal(orders[1].paidAmount, 2470000);
  assert.equal(orders[1].totalAmount, 2470000);

  // ORD-059 (Recipient details)
  assert.equal(orders[3].orderNo, "ORD-059");
  assert.equal(orders[3].buyerName, "류승범");
  assert.equal(orders[3].recipientName, "류성훈");
  assert.equal(orders[3].recipientPhone, "01044481000");
  assert.equal(orders[3].roadAddr, "광주광역시 서구 풍암순환로 135-1");
  assert.equal(orders[3].detailAddr, "203동 903호 (한국아델리움 아파트)");

  // ORD-066 (Evening pickup time)
  assert.equal(orders[4].pickupTime, "19:00");

  // ORD-042 (2026-09-26)
  assert.equal(orders[5].scheduleDate, "2026-09-26");
  assert.equal(orders[5].pickupTime, "10:00");
  assert.equal(orders[5].totalAmount, 220000);
});

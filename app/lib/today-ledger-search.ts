import type { TodayLedgerOrder } from "../api/today-ledger/route";

export function matchesTodayLedgerSearch(order: TodayLedgerOrder, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const qDigits = q.replace(/\D/g, "");

  // 1. 주문자명
  if (order.buyerName && order.buyerName.toLowerCase().includes(q)) return true;

  // 2. 주문자 전화번호 (원본 및 숫자만)
  if (order.buyerPhone && order.buyerPhone.toLowerCase().includes(q)) return true;
  if (order.buyerPhoneMasked && order.buyerPhoneMasked.toLowerCase().includes(q)) return true;
  if (qDigits && order.buyerPhone && order.buyerPhone.replace(/\D/g, "").includes(qDigits)) return true;

  // 3. 수령인명 및 수령인 전화번호
  if (order.recipientName && order.recipientName.toLowerCase().includes(q)) return true;
  if (order.recipientPhone && order.recipientPhone.toLowerCase().includes(q)) return true;
  if (qDigits && order.recipientPhone && order.recipientPhone.replace(/\D/g, "").includes(qDigits)) return true;

  // 4. 배송지 주소
  if (order.recipientAddress && order.recipientAddress.toLowerCase().includes(q)) return true;

  // 5. 주문번호
  if (order.orderNo && order.orderNo.toLowerCase().includes(q)) return true;

  // 6. 상품 요약 및 개별 품목명, 맞춤 요약
  if (order.itemsSummary && order.itemsSummary.toLowerCase().includes(q)) return true;
  if (order.items && order.items.some((item) =>
    (item.name && item.name.toLowerCase().includes(q)) ||
    (item.customizationSummary && item.customizationSummary.toLowerCase().includes(q))
  )) return true;

  // 7. 고객 메모 및 관리자 메모
  if (order.customerNote && order.customerNote.toLowerCase().includes(q)) return true;
  if (order.adminNote && order.adminNote.toLowerCase().includes(q)) return true;

  return false;
}

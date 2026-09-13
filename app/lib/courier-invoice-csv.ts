function csvText(value: unknown) {
  if (value === null || value === undefined) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

export function escapeCsvCell(value: unknown): string {
  const text = csvText(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export type CourierWorkItemLike = {
  id?: string;
  orderId?: string;
  orderNo?: string;
  buyerName?: string | null;
  buyerPhone?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  postalCode?: string | null;
  roadAddr?: string | null;
  roadAddress?: string | null;
  jibunAddr?: string | null;
  detailAddr?: string | null;
  detailAddress?: string | null;
  deliveryMethod?: string | null;
  fulfillmentType?: string | null;
  workStatus?: string | null;
  quantity?: number | null;
  productName?: string | null;
  productNameSnapshot?: string | null;
  customerNote?: string | null;
  note?: string | null;
  dueAt?: string | null;
  shipDate?: string | null;
};

export const COURIER_INVOICE_HEADERS = [
  "보내는사람(지정)",
  "주소(지정)",
  "전화번호1(지정)",
  "받는사람",
  "전화번호1",
  "우편번호",
  "주소",
  "", // H열 (빈 열 유지)
  "수량(A타입)",
  "상품명1",
  "배송메시지",
] as const;

export const DEFAULT_SENDER_NAME = "정일품";
export const DEFAULT_SENDER_PHONE = "01071596872";
export const DEFAULT_PRODUCT_NAME = "신선식품. 육류";

function cleanDigits(value?: string | null): string {
  if (!value) return "";
  return value.replace(/\D/g, "").trim();
}

export function isShippingItem(item: CourierWorkItemLike): boolean {
  if (item.workStatus === "cancelled") return false;
  const method = (item.deliveryMethod || item.fulfillmentType || "").toLowerCase();
  return method === "delivery" || method === "shipping" || method.includes("택배");
}

export function buildCourierInvoiceRow(item: CourierWorkItemLike): string[] {
  // 1. 보내는사람(지정) - 주문자명이 있으면 주문자명, 없으면 '정일품'
  const senderName = (item.buyerName || "").trim() || DEFAULT_SENDER_NAME;

  // 2. 주소(지정) - 사진 서식 기준 기본 공란
  const senderAddr = "";

  // 3. 전화번호1(지정) - 주문자 전화번호 (숫자만), 없으면 기본 대표번호
  const rawBuyerPhone = cleanDigits(item.buyerPhone);
  const senderPhone = rawBuyerPhone || DEFAULT_SENDER_PHONE;

  // 4. 받는사람 - 수령인명 (없으면 주문자명)
  const recipientName = (item.recipientName || "").trim() || senderName;

  // 5. 전화번호1 - 수령인 전화번호 (없으면 주문자 전화번호)
  const rawRecipientPhone = cleanDigits(item.recipientPhone);
  const recipientPhone = rawRecipientPhone || senderPhone;

  // 6. 우편번호 - 5자리 우편번호
  const postalCode = cleanDigits(item.postalCode);

  // 7. 주소 - 전체 도로명 + 상세 주소
  const baseAddress = (item.roadAddr || item.roadAddress || item.jibunAddr || "").trim();
  const detailAddress = (item.detailAddr || item.detailAddress || "").trim();
  const fullAddress = [baseAddress, detailAddress].filter(Boolean).join(" ");

  // 8. H열 - 공란
  const colH = "";

  // 9. 수량(A타입) - 숫자 수량
  const quantity = String(item.quantity && item.quantity > 0 ? item.quantity : 1);

  // 10. 상품명1 - 택배사 지정 품명 '신선식품. 육류'
  const productName = DEFAULT_PRODUCT_NAME;

  // 11. 배송메시지 - 고객 요청사항 / 메모
  const deliveryMessage = (item.customerNote || item.note || "").trim();

  return [
    senderName,
    senderAddr,
    senderPhone,
    recipientName,
    recipientPhone,
    postalCode,
    fullAddress,
    colH,
    quantity,
    productName,
    deliveryMessage,
  ];
}

export function generateCourierInvoiceCsv(items: CourierWorkItemLike[]): {
  csv: string;
  count: number;
} {
  const shippingItems = items.filter(isShippingItem);
  const rows = shippingItems.map(buildCourierInvoiceRow);

  const headerRow = COURIER_INVOICE_HEADERS.map((h) => escapeCsvCell(h)).join(",");
  const dataRows = rows.map((r) => r.map((cell) => escapeCsvCell(cell)).join(","));

  const content = `\uFEFF${[headerRow, ...dataRows].join("\r\n")}`;
  return {
    csv: content,
    count: shippingItems.length,
  };
}

export function downloadCourierInvoiceCsvFile(items: CourierWorkItemLike[], dateLabel?: string): boolean {
  const { csv, count } = generateCourierInvoiceCsv(items);
  if (count === 0) {
    return false;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const dateStr = (dateLabel || new Date().toISOString().slice(0, 10)).replace(/[^\d-]/g, "");
  anchor.href = url;
  anchor.download = `택배송장_정일품_${dateStr}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}

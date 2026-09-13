export const LEGACY_CSV_HEADERS = [
  "주문번호",
  "출고일",
  "시간",
  "주문자",
  "상품",
  "수량",
  "단가",
  "수령방식",
  "받는사람",
  "받는사람 전화번호",
  "받는주소",
  "합계금액",
  "결제상태",
  "결제금액",
  "출고상태",
  "검수상태",
] as const;

export type LegacyParsedOrder = {
  orderNo: string;
  scheduleDate: string;
  pickupTime: string;
  buyerName: string;
  buyerPhone: string;
  fulfillmentType: "pickup" | "shipping";
  deliveryMethod: "onsite_reservation" | "delivery";
  recipientName: string;
  recipientPhone: string;
  roadAddr: string;
  detailAddr: string;
  productId: string;
  productCode: string;
  productName: string;
  rawProduct: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  totalAmount: number;
  paymentStatus: "paid" | "unpaid" | "partial";
  paidAmount: number;
  workStatus: "received" | "ready" | "completed" | "cancelled";
  note: string;
  rawRowNumber: number;
};

export type CatalogProductRef = {
  id: string;
  code: string;
  name: string;
  price: number;
};

export const DEFAULT_CATALOG_PRODUCTS: CatalogProductRef[] = [
  { id: "practical", code: "VAC-PRACTICAL", name: "실속세트", price: 144000 },
  { id: "bonghwang", code: "VAC-BH", name: "봉황세트", price: 200000 },
  { id: "palyeong", code: "VAC-PY", name: "팔영세트", price: 300000 },
  { id: "jin", code: "PRE-JIN", name: "진", price: 320000 },
  { id: "seon", code: "PRE-SEON", name: "선", price: 270000 },
  { id: "mi", code: "PRE-MI", name: "미", price: 220000 },
  { id: "omeat-signature", code: "OM-SIG", name: "O'meat Signature", price: 289000 },
  { id: "omeat-prestige", code: "OM-PRE", name: "O'meat Prestige", price: 389000 },
  { id: "la-1", code: "LA-1", name: "LA갈비 1호", price: 99000 },
  { id: "la-2", code: "LA-2", name: "LA갈비 2호", price: 148000 },
  { id: "bone-1", code: "BONE-1", name: "사골×우족", price: 59000 },
  { id: "bone-2", code: "BONE-2", name: "사골×잡뼈×꼬리", price: 99000 },
  { id: "custom-order", code: "CUSTOM", name: "맞춤주문", price: 0 },
];

export function parseCsvLines(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        if (currentRow.some((field) => field !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function isLegacyOrderCsv(csvText: string): boolean {
  const firstLines = csvText.slice(0, 1000);
  const requiredKeywords = ["주문번호", "출고일", "상품", "수령방식"];
  return requiredKeywords.every((keyword) => firstLines.includes(keyword));
}

export function parseLegacyPickupTime(raw: string, isPickup: boolean): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return isPickup ? "10:00" : "";
  }
  const directMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (directMatch) {
    const h = String(Number(directMatch[1])).padStart(2, "0");
    const m = directMatch[2];
    return `${h}:${m}`;
  }
  if (trimmed.includes("오후") && trimmed.includes("7")) return "19:00";
  if (trimmed.includes("오후") && trimmed.includes("1")) return "13:00";
  if (trimmed.includes("오후") && trimmed.includes("2")) return "14:00";
  if (trimmed.includes("오후") && trimmed.includes("3")) return "15:00";
  if (trimmed.includes("오후") && trimmed.includes("4")) return "16:00";
  if (trimmed.includes("오후") && trimmed.includes("5")) return "17:00";
  if (trimmed.includes("오후") && trimmed.includes("6")) return "18:00";
  if (trimmed.includes("오전")) return "10:00";

  return isPickup ? "10:00" : "";
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const digits = String(value).replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function matchProduct(
  rawName: string,
  catalog: CatalogProductRef[] = DEFAULT_CATALOG_PRODUCTS,
): { product: CatalogProductRef; isCustom: boolean; displayName: string } {
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();

  const customOrderProduct = catalog.find((p) => p.id === "custom-order") || {
    id: "custom-order",
    code: "CUSTOM",
    name: "맞춤주문",
    price: 0,
  };

  // 1. Exact or strict standard matches
  if (/^팔영세트(\s*1개)?$/.test(trimmed)) {
    const found = catalog.find((p) => p.id === "palyeong");
    if (found) return { product: found, isCustom: false, displayName: found.name };
  }
  if (/^봉황세트$/.test(trimmed)) {
    const found = catalog.find((p) => p.id === "bonghwang");
    if (found) return { product: found, isCustom: false, displayName: found.name };
  }
  if (/^실속세트$/.test(trimmed)) {
    const found = catalog.find((p) => p.id === "practical");
    if (found) return { product: found, isCustom: false, displayName: found.name };
  }
  if (/^프리미엄\s*진(\s*세트)?$/.test(trimmed) || /^진\s*세트$/.test(trimmed)) {
    const found = catalog.find((p) => p.id === "jin");
    if (found) return { product: found, isCustom: false, displayName: "프리미엄 진 세트" };
  }
  if (/^프리미엄\s*선(\s*세트)?$/.test(trimmed) || /^선\s*세트$/.test(trimmed)) {
    const found = catalog.find((p) => p.id === "seon");
    if (found) return { product: found, isCustom: false, displayName: "프리미엄 선" };
  }
  if (/^프리미엄\s*미(\s*세트)?$/.test(trimmed) || /^미\s*세트$/.test(trimmed)) {
    const found = catalog.find((p) => p.id === "mi");
    if (found) return { product: found, isCustom: false, displayName: "프리미엄 미" };
  }
  if (lower.includes("오미트") && lower.includes("시그니")) {
    const found = catalog.find((p) => p.id === "omeat-signature");
    if (found) return { product: found, isCustom: false, displayName: found.name };
  }
  if (lower.includes("la갈비 1호") || lower.includes("la 갈비 1호")) {
    if (!trimmed.includes(",")) {
      const found = catalog.find((p) => p.id === "la-1");
      if (found) return { product: found, isCustom: false, displayName: found.name };
    }
  }
  if (lower.includes("la갈비 2호") || lower.includes("la 갈비 2호")) {
    if (!trimmed.includes(",")) {
      const found = catalog.find((p) => p.id === "la-2");
      if (found) return { product: found, isCustom: false, displayName: found.name };
    }
  }

  // Otherwise, it's a custom-named order item
  return { product: customOrderProduct, isCustom: true, displayName: trimmed || "맞춤주문" };
}

export function parseLegacyOrderRows(
  csvText: string,
  catalog: CatalogProductRef[] = DEFAULT_CATALOG_PRODUCTS,
): { orders: LegacyParsedOrder[]; errors: string[] } {
  const rows = parseCsvLines(csvText);
  if (rows.length === 0) {
    return { orders: [], errors: ["CSV 파일이 비어 있습니다."] };
  }

  // Find header index
  let headerIndex = -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (row.includes("주문번호") && row.includes("출고일") && row.includes("상품")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      orders: [],
      errors: ["기존 앱 주문 CSV의 헤더('주문번호', '출고일', '상품' 등)를 찾을 수 없습니다."],
    };
  }

  const headerRow = rows[headerIndex];
  const colIndex = {
    orderNo: headerRow.indexOf("주문번호"),
    scheduleDate: headerRow.indexOf("출고일"),
    time: headerRow.indexOf("시간"),
    buyerName: headerRow.indexOf("주문자"),
    product: headerRow.indexOf("상품"),
    quantity: headerRow.indexOf("수량"),
    unitPrice: headerRow.indexOf("단가"),
    deliveryMethod: headerRow.indexOf("수령방식"),
    recipientName: headerRow.indexOf("받는사람"),
    recipientPhone: headerRow.indexOf("받는사람 전화번호"),
    recipientAddr: headerRow.indexOf("받는주소"),
    totalAmount: headerRow.indexOf("합계금액"),
    paymentStatus: headerRow.indexOf("결제상태"),
    paidAmount: headerRow.indexOf("결제금액"),
    shipStatus: headerRow.indexOf("출고상태"),
    inspectStatus: headerRow.indexOf("검수상태"),
  };

  const parsedOrders: LegacyParsedOrder[] = [];
  const errors: string[] = [];

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || !row.some((cell) => cell.trim() !== "")) continue;

    const orderNo = (row[colIndex.orderNo] || `ORD-M${r}`).trim();
    const scheduleDate = (row[colIndex.scheduleDate] || "").trim();
    const timeRaw = (row[colIndex.time] || "").trim();
    const buyerName = (row[colIndex.buyerName] || "주문자 미입력").trim();
    const rawProduct = (row[colIndex.product] || "상품 미정").trim();
    const quantityRaw = (row[colIndex.quantity] || "").trim();
    const unitPriceRaw = (row[colIndex.unitPrice] || "").trim();
    const deliveryMethodRaw = (row[colIndex.deliveryMethod] || "현장수령").trim();
    const recipientNameRaw = (row[colIndex.recipientName] || "").trim();
    const recipientPhoneRaw = (row[colIndex.recipientPhone] || "").trim().replace(/\D/g, "");
    const recipientAddrRaw = (row[colIndex.recipientAddr] || "").trim();
    const totalAmountRaw = (row[colIndex.totalAmount] || "").trim();
    const paymentStatusRaw = (row[colIndex.paymentStatus] || "").trim();
    const paidAmountRaw = (row[colIndex.paidAmount] || "").trim();
    const shipStatusRaw = (row[colIndex.shipStatus] || "").trim();

    if (!orderNo || !scheduleDate) {
      errors.push(`${r + 1}행: 주문번호 또는 출고일이 누락되었습니다.`);
      continue;
    }

    const isPickup = deliveryMethodRaw.includes("현장");
    const isDelivery = deliveryMethodRaw.includes("배달");
    const isShipping = !isPickup;

    const fulfillmentType: "pickup" | "shipping" = isPickup ? "pickup" : "shipping";
    const deliveryMethod: "onsite_reservation" | "delivery" = isPickup
      ? "onsite_reservation"
      : "delivery";

    const pickupTime = parseLegacyPickupTime(timeRaw, isPickup);

    // Quantity
    let quantity = parseNumber(quantityRaw);
    if (quantity <= 0) quantity = 1;

    // Unit price and Total amount
    let totalAmount = parseNumber(totalAmountRaw);
    let unitPrice = parseNumber(unitPriceRaw);

    if (totalAmount > 0 && unitPrice === 0) {
      unitPrice = Math.round(totalAmount / quantity);
    } else if (unitPrice > 0 && totalAmount === 0) {
      totalAmount = unitPrice * quantity;
    }

    const matched = matchProduct(rawProduct, catalog);
    const productId = matched.product.id;
    const productCode = matched.product.code;
    const productName = matched.isCustom ? rawProduct : matched.displayName;

    if (unitPrice === 0 && matched.product.price > 0 && !matched.isCustom) {
      unitPrice = matched.product.price;
      totalAmount = unitPrice * quantity;
    }

    // Payment
    const isPaid = paymentStatusRaw.includes("완료");
    let paidAmount = parseNumber(paidAmountRaw);
    if (isPaid && paidAmount === 0 && totalAmount > 0) {
      paidAmount = totalAmount;
    }
    const paymentStatus: "paid" | "unpaid" | "partial" = isPaid
      ? "paid"
      : paidAmount > 0
        ? "partial"
        : "unpaid";

    // Work status
    const isCompleted = shipStatusRaw.includes("완료");
    const workStatus: "received" | "ready" | "completed" | "cancelled" = isCompleted
      ? "completed"
      : "received";

    // Phone numbers & Names
    const recipientName = recipientNameRaw || (isShipping ? buyerName : "");
    const recipientPhone = recipientPhoneRaw || (isShipping ? "01000000000" : "");
    const buyerPhone = recipientPhoneRaw || "01000000000";

    // Address
    let roadAddr = recipientAddrRaw;
    let detailAddr = "";
    if (recipientAddrRaw.includes(",")) {
      const parts = recipientAddrRaw.split(",");
      roadAddr = parts[0].trim();
      detailAddr = parts.slice(1).join(",").trim();
    }

    let note = "";
    if (isDelivery) {
      note = "배달";
    }
    if (timeRaw && !isPickup) {
      note = note ? `${note} · ${timeRaw}` : timeRaw;
    }

    parsedOrders.push({
      orderNo,
      scheduleDate,
      pickupTime,
      buyerName,
      buyerPhone,
      fulfillmentType,
      deliveryMethod,
      recipientName,
      recipientPhone,
      roadAddr,
      detailAddr,
      productId,
      productCode,
      productName,
      rawProduct,
      quantity,
      unitPrice,
      lineTotal: totalAmount,
      totalAmount,
      paymentStatus,
      paidAmount,
      workStatus,
      note,
      rawRowNumber: r + 1,
    });
  }

  return { orders: parsedOrders, errors };
}

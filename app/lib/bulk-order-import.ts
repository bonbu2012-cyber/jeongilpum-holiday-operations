export const BULK_ORDER_HEADERS = [
  "출고일(희망수령일)*",
  "수령방식*",
  "주문자명*",
  "주문자연락처*",
  "상품명*",
  "수량*",
  "단가",
  "합계금액",
  "받는사람",
  "받는사람연락처",
  "받는사람주소",
  "방문시간",
  "배송메시지",
  "결제상태",
  "비고(기타상품내용/메모)",
] as const;

export const LEGACY_BULK_ORDER_HEADERS = [
  "주문그룹키*",
  "수령방법*",
  "주문자명*",
  "주문자연락처*",
  "수령인명(택배필수)",
  "수령인연락처(택배필수)",
  "우편번호(택배필수)",
  "도로명주소(택배필수)",
  "참고주소",
  "지번주소",
  "상세주소(택배필수)",
  "수령/발송일*",
  "현장수령시간(현장필수)",
  "상품코드*",
  "수량*",
  "주문메모",
] as const;

export const MAX_BULK_ORDER_ROWS = 200;
export const MAX_BULK_ORDER_GROUPS = 100;

export type BulkOrderFulfillmentType = "pickup" | "shipping";

export type BulkOrderRowInput = {
  rowNumber: number;
  groupKey?: unknown;
  fulfillmentMethod: unknown;
  buyerName: unknown;
  buyerPhone: unknown;
  recipientName?: unknown;
  recipientPhone?: unknown;
  postalCode?: unknown;
  roadAddr?: unknown;
  roadAddrReference?: unknown;
  jibunAddr?: unknown;
  detailAddr?: unknown;
  scheduleDate: unknown;
  pickupTime?: unknown;
  productCode?: unknown;
  productName?: unknown;
  quantity: unknown;
  unitPrice?: unknown;
  totalAmount?: unknown;
  paymentStatus?: unknown;
  deliveryMemo?: unknown;
  note?: unknown;
};

export type BulkOrderItem = {
  productCode: string;
  productName?: string;
  unitPrice?: number;
  lineTotal?: number;
  isCustom?: boolean;
  quantity: number;
  rowNumbers: number[];
};

export type BulkOrderGroup = {
  groupKey: string;
  fulfillmentType: BulkOrderFulfillmentType;
  deliveryMethod: "onsite_reservation" | "delivery";
  buyerName: string;
  buyerPhone: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  roadAddr: string;
  roadAddrReference: string;
  jibunAddr: string;
  detailAddr: string;
  scheduleDate: string;
  pickupTime: string;
  note: string;
  paymentStatus: "paid" | "unpaid";
  totalAmount: number;
  rowNumbers: number[];
  items: BulkOrderItem[];
};

export type BulkOrderValidationError = {
  rowNumber: number | null;
  field: string;
  message: string;
};

export const STANDARD_CATALOG_PRICES: Record<string, number> = {
  "VAC-PRACTICAL": 144000,
  "VAC-BH": 200000,
  "VAC-PY": 300000,
  "PRE-JIN": 320000,
  "PRE-SEON": 270000,
  "PRE-MI": 220000,
  "OM-SIG": 289000,
  "OM-PRE": 389000,
  "LA-1": 99000,
  "LA-2": 148000,
  "BONE-1": 59000,
  "BONE-2": 99000,
  "CUSTOM": 0,
};

export function resolveProductCode(nameOrCode: unknown): string {
  const trimmed = text(nameOrCode);
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();

  const standardCodes = [
    "VAC-PRACTICAL", "VAC-BH", "VAC-PY",
    "PRE-JIN", "PRE-SEON", "PRE-MI",
    "OM-SIG", "OM-PRE", "LA-1", "LA-2",
    "BONE-1", "BONE-2", "CUSTOM",
  ];
  if (standardCodes.includes(upper)) return upper;

  if (trimmed === "실속세트") return "VAC-PRACTICAL";
  if (trimmed === "봉황세트") return "VAC-BH";
  if (trimmed === "팔영세트") return "VAC-PY";
  if (trimmed === "진" || trimmed.includes("프리미엄 진") || trimmed === "진세트") return "PRE-JIN";
  if (trimmed === "선" || trimmed.includes("프리미엄 선") || trimmed === "선세트") return "PRE-SEON";
  if (trimmed === "미" || trimmed.includes("프리미엄 미") || trimmed === "미세트") return "PRE-MI";
  if (upper.includes("OM-SIG") || (upper.includes("O'MEAT") && upper.includes("SIGNATURE")) || trimmed.includes("시그니처")) return "OM-SIG";
  if (upper.includes("OM-PRE") || (upper.includes("O'MEAT") && upper.includes("PRESTIGE")) || trimmed.includes("프레스티지")) return "OM-PRE";
  if (trimmed.includes("LA갈비 1호") || trimmed.includes("LA 갈비 1호") || upper.includes("LA-1")) return "LA-1";
  if (trimmed.includes("LA갈비 2호") || trimmed.includes("LA 갈비 2호") || upper.includes("LA-2")) return "LA-2";
  if (trimmed.includes("사골×우족") || trimmed.includes("사골우족") || upper.includes("BONE-1")) return "BONE-1";
  if (trimmed.includes("사골×잡뼈×꼬리") || trimmed.includes("잡뼈") || upper.includes("BONE-2")) return "BONE-2";
  if (trimmed === "기타" || trimmed.includes("맞춤")) return "CUSTOM";

  return "CUSTOM";
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function phone(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function postalCode(value: unknown) {
  const digits = text(value).replace(/\D/g, "");
  return digits.length > 0 && digits.length < 5 ? digits.padStart(5, "0") : digits;
}

function fulfillmentType(value: unknown): BulkOrderFulfillmentType | null {
  const normalized = text(value).replace(/\s/g, "");
  if (normalized === "현장수령") return "pickup";
  if (normalized === "택배발송" || normalized === "택배" || normalized === "배달") return "shipping";
  return null;
}

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validPickupTime(value: string) {
  const match = /^(\d{2}):(00|30)$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  return hour >= 8 && hour <= 21 && (hour < 21 || match[2] === "00");
}

function addError(
  errors: BulkOrderValidationError[],
  rowNumber: number | null,
  field: string,
  message: string,
) {
  errors.push({ rowNumber, field, message });
}

function lengthError(value: string, max: number) {
  return value.length > max;
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const digits = String(value).replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function validateAndGroupBulkOrderRows(rows: BulkOrderRowInput[], today: string) {
  const errors: BulkOrderValidationError[] = [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { groups: [] as BulkOrderGroup[], errors: [{ rowNumber: null, field: "파일", message: "입력된 주문 행이 없습니다." }] };
  }
  if (rows.length > MAX_BULK_ORDER_ROWS) {
    addError(errors, null, "파일", `한 번에 최대 ${MAX_BULK_ORDER_ROWS}행까지 업로드할 수 있습니다.`);
  }

  const groups = new Map<string, BulkOrderGroup>();
  const autoGroupKeyMap = new Map<string, string>();
  let autoGroupSeq = 1;

  for (const rawRow of rows.slice(0, MAX_BULK_ORDER_ROWS)) {
    if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
      addError(errors, null, "행", "주문 행 형식을 확인해주세요.");
      continue;
    }
    const row = rawRow as BulkOrderRowInput;
    const rowNumber = Number.isInteger(row.rowNumber) && row.rowNumber > 0 ? row.rowNumber : 0;
    const normalizedFulfillmentType = fulfillmentType(row.fulfillmentMethod);
    const buyerName = text(row.buyerName);
    const buyerPhone = phone(row.buyerPhone);
    const scheduleDate = text(row.scheduleDate);
    const isLegacyFormat = row.postalCode !== undefined && row.detailAddr !== undefined;
    let pickupTime = text(row.pickupTime);

    // Shipping recipient and address resolution
    let recipientName = text(row.recipientName);
    let recipientPhone = phone(row.recipientPhone);
    const normalizedPostalCode = postalCode(row.postalCode);
    let roadAddr = text(row.roadAddr);
    const roadAddrReference = text(row.roadAddrReference);
    const jibunAddr = text(row.jibunAddr);
    let detailAddr = text(row.detailAddr);

    if (normalizedFulfillmentType === "shipping") {
      if (!recipientName && buyerName) recipientName = buyerName;
      if (!recipientPhone && buyerPhone) recipientPhone = buyerPhone;
      if (!detailAddr && roadAddr.includes(",")) {
        const parts = roadAddr.split(",");
        roadAddr = parts[0].trim();
        detailAddr = parts.slice(1).join(",").trim();
      }
    }

    // Auto-generate groupKey if not explicitly provided
    let groupKey = text(row.groupKey);
    if (!groupKey && normalizedFulfillmentType) {
      const sig = [
        scheduleDate,
        normalizedFulfillmentType,
        buyerPhone,
        normalizedFulfillmentType === "pickup" ? (pickupTime || "pickup") : `${recipientPhone}_${roadAddr}`,
      ].join("|");
      if (!autoGroupKeyMap.has(sig)) {
        autoGroupKeyMap.set(sig, `${buyerName || "주문"}-${autoGroupSeq++}`);
      }
      groupKey = autoGroupKeyMap.get(sig)!;
    }

    if (!groupKey) {
      addError(errors, rowNumber, "주문그룹키", "주문그룹키를 입력해주세요.");
    } else if (lengthError(groupKey, 60)) {
      addError(errors, rowNumber, "주문그룹키", "주문그룹키는 60자 이하여야 합니다.");
    } else if ([...groupKey].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
      addError(errors, rowNumber, "주문그룹키", "주문그룹키에 줄바꿈이나 제어문자를 사용할 수 없습니다.");
    }

    if (!normalizedFulfillmentType) addError(errors, rowNumber, "수령방법", "현장수령 또는 택배발송을 선택해주세요.");
    if (!buyerName) addError(errors, rowNumber, "주문자명", "주문자명을 입력해주세요.");
    else if (lengthError(buyerName, 80)) addError(errors, rowNumber, "주문자명", "주문자명은 80자 이하여야 합니다.");
    if (!/^0\d{9,10}$/.test(buyerPhone)) addError(errors, rowNumber, "주문자연락처", "0으로 시작하는 10~11자리 연락처를 입력해주세요.");
    if (!validIsoDate(scheduleDate) || scheduleDate < today) addError(errors, rowNumber, "수령/발송일", "오늘 이후의 날짜를 yyyy-mm-dd 형식으로 입력해주세요.");

    if (normalizedFulfillmentType === "pickup") {
      if (isLegacyFormat || pickupTime) {
        if (!validPickupTime(pickupTime)) addError(errors, rowNumber, "현장수령시간", "08:00부터 21:00까지 30분 단위로 입력해주세요.");
      } else {
        pickupTime = "10:00";
      }
    }

    if (normalizedFulfillmentType === "shipping") {
      if (!recipientName) addError(errors, rowNumber, "수령인명", "택배발송은 수령인명을 입력해주세요.");
      else if (lengthError(recipientName, 80)) addError(errors, rowNumber, "수령인명", "수령인명은 80자 이하여야 합니다.");
      if (!/^0\d{9,10}$/.test(recipientPhone)) addError(errors, rowNumber, "수령인연락처", "택배발송은 0으로 시작하는 10~11자리 수령인 연락처가 필요합니다.");
      if (isLegacyFormat) {
        if (!/^\d{5}$/.test(normalizedPostalCode)) addError(errors, rowNumber, "우편번호", "택배발송 우편번호는 5자리 숫자여야 합니다.");
        if (roadAddr.length < 5) addError(errors, rowNumber, "도로명주소", "택배발송 도로명주소를 5자 이상 입력해주세요.");
        else if (lengthError(roadAddr, 300)) addError(errors, rowNumber, "도로명주소", "도로명주소는 300자 이하여야 합니다.");
        if (!detailAddr) addError(errors, rowNumber, "상세주소", "택배발송 상세주소를 입력해주세요.");
        else if (lengthError(detailAddr, 200)) addError(errors, rowNumber, "상세주소", "상세주소는 200자 이하여야 합니다.");
      } else {
        if (roadAddr.length < 5) addError(errors, rowNumber, "도로명주소", "택배발송 주소를 5자 이상 입력해주세요.");
        else if (lengthError(roadAddr, 300)) addError(errors, rowNumber, "도로명주소", "주소는 300자 이하여야 합니다.");
        if (normalizedPostalCode && !/^\d{5}$/.test(normalizedPostalCode)) addError(errors, rowNumber, "우편번호", "우편번호는 5자리 숫자여야 합니다.");
      }
      if (pickupTime) addError(errors, rowNumber, "현장수령시간", "택배발송 행의 현장수령시간은 비워주세요.");
    }

    const rawProductCode = text(row.productCode);
    const rawProductName = text(row.productName);
    const productCode = (rawProductCode || resolveProductCode(rawProductName)).toUpperCase();
    const isCustom = productCode === "CUSTOM";
    const quantity = typeof row.quantity === "number" ? row.quantity : Number(text(row.quantity));
    const note = text(row.note);

    if (!productCode) {
      addError(errors, rowNumber, "상품코드", "상품코드를 입력해주세요.");
    } else if (lengthError(productCode, 80)) {
      addError(errors, rowNumber, "상품코드", "상품코드는 80자 이하여야 합니다.");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      addError(errors, rowNumber, "수량", "수량은 1~999 사이의 정수여야 합니다.");
    }

    if (lengthError(roadAddrReference, 200)) addError(errors, rowNumber, "참고주소", "참고주소는 200자 이하여야 합니다.");
    if (lengthError(jibunAddr, 300)) addError(errors, rowNumber, "지번주소", "지번주소는 300자 이하여야 합니다.");
    if (lengthError(note, 500)) addError(errors, rowNumber, "주문메모", "주문메모는 500자 이하여야 합니다.");

    // Payment status & Price resolution
    const rawPayment = text(row.paymentStatus);
    const isPaid = rawPayment.includes("완료") || rawPayment === "paid";
    const paymentStatus: "paid" | "unpaid" = isPaid ? "paid" : "unpaid";

    let unitPrice = parseNumber(row.unitPrice);
    if (unitPrice === 0 && !isCustom && STANDARD_CATALOG_PRICES[productCode]) {
      unitPrice = STANDARD_CATALOG_PRICES[productCode];
    }
    let lineTotal = parseNumber(row.totalAmount);
    if (lineTotal === 0 && unitPrice > 0 && quantity > 0) {
      lineTotal = unitPrice * quantity;
    }

    const displayName = isCustom ? (rawProductName || note || "맞춤주문") : (rawProductName || productCode);

    if (!groupKey || !normalizedFulfillmentType) continue;
    const shipping = normalizedFulfillmentType === "shipping";
    const deliveryMethod = shipping ? "delivery" : "onsite_reservation";

    const comparable = {
      fulfillmentType: normalizedFulfillmentType,
      buyerName,
      buyerPhone,
      recipientName: shipping ? recipientName : "",
      recipientPhone: shipping ? recipientPhone : "",
      postalCode: shipping ? normalizedPostalCode : "",
      roadAddr: shipping ? roadAddr : "",
      roadAddrReference: shipping ? roadAddrReference : "",
      jibunAddr: shipping ? jibunAddr : "",
      detailAddr: shipping ? detailAddr : "",
      scheduleDate,
      pickupTime: normalizedFulfillmentType === "pickup" ? pickupTime : "",
      note,
    };

    const existing = groups.get(groupKey);
    if (!existing) {
      groups.set(groupKey, {
        groupKey,
        fulfillmentType: normalizedFulfillmentType,
        deliveryMethod,
        buyerName,
        buyerPhone,
        recipientName: shipping ? recipientName : "",
        recipientPhone: shipping ? recipientPhone : "",
        postalCode: shipping ? normalizedPostalCode : "",
        roadAddr: shipping ? roadAddr : "",
        roadAddrReference: shipping ? roadAddrReference : "",
        jibunAddr: shipping ? jibunAddr : "",
        detailAddr: shipping ? detailAddr : "",
        scheduleDate,
        pickupTime: normalizedFulfillmentType === "pickup" ? pickupTime : "",
        note,
        paymentStatus,
        totalAmount: lineTotal,
        rowNumbers: [rowNumber],
        items: Number.isInteger(quantity) && quantity > 0 && productCode
          ? [{ productCode, productName: displayName, unitPrice, lineTotal, isCustom, quantity, rowNumbers: [rowNumber] }]
          : [],
      });
      continue;
    }

    const conflictFields: Array<[keyof typeof comparable, string]> = [
      ["fulfillmentType", "수령방법"],
      ["buyerName", "주문자명"],
      ["buyerPhone", "주문자연락처"],
      ["recipientName", "수령인명"],
      ["recipientPhone", "수령인연락처"],
      ["postalCode", "우편번호"],
      ["roadAddr", "도로명주소"],
      ["roadAddrReference", "참고주소"],
      ["jibunAddr", "지번주소"],
      ["detailAddr", "상세주소"],
      ["scheduleDate", "수령/발송일"],
      ["pickupTime", "현장수령시간"],
      ["note", "주문메모"],
    ];
    for (const [key, label] of conflictFields) {
      if (existing[key] !== comparable[key]) {
        addError(errors, rowNumber, label, `같은 주문그룹키의 ${label} 값은 모두 같아야 합니다.`);
      }
    }
    existing.rowNumbers.push(rowNumber);
    if (Number.isInteger(quantity) && quantity > 0 && productCode) {
      const item = existing.items.find((value) => value.productCode === productCode && (!isCustom || value.productName === displayName));
      if (item) {
        item.quantity += quantity;
        if (lineTotal > 0) item.lineTotal = (item.lineTotal ?? 0) + lineTotal;
        item.rowNumbers.push(rowNumber);
      } else {
        existing.items.push({ productCode, productName: displayName, unitPrice, lineTotal, isCustom, quantity, rowNumbers: [rowNumber] });
      }
      existing.totalAmount += lineTotal;
    }
  }

  if (groups.size > MAX_BULK_ORDER_GROUPS) {
    addError(errors, null, "파일", `한 번에 최대 ${MAX_BULK_ORDER_GROUPS}건의 주문까지 업로드할 수 있습니다.`);
  }

  return { groups: [...groups.values()], errors };
}

export function todayInSeoul(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

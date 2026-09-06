export const BULK_ORDER_HEADERS = [
  "주문그룹키*",
  "주문자명*",
  "주문자연락처*",
  "수령인명*",
  "수령인연락처*",
  "우편번호*",
  "도로명주소*",
  "참고주소",
  "지번주소",
  "상세주소*",
  "발송일*",
  "상품코드*",
  "수량*",
  "주문메모",
] as const;

export const MAX_BULK_ORDER_ROWS = 200;
export const MAX_BULK_ORDER_GROUPS = 100;

export type BulkOrderRowInput = {
  rowNumber: number;
  groupKey: unknown;
  buyerName: unknown;
  buyerPhone: unknown;
  recipientName: unknown;
  recipientPhone: unknown;
  postalCode: unknown;
  roadAddr: unknown;
  roadAddrReference: unknown;
  jibunAddr: unknown;
  detailAddr: unknown;
  shipDate: unknown;
  productCode: unknown;
  quantity: unknown;
  note: unknown;
};

export type BulkOrderItem = {
  productCode: string;
  quantity: number;
  rowNumbers: number[];
};

export type BulkOrderGroup = {
  groupKey: string;
  buyerName: string;
  buyerPhone: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  roadAddr: string;
  roadAddrReference: string;
  jibunAddr: string;
  detailAddr: string;
  shipDate: string;
  note: string;
  rowNumbers: number[];
  items: BulkOrderItem[];
};

export type BulkOrderValidationError = {
  rowNumber: number | null;
  field: string;
  message: string;
};

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

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
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

export function validateAndGroupBulkOrderRows(rows: BulkOrderRowInput[], today: string) {
  const errors: BulkOrderValidationError[] = [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { groups: [] as BulkOrderGroup[], errors: [{ rowNumber: null, field: "파일", message: "입력된 주문 행이 없습니다." }] };
  }
  if (rows.length > MAX_BULK_ORDER_ROWS) {
    addError(errors, null, "파일", `한 번에 최대 ${MAX_BULK_ORDER_ROWS}행까지 업로드할 수 있습니다.`);
  }

  const groups = new Map<string, BulkOrderGroup>();
  for (const rawRow of rows.slice(0, MAX_BULK_ORDER_ROWS)) {
    if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
      addError(errors, null, "행", "주문 행 형식을 확인해주세요.");
      continue;
    }
    const row = rawRow as BulkOrderRowInput;
    const rowNumber = Number.isInteger(row.rowNumber) && row.rowNumber > 0 ? row.rowNumber : 0;
    const groupKey = text(row.groupKey);
    const buyerName = text(row.buyerName);
    const buyerPhone = phone(row.buyerPhone);
    const recipientName = text(row.recipientName);
    const recipientPhone = phone(row.recipientPhone);
    const normalizedPostalCode = postalCode(row.postalCode);
    const roadAddr = text(row.roadAddr);
    const roadAddrReference = text(row.roadAddrReference);
    const jibunAddr = text(row.jibunAddr);
    const detailAddr = text(row.detailAddr);
    const shipDate = text(row.shipDate);
    const productCode = text(row.productCode).toUpperCase();
    const quantity = typeof row.quantity === "number" ? row.quantity : Number(text(row.quantity));
    const note = text(row.note);

    if (!groupKey) addError(errors, rowNumber, "주문그룹키", "주문그룹키를 입력해주세요.");
    else if (lengthError(groupKey, 60)) addError(errors, rowNumber, "주문그룹키", "주문그룹키는 60자 이하여야 합니다.");
    else if ([...groupKey].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) addError(errors, rowNumber, "주문그룹키", "주문그룹키에 줄바꿈이나 제어문자를 사용할 수 없습니다.");
    if (!buyerName) addError(errors, rowNumber, "주문자명", "주문자명을 입력해주세요.");
    else if (lengthError(buyerName, 80)) addError(errors, rowNumber, "주문자명", "주문자명은 80자 이하여야 합니다.");
    if (!/^0\d{9,10}$/.test(buyerPhone)) addError(errors, rowNumber, "주문자연락처", "0으로 시작하는 10~11자리 연락처를 입력해주세요.");
    if (!recipientName) addError(errors, rowNumber, "수령인명", "수령인명을 입력해주세요.");
    else if (lengthError(recipientName, 80)) addError(errors, rowNumber, "수령인명", "수령인명은 80자 이하여야 합니다.");
    if (!/^0\d{9,10}$/.test(recipientPhone)) addError(errors, rowNumber, "수령인연락처", "0으로 시작하는 10~11자리 연락처를 입력해주세요.");
    if (!/^\d{5}$/.test(normalizedPostalCode)) addError(errors, rowNumber, "우편번호", "우편번호는 5자리 숫자여야 합니다.");
    if (roadAddr.length < 5) addError(errors, rowNumber, "도로명주소", "도로명주소를 5자 이상 입력해주세요.");
    else if (lengthError(roadAddr, 300)) addError(errors, rowNumber, "도로명주소", "도로명주소는 300자 이하여야 합니다.");
    if (!detailAddr) addError(errors, rowNumber, "상세주소", "상세주소를 입력해주세요.");
    else if (lengthError(detailAddr, 200)) addError(errors, rowNumber, "상세주소", "상세주소는 200자 이하여야 합니다.");
    if (!validIsoDate(shipDate) || shipDate < today) addError(errors, rowNumber, "발송일", "오늘 이후의 발송일을 yyyy-mm-dd 형식으로 입력해주세요.");
    if (!productCode) addError(errors, rowNumber, "상품코드", "상품코드를 입력해주세요.");
    else if (lengthError(productCode, 80)) addError(errors, rowNumber, "상품코드", "상품코드는 80자 이하여야 합니다.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) addError(errors, rowNumber, "수량", "수량은 1~999 사이의 정수여야 합니다.");
    if (lengthError(roadAddrReference, 200)) addError(errors, rowNumber, "참고주소", "참고주소는 200자 이하여야 합니다.");
    if (lengthError(jibunAddr, 300)) addError(errors, rowNumber, "지번주소", "지번주소는 300자 이하여야 합니다.");
    if (lengthError(note, 500)) addError(errors, rowNumber, "주문메모", "주문메모는 500자 이하여야 합니다.");

    if (!groupKey) continue;
    const comparable = {
      buyerName,
      buyerPhone,
      recipientName,
      recipientPhone,
      postalCode: normalizedPostalCode,
      roadAddr,
      roadAddrReference,
      jibunAddr,
      detailAddr,
      shipDate,
      note,
    };
    const existing = groups.get(groupKey);
    if (!existing) {
      groups.set(groupKey, {
        groupKey,
        ...comparable,
        rowNumbers: [rowNumber],
        items: Number.isInteger(quantity) && quantity > 0 && productCode
          ? [{ productCode, quantity, rowNumbers: [rowNumber] }]
          : [],
      });
      continue;
    }

    const conflictFields: Array<[keyof typeof comparable, string]> = [
      ["buyerName", "주문자명"],
      ["buyerPhone", "주문자연락처"],
      ["recipientName", "수령인명"],
      ["recipientPhone", "수령인연락처"],
      ["postalCode", "우편번호"],
      ["roadAddr", "도로명주소"],
      ["roadAddrReference", "참고주소"],
      ["jibunAddr", "지번주소"],
      ["detailAddr", "상세주소"],
      ["shipDate", "발송일"],
      ["note", "주문메모"],
    ];
    for (const [key, label] of conflictFields) {
      if (existing[key] !== comparable[key]) {
        addError(errors, rowNumber, label, `같은 주문그룹키의 ${label} 값은 모두 같아야 합니다.`);
      }
    }
    existing.rowNumbers.push(rowNumber);
    if (Number.isInteger(quantity) && quantity > 0 && productCode) {
      const item = existing.items.find((value) => value.productCode === productCode);
      if (item) {
        item.quantity += quantity;
        item.rowNumbers.push(rowNumber);
      } else {
        existing.items.push({ productCode, quantity, rowNumbers: [rowNumber] });
      }
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

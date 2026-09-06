export type InputFormat = "number" | "phone";

export function rawInputValue(value: string) {
  return value.replace(/\D/g, "");
}

export function formatNumberInput(value: string) {
  const digits = rawInputValue(value);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatKoreanPhoneInput(value: string) {
  const digits = rawInputValue(value);
  if (!digits) return "";

  const areaLength = digits.startsWith("02") ? 2 : 3;
  const area = digits.slice(0, areaLength);
  const rest = digits.slice(areaLength);
  if (!rest) return area;

  const subscriberLength = digits.length === areaLength + 7 ? 3 : 4;
  if (rest.length <= subscriberLength) return `${area}-${rest}`;

  return `${area}-${rest.slice(0, subscriberLength)}-${rest.slice(subscriberLength)}`;
}

export function formatInputValue(format: InputFormat, value: string) {
  return format === "number" ? formatNumberInput(value) : formatKoreanPhoneInput(value);
}

export function caretPositionForRawLength(formattedValue: string, rawLength: number) {
  if (rawLength <= 0) return 0;

  let digits = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    if (/\d/.test(formattedValue[index])) digits += 1;
    if (digits === rawLength) return index + 1;
  }
  return formattedValue.length;
}

export function parseIntegerInput(value: string) {
  const digits = rawInputValue(value);
  if (!digits) return null;

  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const KOREAN_DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"] as const;
const KOREAN_SMALL_UNITS = ["천", "백", "십", ""] as const;
const KOREAN_LARGE_UNITS = ["", "만", "억", "조"] as const;

function koreanNumberGroup(value: number) {
  return String(value)
    .padStart(4, "0")
    .split("")
    .map((digit, index) => {
      const numericDigit = Number(digit);
      if (!numericDigit) return "";

      const unit = KOREAN_SMALL_UNITS[index];
      const digitText = numericDigit === 1 && unit ? "" : KOREAN_DIGITS[numericDigit];
      return `${digitText}${unit}`;
    })
    .join("");
}

export function koreanWonText(value: string | number) {
  const amount = typeof value === "number" ? value : parseIntegerInput(value);
  if (amount === null || !Number.isSafeInteger(amount) || amount < 0) return "";
  if (amount === 0) return "영 원";

  const groups: string[] = [];
  let remaining = amount;
  let unitIndex = 0;

  while (remaining > 0) {
    const group = remaining % 10_000;
    if (group) groups.unshift(`${koreanNumberGroup(group)}${KOREAN_LARGE_UNITS[unitIndex]}`);
    remaining = Math.floor(remaining / 10_000);
    unitIndex += 1;
  }

  return `${groups.join(" ")} 원`;
}

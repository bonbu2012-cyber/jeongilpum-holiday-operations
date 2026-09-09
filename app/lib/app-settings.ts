export const DEFAULT_KIOSK_HEADLINE = "소중한 분께 전할 선물을 선택하세요";

export function parseStoredSetting(afterData: string | null | undefined, fallback: string) {
  if (!afterData) return fallback;
  try {
    const parsed = JSON.parse(afterData) as { value?: unknown };
    return typeof parsed.value === "string" && parsed.value.trim() ? parsed.value.trim() : fallback;
  } catch {
    return fallback;
  }
}

const SEOUL_TIME_ZONE = "Asia/Seoul";

function dateInSeoul(nowMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isPastPickupTime(pickupDate: string, pickupTime: string, nowMs = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || !/^\d{2}:\d{2}$/.test(pickupTime)) {
    return false;
  }
  if (pickupDate !== dateInSeoul(nowMs)) return false;

  const pickupAt = Date.parse(`${pickupDate}T${pickupTime}:00+09:00`);
  return Number.isFinite(pickupAt) && pickupAt <= nowMs;
}

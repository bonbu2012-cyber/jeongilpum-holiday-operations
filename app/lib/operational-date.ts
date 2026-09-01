const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isValidOperationalDate(value: string) {
  if (!isoDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function operationalDateFromSearch(search: string) {
  const value = new URLSearchParams(search).get("date")?.trim() ?? "";
  return isValidOperationalDate(value) ? value : null;
}

export function addOperationalDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}


export type CustomerPaymentState = "credit" | "partial" | "paid" | "advance";

export function normalizeCustomerName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeCustomerPhone(value: string) {
  return value.replace(/\D/g, "");
}

export function customerPaymentState(totalOrdered: number, netReceived: number): CustomerPaymentState {
  if (netReceived > totalOrdered) return "advance";
  if (netReceived === totalOrdered) return "paid";
  if (netReceived > 0) return "partial";
  return "credit";
}

export function customerBalances(totalOrdered: number, netReceived: number) {
  return {
    receivable: Math.max(0, totalOrdered - netReceived),
    advance: Math.max(0, netReceived - totalOrdered),
    state: customerPaymentState(totalOrdered, netReceived),
  };
}

export async function primaryCustomerAccountId(normalizedName: string, normalizedPhone: string) {
  const bytes = new TextEncoder().encode(`${normalizedName}\n${normalizedPhone}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const suffix = Array.from(digest.slice(0, 16), (value) => value.toString(16).padStart(2, "0")).join("");
  return `customer-${suffix}`;
}

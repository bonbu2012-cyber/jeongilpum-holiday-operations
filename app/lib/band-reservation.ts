export const BAND_POLICY_VERSION = "2026-10-mvp-1";

export const PICKUP_WINDOWS = [
  "10:00~12:00",
  "12:00~14:00",
  "14:00~16:00",
  "16:00~18:00",
  "18:00 이후",
  "아직 모름",
] as const;

export type PickupWindow = (typeof PICKUP_WINDOWS)[number];

export type BandSaleRow = {
  id: string;
  product_id: string;
  title: string;
  subtitle: string | null;
  price: number;
  production_limit: number;
  reserved_qty: number;
  deposit_per_unit: number;
  reservation_start_at: string;
  reservation_end_at: string;
  production_lock_at: string;
  pickup_date: string;
  pickup_start: string;
  pickup_end: string;
  pickup_location: string;
  status: string;
  active: boolean;
};

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function isValidPhone(value: string) {
  const phone = normalizePhone(value);
  return /^01\d{8,9}$/.test(phone);
}

export function saleState(sale: BandSaleRow, now = new Date()) {
  const current = now.getTime();
  const start = new Date(sale.reservation_start_at).getTime();
  const end = new Date(sale.reservation_end_at).getTime();

  if (!sale.active || sale.status === "closed" || sale.status === "completed") return "closed" as const;
  if (current < start) return "upcoming" as const;
  if (current >= end) return "closed" as const;
  if (sale.reserved_qty >= sale.production_limit) return "sold_out" as const;
  return "open" as const;
}

export function publicSale(sale: BandSaleRow) {
  const remaining = Math.max(0, sale.production_limit - sale.reserved_qty);
  return {
    id: sale.id,
    productId: sale.product_id,
    title: sale.title,
    subtitle: sale.subtitle ?? "",
    price: sale.price,
    productionLimit: sale.production_limit,
    reservedQty: sale.reserved_qty,
    remainingQty: remaining,
    depositPerUnit: sale.deposit_per_unit,
    reservationStartAt: sale.reservation_start_at,
    reservationEndAt: sale.reservation_end_at,
    productionLockAt: sale.production_lock_at,
    pickupDate: sale.pickup_date,
    pickupStart: sale.pickup_start,
    pickupEnd: sale.pickup_end,
    pickupLocation: sale.pickup_location,
    state: saleState(sale),
  };
}

export function reservationNo() {
  const now = new Date();
  const date = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `BAND-${date}-${suffix}`;
}

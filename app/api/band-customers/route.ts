import { getDb } from "../../../db";
import { requireOperatorApi } from "../../lib/operator-session";

type ReservationRow = {
  customer_name: string;
  customer_phone: string;
  quantity: number;
  total_amount: number;
  status: string;
  created_at: string;
};

const DB = getDb();

function labelFor(pickups: number, noShows: number) {
  if (noShows >= 2) return "노쇼주의";
  if (pickups >= 5) return "단골";
  if (pickups >= 2) return "재구매";
  return "신규";
}

export async function GET() {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  const result = await DB.prepare(`
    SELECT customer_name,customer_phone,quantity,total_amount,status,created_at
    FROM band_reservations
    ORDER BY created_at DESC
    LIMIT 5000
  `).all<ReservationRow>();

  const byPhone = new Map<string, {
    phone: string;
    name: string;
    reservationCount: number;
    pickupCount: number;
    cancelCount: number;
    noShowCount: number;
    purchaseQty: number;
    purchaseAmount: number;
    firstReservationAt: string;
    lastReservationAt: string;
  }>();

  for (const row of result.results) {
    const current = byPhone.get(row.customer_phone) ?? {
      phone: row.customer_phone,
      name: row.customer_name,
      reservationCount: 0,
      pickupCount: 0,
      cancelCount: 0,
      noShowCount: 0,
      purchaseQty: 0,
      purchaseAmount: 0,
      firstReservationAt: row.created_at,
      lastReservationAt: row.created_at,
    };

    current.reservationCount += 1;
    if (row.created_at >= current.lastReservationAt) {
      current.lastReservationAt = row.created_at;
      current.name = row.customer_name || current.name;
    }
    if (row.created_at < current.firstReservationAt) current.firstReservationAt = row.created_at;

    if (row.status === "picked_up") {
      current.pickupCount += 1;
      current.purchaseQty += row.quantity;
      current.purchaseAmount += row.total_amount;
    } else if (row.status === "cancelled") {
      current.cancelCount += 1;
    } else if (row.status === "no_show") {
      current.noShowCount += 1;
    }

    byPhone.set(row.customer_phone, current);
  }

  const customers = [...byPhone.values()]
    .map((customer) => ({
      ...customer,
      pickupRate: customer.reservationCount
        ? Math.round((customer.pickupCount / customer.reservationCount) * 1000) / 10
        : 0,
      label: labelFor(customer.pickupCount, customer.noShowCount),
    }))
    .sort((a, b) => b.purchaseAmount - a.purchaseAmount || b.pickupCount - a.pickupCount);

  return Response.json({ customers });
}

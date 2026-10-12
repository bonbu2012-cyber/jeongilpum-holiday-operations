import { getDb } from "../../../../db";
import { requireOperatorApi } from "../../../lib/operator-session";

type Payload = { status?: string };

type ReservationRow = {
  id: string;
  sale_id: string;
  quantity: number;
  status: string;
  payment_status: string;
  payment_provider: string;
};

type SaleRow = {
  id: string;
  production_lock_at: string;
};

const DB = getDb();

async function releaseCapacity(saleId: string, quantity: number, now: string) {
  await DB.prepare(`
    UPDATE band_sales
    SET reserved_qty=CASE WHEN reserved_qty-? < 0 THEN 0 ELSE reserved_qty-? END,
        updated_at=?
    WHERE id=?
  `).bind(quantity, quantity, now, saleId).run();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  const { id } = await params;
  const payload = await request.json().catch(() => ({})) as Payload;
  const nextStatus = typeof payload.status === "string" ? payload.status.trim() : "";
  if (!["picked_up", "no_show", "cancelled"].includes(nextStatus)) {
    return Response.json({ error: "변경할 예약상태를 확인해주세요." }, { status: 400 });
  }

  const current = await DB.prepare(`
    SELECT id,sale_id,quantity,status,payment_status,payment_provider
    FROM band_reservations
    WHERE id=?
    LIMIT 1
  `).bind(id).first<ReservationRow>();

  if (!current) return Response.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  if (["picked_up", "no_show", "cancelled"].includes(current.status)) {
    return Response.json({ error: "이미 처리된 예약입니다." }, { status: 409 });
  }

  const sale = await DB.prepare(`
    SELECT id,production_lock_at
    FROM band_sales
    WHERE id=?
    LIMIT 1
  `).bind(current.sale_id).first<SaleRow>();
  if (!sale) return Response.json({ error: "판매회차를 찾을 수 없습니다." }, { status: 404 });

  const now = new Date();
  const nowIso = now.toISOString();
  const beforeProductionLock = now.getTime() < new Date(sale.production_lock_at).getTime();

  let paymentStatus = current.payment_status;
  let eventType = nextStatus;

  if (nextStatus === "picked_up") {
    await DB.prepare(`
      UPDATE band_reservations
      SET status='picked_up',picked_up_at=?,updated_at=?
      WHERE id=? AND status='confirmed'
    `).bind(nowIso, nowIso, id).run();
  } else if (nextStatus === "no_show") {
    if (current.payment_provider === "test") paymentStatus = "forfeited";
    await DB.prepare(`
      UPDATE band_reservations
      SET status='no_show',no_show_at=?,payment_status=?,updated_at=?
      WHERE id=? AND status='confirmed'
    `).bind(nowIso, paymentStatus, nowIso, id).run();
  } else if (beforeProductionLock) {
    if (current.payment_provider === "test") paymentStatus = "test_refunded";
    await DB.prepare(`
      UPDATE band_reservations
      SET status='cancelled',cancelled_at=?,payment_status=?,updated_at=?
      WHERE id=? AND status='confirmed'
    `).bind(nowIso, paymentStatus, nowIso, id).run();
    await releaseCapacity(current.sale_id, current.quantity, nowIso);
    eventType = "cancelled_refund_eligible";
  } else {
    if (current.payment_provider === "test") paymentStatus = "forfeited";
    await DB.prepare(`
      UPDATE band_reservations
      SET status='cancelled',cancelled_at=?,payment_status=?,updated_at=?
      WHERE id=? AND status='confirmed'
    `).bind(nowIso, paymentStatus, nowIso, id).run();
    eventType = "cancelled_after_production_lock";
  }

  await DB.prepare(`
    INSERT INTO band_reservation_events(
      id,reservation_id,event_type,payload_json,created_at
    ) VALUES(?,?,?,?,?)
  `).bind(
    crypto.randomUUID(),
    id,
    eventType,
    JSON.stringify({ beforeProductionLock }),
    nowIso,
  ).run();

  const updated = await DB.prepare("SELECT * FROM band_reservations WHERE id=? LIMIT 1").bind(id).first();
  return Response.json({
    reservation: updated,
    refundEligible: nextStatus === "cancelled" && beforeProductionLock,
  });
}

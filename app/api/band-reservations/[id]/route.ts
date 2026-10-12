import { supabaseAdmin } from "../../../../db";
import { requireOperatorApi } from "../../../lib/operator-session";

type Payload = { status?: string };

async function releaseCapacity(saleId: string, quantity: number) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: current } = await supabaseAdmin
      .from("band_sales")
      .select("reserved_qty")
      .eq("id", saleId)
      .maybeSingle();
    if (!current) return;
    const next = Math.max(0, Number(current.reserved_qty || 0) - quantity);
    const { data: updated } = await supabaseAdmin
      .from("band_sales")
      .update({ reserved_qty: next, updated_at: new Date().toISOString() })
      .eq("id", saleId)
      .eq("reserved_qty", current.reserved_qty)
      .select("id")
      .maybeSingle();
    if (updated) return;
  }
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

  const { data: current, error } = await supabaseAdmin
    .from("band_reservations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!current) return Response.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  if (["picked_up", "no_show", "cancelled"].includes(current.status)) {
    return Response.json({ error: "이미 처리된 예약입니다." }, { status: 409 });
  }

  const { data: sale, error: saleError } = await supabaseAdmin
    .from("band_sales")
    .select("id,production_lock_at")
    .eq("id", current.sale_id)
    .single();
  if (saleError) return Response.json({ error: saleError.message }, { status: 500 });

  const now = new Date();
  const nowIso = now.toISOString();
  const beforeProductionLock = now.getTime() < new Date(sale.production_lock_at).getTime();
  const changes: Record<string, unknown> = { status: nextStatus, updated_at: nowIso };
  let eventType = nextStatus;

  if (nextStatus === "picked_up") {
    changes.picked_up_at = nowIso;
  } else if (nextStatus === "no_show") {
    changes.no_show_at = nowIso;
    changes.payment_status = current.payment_provider === "test" ? "forfeited" : current.payment_status;
  } else {
    changes.cancelled_at = nowIso;
    if (beforeProductionLock) {
      changes.payment_status = current.payment_provider === "test" ? "test_refunded" : current.payment_status;
      await releaseCapacity(current.sale_id, current.quantity);
      eventType = "cancelled_refund_eligible";
    } else {
      changes.payment_status = current.payment_provider === "test" ? "forfeited" : current.payment_status;
      eventType = "cancelled_after_production_lock";
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("band_reservations")
    .update(changes)
    .eq("id", id)
    .select("*")
    .single();
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  await supabaseAdmin.from("band_reservation_events").insert({
    id: crypto.randomUUID(),
    reservation_id: id,
    event_type: eventType,
    payload_json: JSON.stringify({ beforeProductionLock }),
    created_at: nowIso,
  });

  return Response.json({ reservation: updated, refundEligible: nextStatus === "cancelled" && beforeProductionLock });
}

import { supabaseAdmin } from "../../../db";
import {
  BAND_POLICY_VERSION,
  PICKUP_WINDOWS,
  isValidPhone,
  normalizePhone,
  reservationNo,
  saleState,
  type BandSaleRow,
} from "../../lib/band-reservation";
import { requireOperatorApi } from "../../lib/operator-session";

type CreatePayload = {
  saleId?: string;
  customerName?: string;
  customerPhone?: string;
  quantity?: number;
  pickupWindow?: string;
  policyAgreed?: boolean;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function reserveCapacity(saleId: string, quantity: number) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: current, error } = await supabaseAdmin
      .from("band_sales")
      .select("*")
      .eq("id", saleId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!current) throw new Error("판매회차를 찾을 수 없습니다.");

    const sale = current as BandSaleRow;
    if (saleState(sale) !== "open") return { ok: false as const, sale };
    if (sale.reserved_qty + quantity > sale.production_limit) return { ok: false as const, sale };

    const nextReserved = sale.reserved_qty + quantity;
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("band_sales")
      .update({ reserved_qty: nextReserved, updated_at: new Date().toISOString() })
      .eq("id", saleId)
      .eq("reserved_qty", sale.reserved_qty)
      .eq("active", true)
      .select("*")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (updated) return { ok: true as const, sale: updated as BandSaleRow };
  }
  throw new Error("동시에 많은 예약이 접수되었습니다. 다시 시도해주세요.");
}

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

export async function GET(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  const url = new URL(request.url);
  const saleId = clean(url.searchParams.get("saleId"));
  let query = supabaseAdmin
    .from("band_reservations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (saleId) query = query.eq("sale_id", saleId);

  const { data: reservations, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const saleIds = [...new Set((reservations ?? []).map((item) => item.sale_id))];
  const { data: sales } = saleIds.length
    ? await supabaseAdmin.from("band_sales").select("id,title,pickup_date,production_lock_at").in("id", saleIds)
    : { data: [] as Record<string, unknown>[] };
  const saleMap = new Map((sales ?? []).map((sale) => [sale.id, sale]));

  return Response.json({
    reservations: (reservations ?? []).map((item) => ({
      ...item,
      sale: saleMap.get(item.sale_id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as CreatePayload;
  const saleId = clean(payload.saleId);
  const customerName = clean(payload.customerName).slice(0, 30);
  const customerPhone = normalizePhone(clean(payload.customerPhone));
  const quantity = Number(payload.quantity);
  const pickupWindow = clean(payload.pickupWindow);

  if (!saleId || customerName.length < 2) {
    return Response.json({ error: "예약자 이름을 확인해주세요." }, { status: 400 });
  }
  if (!isValidPhone(customerPhone)) {
    return Response.json({ error: "휴대전화번호를 확인해주세요." }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return Response.json({ error: "예약수량은 1~20개로 입력해주세요." }, { status: 400 });
  }
  if (!(PICKUP_WINDOWS as readonly string[]).includes(pickupWindow)) {
    return Response.json({ error: "예상 픽업시간을 선택해주세요." }, { status: 400 });
  }
  if (!payload.policyAgreed) {
    return Response.json({ error: "예약 및 취소·환불 정책에 동의해주세요." }, { status: 400 });
  }

  const paymentMode = process.env.BAND_PAYMENT_MODE || "test";
  if (paymentMode !== "test") {
    return Response.json({ error: "실결제 연동 전입니다. 현재는 테스트 모드에서만 예약할 수 있습니다." }, { status: 503 });
  }

  let held = false;
  try {
    const capacity = await reserveCapacity(saleId, quantity);
    if (!capacity.ok) {
      const remaining = Math.max(0, capacity.sale.production_limit - capacity.sale.reserved_qty);
      return Response.json({ error: remaining ? `현재 최대 ${remaining}개까지 예약할 수 있습니다.` : "이번 회차 예약이 마감되었습니다." }, { status: 409 });
    }
    held = true;

    const sale = capacity.sale;
    const id = crypto.randomUUID();
    const no = reservationNo();
    const now = new Date().toISOString();
    const totalAmount = sale.price * quantity;
    const depositAmount = sale.deposit_per_unit * quantity;

    const { data, error } = await supabaseAdmin
      .from("band_reservations")
      .insert({
        id,
        reservation_no: no,
        sale_id: saleId,
        customer_name: customerName,
        customer_phone: customerPhone,
        quantity,
        unit_price: sale.price,
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        pickup_window: pickupWindow,
        status: "confirmed",
        payment_status: "test_paid",
        payment_provider: "test",
        payment_tid: null,
        policy_version: BAND_POLICY_VERSION,
        policy_agreed_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    await supabaseAdmin.from("band_reservation_events").insert({
      id: crypto.randomUUID(),
      reservation_id: id,
      event_type: "reservation_confirmed",
      payload_json: JSON.stringify({ paymentMode: "test", quantity, depositAmount }),
      created_at: now,
    });

    return Response.json({
      reservation: {
        id: data.id,
        reservationNo: data.reservation_no,
        customerName: data.customer_name,
        quantity: data.quantity,
        totalAmount: data.total_amount,
        depositAmount: data.deposit_amount,
        pickupWindow: data.pickup_window,
        status: data.status,
        paymentStatus: data.payment_status,
        pickupDate: sale.pickup_date,
        pickupStart: sale.pickup_start,
        pickupEnd: sale.pickup_end,
        pickupLocation: sale.pickup_location,
      },
      paymentMode: "test",
    }, { status: 201 });
  } catch (error) {
    if (held) await releaseCapacity(saleId, quantity);
    return Response.json({ error: error instanceof Error ? error.message : "예약을 완료하지 못했습니다." }, { status: 500 });
  }
}

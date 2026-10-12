import { getDb } from "../../../db";
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
  idempotencyKey?: string;
};

type ReservationRow = {
  id: string;
  reservation_no: string;
  sale_id: string;
  customer_name: string;
  customer_phone: string;
  idempotency_key: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  deposit_amount: number;
  pickup_window: string;
  status: string;
  payment_status: string;
  payment_provider: string;
  payment_tid: string | null;
  policy_version: string;
  policy_agreed_at: string;
  created_at: string;
  updated_at: string;
};

type AdminReservationRow = ReservationRow & {
  sale_title: string | null;
  sale_pickup_date: string | null;
  sale_production_lock_at: string | null;
};

const DB = getDb();

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function paymentMode() {
  return process.env.BAND_PAYMENT_MODE || "test";
}

async function existingByIdempotency(idempotencyKey: string) {
  return DB.prepare(`
    SELECT r.*,s.pickup_date,s.pickup_start,s.pickup_end,s.pickup_location
    FROM band_reservations r
    JOIN band_sales s ON s.id=r.sale_id
    WHERE r.idempotency_key=?
    LIMIT 1
  `).bind(idempotencyKey).first<ReservationRow & {
    pickup_date: string;
    pickup_start: string;
    pickup_end: string;
    pickup_location: string;
  }>();
}

function receipt(row: ReservationRow & {
  pickup_date: string;
  pickup_start: string;
  pickup_end: string;
  pickup_location: string;
}) {
  return {
    id: row.id,
    reservationNo: row.reservation_no,
    customerName: row.customer_name,
    quantity: row.quantity,
    totalAmount: row.total_amount,
    depositAmount: row.deposit_amount,
    pickupWindow: row.pickup_window,
    status: row.status,
    paymentStatus: row.payment_status,
    pickupDate: row.pickup_date,
    pickupStart: row.pickup_start,
    pickupEnd: row.pickup_end,
    pickupLocation: row.pickup_location,
  };
}

async function claimCapacity(saleId: string, quantity: number, now: string) {
  const claimed = await DB.prepare(`
    UPDATE band_sales
    SET reserved_qty=reserved_qty+?,updated_at=?
    WHERE id=?
      AND active=1
      AND status='open'
      AND reserved_qty+? <= production_limit
    RETURNING *
  `).bind(quantity, now, saleId, quantity).first<BandSaleRow>();

  return claimed;
}

async function releaseCapacity(saleId: string, quantity: number, now: string) {
  await DB.prepare(`
    UPDATE band_sales
    SET reserved_qty=CASE WHEN reserved_qty-? < 0 THEN 0 ELSE reserved_qty-? END,
        updated_at=?
    WHERE id=?
  `).bind(quantity, quantity, now, saleId).run();
}

export async function GET(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  const url = new URL(request.url);
  const saleId = clean(url.searchParams.get("saleId"));

  const sql = saleId
    ? `
      SELECT r.*,s.title AS sale_title,s.pickup_date AS sale_pickup_date,
        s.production_lock_at AS sale_production_lock_at
      FROM band_reservations r
      LEFT JOIN band_sales s ON s.id=r.sale_id
      WHERE r.sale_id=?
      ORDER BY r.created_at DESC
      LIMIT 300
    `
    : `
      SELECT r.*,s.title AS sale_title,s.pickup_date AS sale_pickup_date,
        s.production_lock_at AS sale_production_lock_at
      FROM band_reservations r
      LEFT JOIN band_sales s ON s.id=r.sale_id
      ORDER BY r.created_at DESC
      LIMIT 300
    `;

  const result = saleId
    ? await DB.prepare(sql).bind(saleId).all<AdminReservationRow>()
    : await DB.prepare(sql).all<AdminReservationRow>();

  return Response.json({
    reservations: result.results.map((item) => ({
      ...item,
      sale: item.sale_title ? {
        id: item.sale_id,
        title: item.sale_title,
        pickup_date: item.sale_pickup_date,
        production_lock_at: item.sale_production_lock_at,
      } : null,
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
  const idempotencyKey = clean(payload.idempotencyKey).slice(0, 80);

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
  if (!/^[A-Za-z0-9_-]{12,80}$/.test(idempotencyKey)) {
    return Response.json({ error: "예약 요청을 다시 시작해주세요." }, { status: 400 });
  }

  const existing = await existingByIdempotency(idempotencyKey);
  if (existing) return Response.json({ reservation: receipt(existing), paymentMode: existing.payment_provider });

  const mode = paymentMode();
  if (mode !== "test") {
    return Response.json({ error: "실결제 연동 전입니다. 현재는 테스트 모드에서만 예약할 수 있습니다." }, { status: 503 });
  }

  const now = new Date().toISOString();
  let capacityClaimed = false;
  try {
    const before = await DB.prepare("SELECT * FROM band_sales WHERE id=? LIMIT 1").bind(saleId).first<BandSaleRow>();
    if (!before) return Response.json({ error: "판매회차를 찾을 수 없습니다." }, { status: 404 });
    if (saleState(before) !== "open") {
      const remaining = Math.max(0, before.production_limit - before.reserved_qty);
      return Response.json({ error: remaining ? "현재 예약 가능한 시간이 아닙니다." : "이번 회차 예약이 마감되었습니다." }, { status: 409 });
    }

    const sale = await claimCapacity(saleId, quantity, now);
    if (!sale) {
      const current = await DB.prepare("SELECT * FROM band_sales WHERE id=? LIMIT 1").bind(saleId).first<BandSaleRow>();
      const remaining = current ? Math.max(0, current.production_limit - current.reserved_qty) : 0;
      return Response.json({
        error: remaining ? `현재 최대 ${remaining}개까지 예약할 수 있습니다.` : "이번 회차 예약이 마감되었습니다.",
      }, { status: 409 });
    }
    capacityClaimed = true;

    const id = crypto.randomUUID();
    const no = reservationNo();
    const totalAmount = sale.price * quantity;
    const depositAmount = sale.deposit_per_unit * quantity;

    await DB.batch([
      DB.prepare(`
        INSERT INTO band_reservations(
          id,reservation_no,sale_id,customer_name,customer_phone,idempotency_key,
          quantity,unit_price,total_amount,deposit_amount,pickup_window,status,payment_status,
          payment_provider,payment_tid,policy_version,policy_agreed_at,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,'confirmed','test_paid','test',NULL,?,?,?,?)
      `).bind(
        id,
        no,
        saleId,
        customerName,
        customerPhone,
        idempotencyKey,
        quantity,
        sale.price,
        totalAmount,
        depositAmount,
        pickupWindow,
        BAND_POLICY_VERSION,
        now,
        now,
        now,
      ),
      DB.prepare(`
        INSERT INTO band_reservation_events(
          id,reservation_id,event_type,payload_json,created_at
        ) VALUES(?,?,'reservation_confirmed',?,?)
      `).bind(
        crypto.randomUUID(),
        id,
        JSON.stringify({ paymentMode: "test", quantity, depositAmount }),
        now,
      ),
    ]);

    const stored = await existingByIdempotency(idempotencyKey);
    if (!stored) throw new Error("예약 저장 결과를 확인하지 못했습니다.");

    return Response.json({
      reservation: receipt(stored),
      paymentMode: "test",
    }, { status: 201 });
  } catch (error) {
    const duplicated = await existingByIdempotency(idempotencyKey);
    if (duplicated) return Response.json({ reservation: receipt(duplicated), paymentMode: duplicated.payment_provider });

    if (capacityClaimed) await releaseCapacity(saleId, quantity, new Date().toISOString());
    return Response.json({ error: error instanceof Error ? error.message : "예약을 완료하지 못했습니다." }, { status: 500 });
  }
}

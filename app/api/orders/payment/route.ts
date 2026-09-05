import { env } from "cloudflare:workers";
import { OPERATOR_ACTOR, requireOperatorApi } from "../../../lib/operator-session";

type PaymentStatus = "unpaid" | "partial" | "paid";

type Payload = {
  orderId?: string;
  paymentStatus?: PaymentStatus;
  paidAmount?: number;
  expectedVersion?: number;
};

type OrderRow = {
  id: string;
  payment_status: PaymentStatus;
  paid_amount: number;
  total_amount: number;
  version: number;
};

const runtimeEnv = env as typeof env & { DB: D1Database };
const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "partial", "paid"];

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

export async function PATCH(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  try {
    const payload = await request.json() as Payload;
    const orderId = clean(payload.orderId);
    const paidAmount = payload.paidAmount;

    if (
      !orderId
      || !payload.paymentStatus
      || !PAYMENT_STATUSES.includes(payload.paymentStatus)
      || typeof paidAmount !== "number"
      || !Number.isInteger(paidAmount)
      || paidAmount < 0
      || !Number.isInteger(payload.expectedVersion)
    ) {
      return Response.json({ error: "결제 상태, 금액, 주문 버전을 확인해주세요." }, { status: 400 });
    }

    const current = await runtimeEnv.DB.prepare(`
      SELECT id,payment_status,paid_amount,total_amount,version
      FROM orders
      WHERE id=?
    `).bind(orderId).first<OrderRow>();
    if (!current) return Response.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    if (current.version !== payload.expectedVersion) {
      return Response.json({
        error: "다른 직원이 먼저 수정했습니다. 최신 내용을 다시 확인해주세요.",
        latestVersion: current.version,
      }, { status: 409 });
    }

    const now = new Date().toISOString();
    const fromValue = JSON.stringify({
      paymentStatus: current.payment_status,
      paidAmount: current.paid_amount,
      totalAmount: current.total_amount,
    });
    const toValue = JSON.stringify({
      paymentStatus: payload.paymentStatus,
      paidAmount,
      totalAmount: current.total_amount,
    });
    const result = await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(`
        UPDATE orders
        SET payment_status=?,paid_amount=?,version=version+1,updated_at=?
        WHERE id=? AND version=?
      `).bind(payload.paymentStatus, paidAmount, now, current.id, current.version),
      runtimeEnv.DB.prepare(`
        INSERT INTO work_item_events(
          id,work_item_id,order_id,event_type,from_value,to_value,actor,created_at
        )
        SELECT lower(hex(randomblob(16))),w.id,w.order_id,'payment_changed',?,?,?,?
        FROM work_items w
        JOIN orders o ON o.id=w.order_id
        WHERE w.order_id=? AND o.version=?
      `).bind(
        fromValue,
        toValue,
        OPERATOR_ACTOR,
        now,
        current.id,
        current.version + 1,
      ),
    ]);

    if (!result[0].meta.changes) {
      return Response.json({
        error: "다른 직원이 먼저 수정했습니다. 최신 내용을 다시 확인해주세요.",
      }, { status: 409 });
    }

    return Response.json({
      ok: true,
      orderId: current.id,
      paymentStatus: payload.paymentStatus,
      paidAmount,
      totalAmount: current.total_amount,
      version: current.version + 1,
    });
  } catch {
    return Response.json({ error: "결제 정보를 저장하지 못했습니다." }, { status: 500 });
  }
}

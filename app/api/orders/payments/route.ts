import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

type Payload = {
  action?: "payment" | "credit";
  orderId?: string;
  method?: "card" | "cash" | "bank_transfer";
  amount?: number;
  paidAt?: string;
  dueDate?: string;
  memo?: string;
  idempotencyKey?: string;
};

const runtimeEnv = env as typeof env & {
  DB: D1Database;
  OPERATOR_USER_IDS?: string;
  OPERATOR_EMAILS?: string;
};

function configured(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}
function isOperator(user: { userId: string; email: string }) {
  return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId)
    || configured(runtimeEnv.OPERATOR_EMAILS)
      .map((value) => value.toLowerCase())
      .includes(user.email.toLowerCase());
}
function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user)) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });

  try {
    const payload = await request.json() as Payload;
    const orderId = clean(payload.orderId);
    const amount = Number(payload.amount);
    const idempotencyKey = clean(payload.idempotencyKey);
    if (!orderId || !Number.isInteger(amount) || amount <= 0 || !idempotencyKey) {
      return Response.json({ error: "주문과 금액 정보를 확인해주세요." }, { status: 400 });
    }
    const order = await runtimeEnv.DB
      .prepare("SELECT id,total_amount FROM orders WHERE id=?")
      .bind(orderId)
      .first<{ id: string; total_amount: number }>();
    if (!order) return Response.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });

    const paidResult = await runtimeEnv.DB
      .prepare(`SELECT COALESCE(SUM(CASE WHEN type='payment' THEN amount WHEN type='refund' THEN -amount ELSE amount END),0) AS paid FROM payments WHERE order_id=?`)
      .bind(orderId)
      .first<{ paid: number }>();
    const balance = Math.max(0, order.total_amount - (paidResult?.paid ?? 0));
    if (amount > balance) {
      return Response.json({ error: "입력 금액이 현재 잔액보다 큽니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    if (payload.action === "payment") {
      if (!["card", "cash", "bank_transfer"].includes(payload.method ?? "")) {
        return Response.json({ error: "결제수단을 선택해주세요." }, { status: 400 });
      }
      const paidAt = clean(payload.paidAt) || now;
      if (Number.isNaN(Date.parse(paidAt))) {
        return Response.json({ error: "결제일시를 확인해주세요." }, { status: 400 });
      }
      const paymentId = crypto.randomUUID();
      await runtimeEnv.DB.batch([
        runtimeEnv.DB
          .prepare(`INSERT INTO payments(id,order_id,type,method,amount,paid_at,recorded_by,memo,idempotency_key,created_at) VALUES(?,?,'payment',?,?,?,?,?,?,?)`)
          .bind(
            paymentId,
            orderId,
            payload.method,
            amount,
            new Date(paidAt).toISOString(),
            user.userId,
            clean(payload.memo),
            idempotencyKey,
            now,
          ),
        runtimeEnv.DB
          .prepare("INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) VALUES(?,?,'payment_recorded',?,?,?)")
          .bind(
            crypto.randomUUID(),
            orderId,
            JSON.stringify({ paymentId, method: payload.method, amount }),
            user.userId,
            now,
          ),
      ]);
      return Response.json({ ok: true, paymentId }, { status: 201 });
    }

    if (payload.action === "credit") {
      const dueDate = clean(payload.dueDate);
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return Response.json({ error: "외상 예정일을 확인해주세요." }, { status: 400 });
      }
      const creditId = crypto.randomUUID();
      await runtimeEnv.DB.batch([
        runtimeEnv.DB
          .prepare(`INSERT INTO order_credit_terms(id,order_id,outstanding_amount,due_date,memo,status,recorded_by,created_at) VALUES(?,?,?,?,?,'open',?,?)`)
          .bind(creditId, orderId, amount, dueDate || null, clean(payload.memo), user.userId, now),
        runtimeEnv.DB
          .prepare("INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) VALUES(?,?,'credit_recorded',?,?,?)")
          .bind(
            crypto.randomUUID(),
            orderId,
            JSON.stringify({ creditId, outstandingAmount: amount, dueDate: dueDate || null }),
            user.userId,
            now,
          ),
      ]);
      return Response.json({ ok: true, creditId }, { status: 201 });
    }

    return Response.json({ error: "처리 종류를 확인해주세요." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "결제정보를 저장하지 못했습니다.";
    if (message.includes("idx_payments_idempotency") || message.includes("UNIQUE")) {
      return Response.json({ ok: true, duplicate: true });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

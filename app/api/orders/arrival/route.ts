import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

type ArrivalPayload = { orderId?: string };
type ArrivalOrder = {
  id: string;
  order_status: string;
  fulfillment_id: string | null;
  fulfillment_type: string | null;
  customer_arrived: number | null;
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
    || configured(runtimeEnv.OPERATOR_EMAILS).map((value) => value.toLowerCase()).includes(user.email.toLowerCase());
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user)) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });

  try {
    const payload = await request.json() as ArrivalPayload;
    if (!payload.orderId) return Response.json({ error: "주문 ID가 필요합니다." }, { status: 400 });
    const current = await runtimeEnv.DB.prepare(
      "SELECT o.id,o.order_status,f.id AS fulfillment_id,f.fulfillment_type,f.customer_arrived FROM orders o LEFT JOIN fulfillments f ON f.order_id=o.id WHERE o.id=?",
    ).bind(payload.orderId).first<ArrivalOrder>();
    if (!current) return Response.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    if (!current.fulfillment_id) return Response.json({ error: "먼저 수령 일정을 지정해주세요." }, { status: 409 });
    if (current.fulfillment_type !== "pickup") return Response.json({ error: "방문수령 주문만 고객 도착을 기록할 수 있습니다." }, { status: 409 });
    if (["cancelled", "fulfilled"].includes(current.order_status)) return Response.json({ error: "완료되거나 취소된 주문에는 고객 도착을 기록할 수 없습니다." }, { status: 409 });
    if (current.customer_arrived) return Response.json({ ok: true, alreadyArrived: true });

    const now = new Date().toISOString();
    const results = await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(
        "INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) SELECT ?,?,'CUSTOMER_ARRIVED',?,?,? WHERE EXISTS(SELECT 1 FROM fulfillments WHERE order_id=? AND fulfillment_type='pickup' AND customer_arrived=0) AND NOT EXISTS(SELECT 1 FROM order_events WHERE order_id=? AND event_type='CUSTOMER_ARRIVED')",
      ).bind(crypto.randomUUID(), payload.orderId, JSON.stringify({ customerArrived: true, actualArrivedAt: now }), user.userId, now, payload.orderId, payload.orderId),
      runtimeEnv.DB.prepare(
        "UPDATE fulfillments SET customer_arrived=1,updated_at=? WHERE order_id=? AND fulfillment_type='pickup' AND customer_arrived=0",
      ).bind(now, payload.orderId),
    ]);
    const changed = Number(results[1].meta.changes ?? 0) > 0;
    return Response.json({ ok: true, alreadyArrived: !changed });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "고객 도착을 기록하지 못했습니다." }, { status: 500 });
  }
}

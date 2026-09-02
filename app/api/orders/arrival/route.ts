import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

type ArrivalPayload = { workItemId?: string; orderId?: string };
type WorkItemRow = {
  id: string;
  order_id: string;
  customer_arrived_at: string | null;
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

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user)) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });

  try {
    const payload = await request.json() as ArrivalPayload;
    const workItemId = payload.workItemId?.trim() ?? "";
    const orderId = payload.orderId?.trim() ?? "";
    if (!workItemId && !orderId) {
      return Response.json({ error: "작업 또는 주문 ID가 필요합니다." }, { status: 400 });
    }
    const current = workItemId
      ? await runtimeEnv.DB.prepare(`
        SELECT w.id,w.order_id,o.customer_arrived_at
        FROM work_items w
        JOIN orders o ON o.id=w.order_id
        WHERE w.id=? AND w.delivery_method='onsite_reservation' AND w.work_status!='cancelled'
      `).bind(workItemId).all<WorkItemRow>()
      : await runtimeEnv.DB.prepare(`
        SELECT w.id,w.order_id,o.customer_arrived_at
        FROM work_items w
        JOIN orders o ON o.id=w.order_id
        WHERE w.order_id=? AND w.delivery_method='onsite_reservation' AND w.work_status!='cancelled'
      `).bind(orderId).all<WorkItemRow>();
    if (!current.results.length) {
      return Response.json({ error: "방문수령 작업을 찾을 수 없습니다." }, { status: 404 });
    }
    if (current.results[0].customer_arrived_at) {
      return Response.json({ ok: true, alreadyArrived: true });
    }

    const now = new Date().toISOString();
    const targetOrderId = current.results[0].order_id;
    await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(`
        UPDATE orders
        SET customer_arrived_at=?,version=version+1,updated_at=?
        WHERE id=? AND customer_arrived_at IS NULL
      `).bind(now, now, targetOrderId),
      ...current.results.map((item) =>
        runtimeEnv.DB.prepare(`
          INSERT INTO work_item_events(
            id,work_item_id,order_id,event_type,from_value,to_value,actor,created_at
          ) VALUES(?,?,?,'customer_arrived',NULL,?,?,?)
        `).bind(
          crypto.randomUUID(),
          item.id,
          item.order_id,
          JSON.stringify({ customerArrivedAt: now }),
          user.userId,
          now,
        )),
    ]);
    return Response.json({ ok: true, alreadyArrived: false });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "고객 도착을 기록하지 못했습니다." },
      { status: 500 },
    );
  }
}

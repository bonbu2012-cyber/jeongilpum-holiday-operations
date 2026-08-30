import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { prepareEnsureOrderPackages } from "../../../lib/package-persistence";
import { canApplyWorkshopAction, workshopActionEventType, workshopActionNextStatus, type WorkshopAction } from "../../../lib/workshop-operations";

type Payload = { orderId?: string; action?: WorkshopAction; expectedVersion?: number };
type Current = { id: string; order_no: string; order_status: "submitted" | "confirmed" | "in_progress" | "ready" | "fulfilled" | "cancelled"; version: number };
const runtimeEnv = env as typeof env & { DB: D1Database; OPERATOR_USER_IDS?: string; OPERATOR_EMAILS?: string };

function configured(value: string | undefined) { return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean); }
function isOperator(user: { userId: string; email: string }) { return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId) || configured(runtimeEnv.OPERATOR_EMAILS).map((value) => value.toLowerCase()).includes(user.email.toLowerCase()); }

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user)) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });
  try {
    const payload = await request.json() as Payload;
    if (!payload.orderId || !payload.action || !["accept", "start", "complete"].includes(payload.action) || !Number.isInteger(payload.expectedVersion)) {
      return Response.json({ error: "작업 상태 정보가 올바르지 않습니다." }, { status: 400 });
    }
    const current = await runtimeEnv.DB.prepare("SELECT id,order_no,order_status,version FROM orders WHERE id=?").bind(payload.orderId).first<Current>();
    if (!current) return Response.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });

    const eventType = workshopActionEventType(payload.action);
    const existingEvent = await runtimeEnv.DB.prepare("SELECT id FROM order_events WHERE order_id=? AND event_type=? LIMIT 1").bind(payload.orderId, eventType).first<{ id: string }>();
    const now = new Date().toISOString();
    if (existingEvent) {
      if (payload.action === "accept") {
        const prepared = await prepareEnsureOrderPackages(runtimeEnv.DB, { orderId: current.id, orderNo: current.order_no, actorId: user.userId, now });
        if (prepared.statements.length) await runtimeEnv.DB.batch(prepared.statements);
      }
      return Response.json({ ok: true, action: payload.action, status: current.order_status, version: current.version, alreadyApplied: true });
    }

    const accepted = payload.action === "accept" ? null : await runtimeEnv.DB.prepare("SELECT created_at FROM order_events WHERE order_id=? AND event_type='WORK_ACCEPTED' LIMIT 1").bind(payload.orderId).first<{ created_at: string }>();
    const workOrder = { status: current.order_status, workAcceptedAt: accepted?.created_at ?? null };
    if (!canApplyWorkshopAction(workOrder, payload.action)) return Response.json({ error: "현재 단계에서 허용되지 않는 작업입니다." }, { status: 409 });
    if (current.version !== payload.expectedVersion) return Response.json({ error: "다른 직원이 먼저 수정했습니다. 최신 내용을 다시 확인해주세요.", latestVersion: current.version }, { status: 409 });

    const nextStatus = workshopActionNextStatus(payload.action);
    const statements: D1PreparedStatement[] = [
      runtimeEnv.DB.prepare("UPDATE orders SET order_status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND order_status=?").bind(nextStatus, now, payload.orderId, payload.expectedVersion, current.order_status),
    ];
    if (payload.action === "accept") {
      const prepared = await prepareEnsureOrderPackages(runtimeEnv.DB, { orderId: current.id, orderNo: current.order_no, actorId: user.userId, now });
      statements.push(...prepared.statements);
    }
    if (payload.action === "start") statements.push(runtimeEnv.DB.prepare("UPDATE packages SET package_status='in_progress',updated_at=? WHERE order_id=? AND package_status='queued'").bind(now, payload.orderId));
    if (payload.action === "complete") statements.push(runtimeEnv.DB.prepare("UPDATE packages SET package_status='completed',updated_at=? WHERE order_id=? AND package_status='in_progress'").bind(now, payload.orderId));
    statements.push(runtimeEnv.DB.prepare("INSERT INTO order_events(id,order_id,event_type,before_data,after_data,actor_id,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND version=? AND order_status=?) AND NOT EXISTS(SELECT 1 FROM order_events WHERE order_id=? AND event_type=?)").bind(crypto.randomUUID(), payload.orderId, eventType, JSON.stringify({ status: current.order_status }), JSON.stringify({ status: nextStatus, action: payload.action }), user.userId, now, payload.orderId, payload.expectedVersion + 1, nextStatus, payload.orderId, eventType));
    const result = await runtimeEnv.DB.batch(statements);
    if (!result[0].meta.changes) {
      const applied = await runtimeEnv.DB.prepare("SELECT id FROM order_events WHERE order_id=? AND event_type=? LIMIT 1").bind(payload.orderId, eventType).first<{ id: string }>();
      if (applied) return Response.json({ ok: true, action: payload.action, status: nextStatus, alreadyApplied: true });
      return Response.json({ error: "작업 상태가 이미 변경되었습니다. 최신 내용을 다시 확인해주세요." }, { status: 409 });
    }
    return Response.json({ ok: true, action: payload.action, status: nextStatus, version: current.version + 1 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "작업 상태를 변경하지 못했습니다." }, { status: 500 });
  }
}
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { arrivalOffsetMinutes } from "../../../../lib/workshop-operations";

type Payload = { targetOrderId?: string; packageId?: string; reason?: "EARLY_CUSTOMER_ARRIVAL" };
type OrderRow = { id: string; order_status: string; version: number; customer_note: string; pickup_at: string | null; customer_arrived: number; fulfillment_note: string; actual_arrived_at: string | null };
type PackageRow = { id: string; order_id: string; product_id: string; package_status: string; source_pickup_at: string | null; source_status: string; source_version: number; source_customer_note: string; source_fulfillment_note: string };
type ReplacementRow = { id: string; package_status: string };
const runtimeEnv = env as typeof env & { DB: D1Database; OPERATOR_USER_IDS?: string; OPERATOR_EMAILS?: string };

function configured(value: string | undefined) { return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean); }
function isOperator(user: { userId: string; email: string }) { return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId) || configured(runtimeEnv.OPERATOR_EMAILS).map((value) => value.toLowerCase()).includes(user.email.toLowerCase()); }

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user)) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });
  try {
    const payload = await request.json() as Payload;
    if (!payload.targetOrderId || !payload.packageId || payload.reason !== "EARLY_CUSTOMER_ARRIVAL") return Response.json({ error: "재배정 정보가 올바르지 않습니다." }, { status: 400 });
    const prior = await runtimeEnv.DB.prepare("SELECT id,after_data FROM order_events WHERE event_type='PACKAGE_REASSIGNED' AND after_data LIKE ? LIMIT 1").bind(`%"packageId":"${payload.packageId}"%`).first<{ id: string; after_data: string }>();
    if (prior) {
      const data = JSON.parse(prior.after_data) as { toOrderId?: string };
      if (data.toOrderId === payload.targetOrderId) return Response.json({ ok: true, alreadyApplied: true });
      return Response.json({ error: "이미 다른 주문으로 재배정된 package입니다." }, { status: 409 });
    }
    const target = await runtimeEnv.DB.prepare("SELECT o.id,o.order_status,o.version,o.customer_note,f.pickup_at,f.customer_arrived,f.note AS fulfillment_note,(SELECT created_at FROM order_events WHERE order_id=o.id AND event_type='CUSTOMER_ARRIVED' ORDER BY created_at DESC LIMIT 1) AS actual_arrived_at FROM orders o JOIN fulfillments f ON f.order_id=o.id WHERE o.id=? AND f.fulfillment_type='pickup'").bind(payload.targetOrderId).first<OrderRow>();
    const value = await runtimeEnv.DB.prepare("SELECT p.id,p.order_id,p.product_id,p.package_status,f.pickup_at AS source_pickup_at,o.order_status AS source_status,o.version AS source_version,o.customer_note AS source_customer_note,f.note AS source_fulfillment_note FROM packages p JOIN orders o ON o.id=p.order_id JOIN fulfillments f ON f.order_id=o.id WHERE p.id=?").bind(payload.packageId).first<PackageRow>();
    if (!target || !value) return Response.json({ error: "주문 또는 package를 찾을 수 없습니다." }, { status: 404 });
    if (target.id === value.order_id || target.order_status === "ready" || value.package_status !== "completed" || !target.pickup_at || !value.source_pickup_at || value.source_pickup_at.slice(0, 10) !== target.pickup_at.slice(0, 10) || value.source_pickup_at <= target.pickup_at || ["fulfilled", "cancelled"].includes(value.source_status)) return Response.json({ error: "대체 가능한 완성품 조건을 충족하지 않습니다." }, { status: 409 });
    if (!target.customer_arrived || (arrivalOffsetMinutes(target.pickup_at, target.actual_arrived_at) ?? 0) <= 0) return Response.json({ error: "조기도착한 미완료 주문에만 사용할 수 있습니다." }, { status: 409 });
    if (target.customer_note.trim() || target.fulfillment_note.trim() || value.source_customer_note.trim() || value.source_fulfillment_note.trim()) return Response.json({ error: "특수 요청이 있는 주문은 자동 대체할 수 없습니다." }, { status: 409 });
    const compatibility = await runtimeEnv.DB.prepare("SELECT (SELECT COUNT(*) FROM order_items i WHERE i.order_id=? AND i.product_id=?) AS target_items,(SELECT COUNT(*) FROM order_items i WHERE i.order_id=? AND i.product_id=?) AS source_items,(SELECT COUNT(*) FROM order_item_customizations c JOIN order_items i ON i.id=c.order_item_id WHERE i.order_id IN (?,?) AND i.product_id=?) AS customizations").bind(target.id, value.product_id, value.order_id, value.product_id, target.id, value.order_id, value.product_id).first<{ target_items: number; source_items: number; customizations: number }>();
    if (!compatibility?.target_items || !compatibility.source_items || compatibility.customizations > 0) return Response.json({ error: "상품 구성 또는 맞춤조건이 달라 자동 대체할 수 없습니다." }, { status: 409 });
    const replacement = await runtimeEnv.DB.prepare("SELECT id,package_status FROM packages WHERE order_id=? AND product_id=? AND package_status IN ('queued','in_progress') ORDER BY CASE package_status WHEN 'in_progress' THEN 0 ELSE 1 END,created_at LIMIT 1").bind(target.id, value.product_id).first<ReplacementRow>();
    if (!replacement) return Response.json({ error: "원래 주문으로 넘길 동일상품 미완성 package가 없어 자동 대체할 수 없습니다." }, { status: 409 });

    const counts = await runtimeEnv.DB.prepare("SELECT (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=?) AS target_needed,(SELECT COUNT(*) FROM packages WHERE order_id=? AND package_status='completed') AS target_completed,(SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=?) AS source_needed,(SELECT COUNT(*) FROM packages WHERE order_id=? AND package_status='completed') AS source_completed").bind(target.id, target.id, value.order_id, value.order_id).first<{ target_needed: number; target_completed: number; source_needed: number; source_completed: number }>();
    if (!counts || counts.target_completed >= counts.target_needed) return Response.json({ error: "대상 주문은 이미 준비가 완료되었습니다." }, { status: 409 });
    const targetNext = counts.target_completed + 1 >= counts.target_needed ? "ready" : target.order_status;
    const sourceNext = counts.source_completed - 1 < counts.source_needed && value.source_status === "ready" ? "in_progress" : value.source_status;
    const now = new Date().toISOString();
    const afterData = JSON.stringify({ packageId: value.id, replacementPackageId: replacement.id, fromOrderId: value.order_id, toOrderId: target.id, workerId: user.userId, performedAt: now, reason: payload.reason, labelActionRequired: "VOID_AND_REPRINT" });
    const results = await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare("UPDATE packages SET order_id=?,updated_at=? WHERE id=? AND order_id=? AND package_status='completed' AND EXISTS(SELECT 1 FROM orders WHERE id=? AND version=?) AND EXISTS(SELECT 1 FROM orders WHERE id=? AND version=?) AND EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=? AND product_id=? AND package_status IN ('queued','in_progress'))").bind(target.id, now, value.id, value.order_id, target.id, target.version, value.order_id, value.source_version, replacement.id, target.id, value.product_id),
      runtimeEnv.DB.prepare("UPDATE packages SET order_id=?,package_status='in_progress',updated_at=? WHERE id=? AND order_id=? AND product_id=? AND package_status IN ('queued','in_progress') AND EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?)").bind(value.order_id, now, replacement.id, target.id, value.product_id, value.id, target.id),
      runtimeEnv.DB.prepare("UPDATE orders SET order_status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?) AND EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?)").bind(targetNext, now, target.id, target.version, value.id, target.id, replacement.id, value.order_id),
      runtimeEnv.DB.prepare("UPDATE orders SET order_status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?) AND EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?)").bind(sourceNext, now, value.order_id, value.source_version, value.id, target.id, replacement.id, value.order_id),
      runtimeEnv.DB.prepare("INSERT INTO order_events(id,order_id,event_type,before_data,after_data,reason,actor_id,created_at) SELECT ?,?,'PACKAGE_REASSIGNED',?,?,?,?,? WHERE EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?) AND EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?)").bind(crypto.randomUUID(), target.id, JSON.stringify({ packageId: value.id, replacementPackageId: replacement.id, orderId: value.order_id }), afterData, payload.reason, user.userId, now, value.id, target.id, replacement.id, value.order_id),
    ]);
    if (!results[0].meta.changes || !results[1].meta.changes || !results[2].meta.changes || !results[3].meta.changes || !results[4].meta.changes) return Response.json({ error: "package 상태가 변경되었습니다. 최신 내용을 다시 확인해주세요." }, { status: 409 });
    return Response.json({ ok: true, packageId: value.id, replacementPackageId: replacement.id, fromOrderId: value.order_id, toOrderId: target.id, targetStatus: targetNext, sourceStatus: sourceNext });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "대체 완성품을 적용하지 못했습니다." }, { status: 500 });
  }
}

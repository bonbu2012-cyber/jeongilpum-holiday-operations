import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { isConfiguredOperator } from "../../../../lib/operator-auth";
import { arrivalOffsetMinutes } from "../../../../lib/workshop-operations";

type Payload = { targetOrderId?: string; packageId?: string; reason?: "EARLY_CUSTOMER_ARRIVAL" };
type OrderRow = { id: string; order_status: string; version: number; customer_note: string; pickup_at: string | null; customer_arrived: number; fulfillment_note: string; actual_arrived_at: string | null };
type PackageRow = { id: string; order_id: string; product_id: string; package_status: string; source_pickup_at: string | null; source_status: string; source_version: number; source_customer_note: string; source_fulfillment_note: string };
type TargetItem = { id: string; quantity: number; package_count: number; max_sequence: number };
type BomAvailability = { quantity_per_product: number; available: number };
const runtimeEnv = env as typeof env & { DB: D1Database; OPERATOR_USER_IDS?: string; OPERATOR_EMAILS?: string };

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isConfiguredOperator(user, { userIds: runtimeEnv.OPERATOR_USER_IDS, emails: runtimeEnv.OPERATOR_EMAILS })) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });
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
    const targetItem = await runtimeEnv.DB.prepare("SELECT i.id,i.quantity,(SELECT COUNT(*) FROM packages p WHERE p.order_item_id=i.id AND p.package_status!='voided') AS package_count,(SELECT COALESCE(MAX(p.package_sequence),0) FROM packages p WHERE p.order_item_id=i.id) AS max_sequence FROM order_items i WHERE i.order_id=? AND i.product_id=? AND NOT EXISTS(SELECT 1 FROM order_item_customizations c WHERE c.order_item_id=i.id) ORDER BY i.created_at,i.id LIMIT 1").bind(target.id, value.product_id).first<TargetItem>();
    if (!targetItem || targetItem.package_count >= targetItem.quantity) return Response.json({ error: "대상 주문의 동일상품 미조립 수량이 없습니다." }, { status: 409 });
    const sourceCustom = await runtimeEnv.DB.prepare("SELECT 1 AS found FROM order_item_customizations c JOIN order_items i ON i.id=c.order_item_id WHERE i.order_id=? AND i.product_id=? LIMIT 1").bind(value.order_id, value.product_id).first<{ found: number }>();
    if (sourceCustom) return Response.json({ error: "맞춤 구성 상품은 자동 대체할 수 없습니다." }, { status: 409 });

    const bom = await runtimeEnv.DB.prepare("SELECT pc.quantity_per_product,(SELECT COUNT(*) FROM skin_packs sp WHERE sp.component_code=pc.component_code AND sp.status='available') AS available FROM product_components pc WHERE pc.product_id=? AND pc.active=1").bind(value.product_id).all<BomAvailability>();
    if (bom.results.length && bom.results.every((item) => Number(item.available) >= item.quantity_per_product)) return Response.json({ error: "가용 스킨팩으로 즉시 조립할 수 있습니다. 패키지 재배정보다 새 세트 조립을 먼저 진행해주세요.", assemblyAvailable: true }, { status: 409 });

    const counts = await runtimeEnv.DB.prepare("SELECT (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=?) AS target_needed,(SELECT COUNT(*) FROM packages WHERE order_id=? AND package_status='completed') AS target_completed,(SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=?) AS source_needed,(SELECT COUNT(*) FROM packages WHERE order_id=? AND package_status='completed') AS source_completed").bind(target.id, target.id, value.order_id, value.order_id).first<{ target_needed: number; target_completed: number; source_needed: number; source_completed: number }>();
    if (!counts || counts.target_completed >= counts.target_needed) return Response.json({ error: "대상 주문은 이미 준비가 완료되었습니다." }, { status: 409 });
    const targetNext = counts.target_completed + 1 >= counts.target_needed ? "ready" : target.order_status;
    const sourceNext = counts.source_completed - 1 < counts.source_needed && value.source_status === "ready" ? "in_progress" : value.source_status;
    const now = new Date().toISOString();
    const nextSequence = Number(targetItem.max_sequence) + 1;
    const afterData = JSON.stringify({ packageId: value.id, fromOrderId: value.order_id, toOrderId: target.id, workerId: user.userId, performedAt: now, reason: payload.reason, labelActionRequired: "VOID_AND_REPRINT" });
    const results = await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare("UPDATE packages SET order_id=?,order_item_id=?,package_sequence=?,updated_at=? WHERE id=? AND order_id=? AND package_status='completed' AND EXISTS(SELECT 1 FROM orders WHERE id=? AND version=?) AND EXISTS(SELECT 1 FROM orders WHERE id=? AND version=?)").bind(target.id, targetItem.id, nextSequence, now, value.id, value.order_id, target.id, target.version, value.order_id, value.source_version),
      runtimeEnv.DB.prepare("UPDATE orders SET order_status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?)").bind(targetNext, now, target.id, target.version, value.id, target.id),
      runtimeEnv.DB.prepare("UPDATE orders SET order_status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?)").bind(sourceNext, now, value.order_id, value.source_version, value.id, target.id),
      runtimeEnv.DB.prepare("UPDATE package_labels SET status='void',voided_by=?,voided_at=?,void_reason='PACKAGE_REASSIGNED' WHERE package_id=? AND status!='void'").bind(user.userId, now, value.id),
      runtimeEnv.DB.prepare("INSERT INTO package_assignment_history(id,package_id,from_order_id,to_order_id,reason,changed_by,changed_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?)").bind(crypto.randomUUID(), value.id, value.order_id, target.id, payload.reason, user.userId, now, value.id, target.id),
      runtimeEnv.DB.prepare("INSERT INTO order_events(id,order_id,event_type,before_data,after_data,reason,actor_id,created_at) SELECT ?,?,'PACKAGE_REASSIGNED',?,?,?,?,? WHERE EXISTS(SELECT 1 FROM packages WHERE id=? AND order_id=?)").bind(crypto.randomUUID(), target.id, JSON.stringify({ packageId: value.id, orderId: value.order_id }), afterData, payload.reason, user.userId, now, value.id, target.id),
    ]);
    if (!results[0].meta.changes || !results[1].meta.changes || !results[2].meta.changes || !results[results.length - 1].meta.changes) return Response.json({ error: "package 또는 주문 상태가 변경되었습니다. 최신 내용을 다시 확인해주세요." }, { status: 409 });
    return Response.json({ ok: true, packageId: value.id, fromOrderId: value.order_id, toOrderId: target.id, targetStatus: targetNext, sourceStatus: sourceNext, labelActionRequired: "VOID_AND_REPRINT" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "대체 완성품을 적용하지 못했습니다." }, { status: 500 });
  }
}
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { isConfiguredOperator } from "../../../../lib/operator-auth";
import { buildPackageCode, packageOrderToken, packageProductPrefix } from "../../../../lib/package-domain";

type Payload = { orderId?: string; productId?: string; assemblyKey?: string };
type OrderRow = { id: string; order_no: string; order_status: string };
type ItemRow = { id: string; product_id: string; product_name_snapshot: string; quantity: number; code: string; package_count: number };
type BomRow = { id: string; component_code: string; component_name: string; quantity_per_product: number; sort_order: number };
type SkinPackRow = { id: string; skin_pack_code: string; component_code: string };
type ExistingPackage = { id: string; package_code: string };
const runtimeEnv = env as typeof env & { DB: D1Database; OPERATOR_USER_IDS?: string; OPERATOR_EMAILS?: string };

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isConfiguredOperator(user, { userIds: runtimeEnv.OPERATOR_USER_IDS, emails: runtimeEnv.OPERATOR_EMAILS })) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });
  try {
    const payload = await request.json() as Payload;
    if (!payload.orderId || !payload.productId || !payload.assemblyKey) return Response.json({ error: "주문·상품·조립 중복방지 키를 확인해주세요." }, { status: 400 });
    const prior = await runtimeEnv.DB.prepare("SELECT id,package_code FROM packages WHERE assembly_key=?").bind(payload.assemblyKey).first<ExistingPackage>();
    if (prior) return Response.json({ ok: true, packageId: prior.id, packageCode: prior.package_code, alreadyApplied: true });
    const order = await runtimeEnv.DB.prepare("SELECT id,order_no,order_status FROM orders WHERE id=?").bind(payload.orderId).first<OrderRow>();
    if (!order || ["cancelled", "fulfilled"].includes(order.order_status)) return Response.json({ error: "조립 가능한 활성 주문을 찾을 수 없습니다." }, { status: 409 });
    const item = await runtimeEnv.DB.prepare("SELECT oi.id,oi.product_id,oi.product_name_snapshot,oi.quantity,p.code,(SELECT COUNT(*) FROM packages pk WHERE pk.order_item_id=oi.id AND pk.package_status!='voided') AS package_count FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? AND oi.product_id=? ORDER BY oi.created_at,oi.id LIMIT 1").bind(order.id, payload.productId).first<ItemRow>();
    if (!item || item.package_count >= item.quantity) return Response.json({ error: "해당 상품의 주문수량만큼 이미 package가 조립되었습니다." }, { status: 409 });
    const bom = await runtimeEnv.DB.prepare("SELECT id,component_code,component_name,quantity_per_product,sort_order FROM product_components WHERE product_id=? AND active=1 ORDER BY sort_order,id").bind(item.product_id).all<BomRow>();
    if (!bom.results.length) return Response.json({ error: "상품 BOM 구성정보가 필요합니다." }, { status: 409 });

    const selected: Array<{ pack: SkinPackRow; component: BomRow; slot: number }> = [];
    const unavailable: string[] = [];
    for (const component of bom.results) {
      const packs = await runtimeEnv.DB.prepare("SELECT id,skin_pack_code,component_code FROM skin_packs WHERE component_code=? AND status='available' ORDER BY created_at,id LIMIT ?").bind(component.component_code, component.quantity_per_product).all<SkinPackRow>();
      if (packs.results.length < component.quantity_per_product) unavailable.push(`${component.component_name} ${component.quantity_per_product - packs.results.length}팩 부족`);
      packs.results.forEach((pack, index) => selected.push({ pack, component, slot: index + 1 }));
    }
    if (unavailable.length) return Response.json({ error: `가용 skin pack이 부족합니다: ${unavailable.join(", ")}` }, { status: 409 });

    const now = new Date().toISOString();
    const packageId = crypto.randomUUID();
    const packagePrefix = `${packageProductPrefix(item.code)}-${packageOrderToken(order.order_no)}-`;
    const priorSequence = await runtimeEnv.DB.prepare("SELECT COALESCE(MAX(CAST(substr(package_code,length(?)+1) AS INTEGER)),0) AS sequence FROM packages WHERE package_code LIKE ?").bind(packagePrefix, `${packagePrefix}%`).first<{ sequence: number }>();
    const sequence = Number(priorSequence?.sequence ?? 0) + 1;
    const packageCode = buildPackageCode(item.code, order.order_no, sequence);
    const statements: D1PreparedStatement[] = [
      runtimeEnv.DB.prepare("INSERT INTO packages(id,order_id,order_item_id,package_sequence,assembly_key,package_code,product_id,product_name_snapshot,package_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?, 'completed',?,?)").bind(packageId, order.id, item.id, sequence, payload.assemblyKey, packageCode, item.product_id, item.product_name_snapshot, now, now),
    ];
    for (const value of selected) {
      statements.push(runtimeEnv.DB.prepare("INSERT INTO package_skin_packs(id,package_id,skin_pack_id,product_component_id,quantity_slot,assigned_by,assigned_at) VALUES(?, ?, (SELECT id FROM skin_packs WHERE id=? AND status='available'), ?, ?, ?, ?)").bind(crypto.randomUUID(), packageId, value.pack.id, value.component.id, value.slot, user.userId, now));
      statements.push(runtimeEnv.DB.prepare("UPDATE skin_packs SET status='assigned',assigned_at=?,updated_at=? WHERE id=? AND status='available'").bind(now, now, value.pack.id));
    }
    statements.push(runtimeEnv.DB.prepare("INSERT INTO package_assignment_history(id,package_id,from_order_id,to_order_id,reason,changed_by,changed_at) VALUES(?,?,NULL,?,'INITIAL_ASSEMBLY',?,?)").bind(crypto.randomUUID(), packageId, order.id, user.userId, now));
    statements.push(runtimeEnv.DB.prepare("INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) VALUES(?,?,'PACKAGE_ASSEMBLED',?,?,?)").bind(crypto.randomUUID(), order.id, JSON.stringify({ packageId, packageCode, productId: item.product_id, skinPackIds: selected.map((value) => value.pack.id) }), user.userId, now));
    await runtimeEnv.DB.batch(statements);
    return Response.json({ ok: true, packageId, packageCode, qrValue: `/workshop/packages/${encodeURIComponent(packageCode)}` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "선물세트를 조립하지 못했습니다." }, { status: 400 });
  }
}

import { env } from "cloudflare:workers";
import { requireOperatorApi } from "../../../../lib/operator-session";

type RouteContext = { params: Promise<{ packageCode: string }> };
type PreviewPayload = { action?: "preview_label" };
type PackageRow = {
  id: string;
  work_item_id: string | null;
  package_code: string;
  package_status: string;
  product_name_snapshot: string;
  order_no: string | null;
  delivery_method: "onsite_reservation" | "onsite_sale" | "delivery" | null;
  due_at: string | null;
};
type SkinPackRow = {
  id: string;
  skin_pack_code: string;
  cut_name_snapshot: string;
  component_code: string;
  quantity_slot: number;
  weight_g: number;
  traceability_no: string;
  origin: string;
  grade: string;
  manufactured_at: string;
  storage_method: string;
  expiry_text: string;
  label_status: "draft" | "printed" | "void" | null;
};

const runtimeEnv = env as typeof env & { DB: D1Database };

function schedule(row: PackageRow) {
  if (!row.due_at || !row.delivery_method) return null;
  if (row.delivery_method === "delivery") return `${row.due_at.slice(0, 10)} 택배`;
  if (row.delivery_method === "onsite_sale") return `${row.due_at.slice(0, 10)} 현장판매`;
  return `${row.due_at.slice(0, 10)} ${row.due_at.slice(11, 16)} 현장 예약`;
}

async function loadPackage(packageCode: string) {
  const value = await runtimeEnv.DB.prepare(`
    SELECT
      p.id,p.work_item_id,p.package_code,p.package_status,p.product_name_snapshot,
      o.order_no,w.delivery_method,w.due_at
    FROM packages p
    LEFT JOIN work_items w ON w.id=p.work_item_id
    LEFT JOIN orders o ON o.id=w.order_id
    WHERE p.package_code=?
  `).bind(packageCode).first<PackageRow>();
  if (!value) return null;
  const packs = await runtimeEnv.DB.prepare(`
    SELECT
      sp.id,sp.skin_pack_code,sp.cut_name_snapshot,sp.component_code,psp.quantity_slot,
      sp.weight_g,sp.traceability_no,sp.origin,sp.grade,sp.manufactured_at,
      sp.storage_method,sp.expiry_text,spl.status AS label_status
    FROM package_skin_packs psp
    JOIN skin_packs sp ON sp.id=psp.skin_pack_id
    LEFT JOIN skin_pack_labels spl
      ON spl.skin_pack_id=sp.id
      AND spl.version=(
        SELECT MAX(version)
        FROM skin_pack_labels
        WHERE skin_pack_id=sp.id
      )
    WHERE psp.package_id=?
    ORDER BY psp.quantity_slot,sp.skin_pack_code
  `).bind(value.id).all<SkinPackRow>();
  return {
    packageId: value.id,
    workItemId: value.work_item_id,
    packageCode: value.package_code,
    packageStatus: value.package_status,
    productName: value.product_name_snapshot,
    orderNo: value.order_no,
    schedule: schedule(value),
    qrValue: `/workshop/packages/${encodeURIComponent(value.package_code)}`,
    skinPacks: packs.results.map((pack) => ({
      id: pack.id,
      skinPackCode: pack.skin_pack_code,
      cutName: pack.cut_name_snapshot,
      componentCode: pack.component_code,
      quantitySlot: pack.quantity_slot,
      weightG: pack.weight_g,
      traceabilityNo: pack.traceability_no,
      origin: pack.origin,
      grade: pack.grade,
      manufacturedAt: pack.manufactured_at,
      storageMethod: pack.storage_method,
      expiryText: pack.expiry_text,
      labelStatus: pack.label_status,
    })),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireOperatorApi();
  if (denied) return denied;
  const { packageCode: encoded } = await context.params;
  const detail = await loadPackage(decodeURIComponent(encoded));
  if (!detail) return Response.json({ error: "패키지를 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ package: detail }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireOperatorApi();
  if (denied) return denied;
  const { packageCode: encoded } = await context.params;
  const detail = await loadPackage(decodeURIComponent(encoded));
  if (!detail) return Response.json({ error: "패키지를 찾을 수 없습니다." }, { status: 404 });

  try {
    const payload = await request.json() as PreviewPayload;
    if (payload.action !== "preview_label") return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
    if (!detail.skinPacks.length) return Response.json({ error: "연결된 스킨팩이 없어 라벨 미리보기를 만들 수 없습니다." }, { status: 409 });
    return Response.json({
      ok: true,
      label: {
        packageCode: detail.packageCode,
        productName: detail.productName,
        qrValue: detail.qrValue,
        skinPacks: detail.skinPacks.map((item) => ({
          skinPackCode: item.skinPackCode,
          cutName: item.cutName,
        })),
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "패키지 라벨을 준비하지 못했습니다." },
      { status: 400 },
    );
  }
}

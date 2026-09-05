import { env } from "cloudflare:workers";
import { requireOperatorApi } from "../../../../../lib/operator-session";
import { skinPackLabelsToLongCsv, type SkinPackLabelPayload } from "../../../../../lib/production-domain";

type RouteContext = { params: Promise<{ packageCode: string }> };
type Row = {
  skin_pack_code: string;
  cut_name_snapshot: string;
  weight_g: number;
  traceability_no: string;
  origin: string;
  slaughterhouse: string;
  grade: string;
  manufactured_at: string;
  storage_method: string;
  expiry_text: string;
  packaging_material: string;
  food_type: string;
};

const runtimeEnv = env as typeof env & { DB: D1Database };

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireOperatorApi();
  if (denied) return denied;
  const { packageCode: encoded } = await context.params;
  const packageCode = decodeURIComponent(encoded);
  const packageRow = await runtimeEnv.DB.prepare(`
    SELECT id
    FROM packages
    WHERE package_code=?
  `).bind(packageCode).first<{ id: string }>();
  if (!packageRow) return Response.json({ error: "패키지를 찾을 수 없습니다." }, { status: 404 });

  const result = await runtimeEnv.DB.prepare(`
    SELECT
      sp.skin_pack_code,sp.cut_name_snapshot,sp.weight_g,sp.traceability_no,sp.origin,
      sp.slaughterhouse,sp.grade,sp.manufactured_at,sp.storage_method,sp.expiry_text,
      sp.packaging_material,sp.food_type
    FROM package_skin_packs psp
    JOIN skin_packs sp ON sp.id=psp.skin_pack_id
    WHERE psp.package_id=?
    ORDER BY psp.quantity_slot,sp.skin_pack_code
  `).bind(packageRow.id).all<Row>();
  const rows: SkinPackLabelPayload[] = result.results.map((row) => ({
    skinPackCode: row.skin_pack_code,
    cutName: row.cut_name_snapshot,
    weightG: row.weight_g,
    traceabilityNo: row.traceability_no,
    origin: row.origin,
    slaughterhouse: row.slaughterhouse,
    grade: row.grade,
    manufacturedAt: row.manufactured_at,
    storageMethod: row.storage_method,
    expiryText: row.expiry_text,
    packagingMaterial: row.packaging_material,
    foodType: row.food_type,
  }));
  const safeFilename = packageCode.replace(/[^A-Z0-9_-]/gi, "_");
  return new Response(`\uFEFF${skinPackLabelsToLongCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename}-skin-packs.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

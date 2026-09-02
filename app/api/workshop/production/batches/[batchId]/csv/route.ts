import { env } from "cloudflare:workers";
import { requireOperatorApi } from "../../../../../../lib/operator-session";
import { skinPackLabelsToLongCsv, type SkinPackLabelPayload } from "../../../../../../lib/production-domain";

type RouteContext = { params: Promise<{ batchId: string }> };
type Row = { skin_pack_code: string; cut_name_snapshot: string; weight_g: number; traceability_no: string; origin: string; slaughterhouse: string; grade: string; manufactured_at: string; storage_method: string; expiry_text: string; packaging_material: string; food_type: string };
const runtimeEnv = env as typeof env & { DB: D1Database };

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireOperatorApi();
  if (denied) return denied;
  const { batchId } = await context.params;
  const result = await runtimeEnv.DB.prepare("SELECT skin_pack_code,cut_name_snapshot,weight_g,traceability_no,origin,slaughterhouse,grade,manufactured_at,storage_method,expiry_text,packaging_material,food_type FROM skin_packs WHERE production_batch_id=? AND status!='voided' ORDER BY batch_sequence").bind(batchId).all<Row>();
  const rows: SkinPackLabelPayload[] = result.results.map((row) => ({ skinPackCode: row.skin_pack_code, cutName: row.cut_name_snapshot, weightG: row.weight_g, traceabilityNo: row.traceability_no, origin: row.origin, slaughterhouse: row.slaughterhouse, grade: row.grade, manufacturedAt: row.manufactured_at, storageMethod: row.storage_method, expiryText: row.expiry_text, packagingMaterial: row.packaging_material, foodType: row.food_type }));
  const csv = `\uFEFF${skinPackLabelsToLongCsv(rows)}`;
  const safeBatch = batchId.replace(/[^A-Z0-9_-]/gi, "_");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="skin-packs-${safeBatch}.csv"`, "Cache-Control": "no-store" } });
}

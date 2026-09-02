import { env } from "cloudflare:workers";
import { loadWorkshopPackage } from "../../../../../lib/package-detail";
import { requireOperatorApi } from "../../../../../lib/operator-session";
import { skinPackLabelsToLongCsv } from "../../../../../lib/production-domain";

type RouteContext = { params: Promise<{ packageCode: string }> };
const runtimeEnv = env as typeof env & { DB: D1Database };

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireOperatorApi();
  if (denied) return denied;
  const { packageCode: encodedCode } = await context.params;
  const packageCode = decodeURIComponent(encodedCode);
  const detail = await loadWorkshopPackage(runtimeEnv.DB, packageCode);
  if (!detail) return Response.json({ error: "패키지를 찾을 수 없습니다." }, { status: 404 });
  const rows = detail.skinPacks.map((pack) => ({ skinPackCode: pack.skinPackCode, cutName: pack.componentName, weightG: pack.weightG, traceabilityNo: pack.traceabilityNo, origin: pack.origin, slaughterhouse: pack.slaughterhouse, grade: pack.grade, manufacturedAt: pack.manufacturedAt, storageMethod: pack.storageMethod, expiryText: pack.expiryText, packagingMaterial: pack.packagingMaterial, foodType: pack.foodType }));
  const safeFilename = packageCode.replace(/[^A-Z0-9_-]/gi, "_");
  return new Response(`\uFEFF${skinPackLabelsToLongCsv(rows)}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safeFilename}-skin-packs.csv"`, "Cache-Control": "no-store" } });
}

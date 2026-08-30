import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { isConfiguredOperator } from "../../../../../lib/operator-auth";
import { labelPayloadFromDetail, loadWorkshopPackage } from "../../../../../lib/package-detail";
import { labelPayloadToWideCsv } from "../../../../../lib/package-domain";

type RouteContext = { params: Promise<{ packageCode: string }> };
const runtimeEnv = env as typeof env & { DB: D1Database; OPERATOR_USER_IDS?: string; OPERATOR_EMAILS?: string };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isConfiguredOperator(user, { userIds: runtimeEnv.OPERATOR_USER_IDS, emails: runtimeEnv.OPERATOR_EMAILS })) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });
  const { packageCode: encodedCode } = await context.params;
  const packageCode = decodeURIComponent(encodedCode);
  const detail = await loadWorkshopPackage(runtimeEnv.DB, packageCode, user.userId);
  if (!detail) return Response.json({ error: "패키지를 찾을 수 없습니다." }, { status: 404 });
  try {
    const safeFilename = packageCode.replace(/[^A-Z0-9_-]/gi, "_");
    const csv = `\uFEFF${labelPayloadToWideCsv(labelPayloadFromDetail(detail))}`;
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safeFilename}.csv"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "CSV를 생성하지 못했습니다." }, { status: 400 });
  }
}

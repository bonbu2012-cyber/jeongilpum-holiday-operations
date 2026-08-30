import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { isConfiguredOperator } from "../../../../lib/operator-auth";
import { loadWorkshopPackage, packageLabelPayload } from "../../../../lib/package-detail";

type RouteContext = { params: Promise<{ packageCode: string }> };
type PreviewPayload = { action: "preview_label" };
const runtimeEnv = env as typeof env & { DB: D1Database; OPERATOR_USER_IDS?: string; OPERATOR_EMAILS?: string };

async function authorized() {
  const user = await getChatGPTUser();
  if (!user) return { response: Response.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  if (!isConfiguredOperator(user, { userIds: runtimeEnv.OPERATOR_USER_IDS, emails: runtimeEnv.OPERATOR_EMAILS })) return { response: Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 }) };
  return { user };
}

async function detailResponse(packageCode: string) {
  const detail = await loadWorkshopPackage(runtimeEnv.DB, packageCode);
  if (!detail) return Response.json({ error: "패키지를 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ package: detail }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const { packageCode } = await context.params;
  return detailResponse(decodeURIComponent(packageCode));
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const { packageCode: encodedCode } = await context.params;
  const packageCode = decodeURIComponent(encodedCode);
  const detail = await loadWorkshopPackage(runtimeEnv.DB, packageCode);
  if (!detail) return Response.json({ error: "패키지를 찾을 수 없습니다." }, { status: 404 });
  try {
    const payload = await request.json() as PreviewPayload;
    if (payload.action !== "preview_label") return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
    if (!detail.skinPacks.length) return Response.json({ error: "조립된 스킨팩이 없어 패키지 라벨을 만들 수 없습니다." }, { status: 409 });
    const now = new Date().toISOString();
    const label = packageLabelPayload(detail);
    const latest = await runtimeEnv.DB.prepare("SELECT COALESCE(MAX(version),0) AS version FROM package_labels WHERE package_id=?").bind(detail.packageId).first<{ version: number }>();
    const version = Number(latest?.version ?? 0) + 1;
    await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare("INSERT INTO package_labels(id,package_id,version,status,payload_json,qr_value,created_by,created_at) VALUES(?,?,?,'draft',?,?,?,?)").bind(crypto.randomUUID(), detail.packageId, version, JSON.stringify(label), detail.qrValue, auth.user.userId, now),
      runtimeEnv.DB.prepare("INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) VALUES(?,?,'PACKAGE_LABEL_PREVIEWED',?,?,?)").bind(crypto.randomUUID(), detail.orderId, JSON.stringify({ packageId: detail.packageId, labelVersion: version }), auth.user.userId, now),
    ]);
    return Response.json({ ok: true, version, label });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "패키지 라벨을 저장하지 못했습니다." }, { status: 400 });
  }
}
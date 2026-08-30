import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { isConfiguredOperator } from "../../../../lib/operator-auth";
import { labelPayloadFromDetail, loadWorkshopPackage } from "../../../../lib/package-detail";
import { parseTraceabilityScan, validateTraceabilityLength } from "../../../../lib/package-domain";

type RouteContext = { params: Promise<{ packageCode: string }> };
type TraceabilityPayload = { action: "apply_traceability"; rawScan?: string; componentIds?: string[]; origin?: string; slaughterhouse?: string; cattleType?: string; grade?: string; source?: "manual" | "hid" | "recent" };
type WeightPayload = { action: "update_weight"; componentId?: string; weightG?: number };
type PreviewPayload = { action: "preview_label" };
const runtimeEnv = env as typeof env & { DB: D1Database; OPERATOR_USER_IDS?: string; OPERATOR_EMAILS?: string; TRACEABILITY_NO_LENGTHS?: string };

async function authorized() {
  const user = await getChatGPTUser();
  if (!user) return { response: Response.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  if (!isConfiguredOperator(user, { userIds: runtimeEnv.OPERATOR_USER_IDS, emails: runtimeEnv.OPERATOR_EMAILS })) return { response: Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 }) };
  return { user };
}

async function detailResponse(packageCode: string, workerId: string) {
  const detail = await loadWorkshopPackage(runtimeEnv.DB, packageCode, workerId);
  if (!detail) return Response.json({ error: "패키지를 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ package: detail }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const { packageCode } = await context.params;
  return detailResponse(decodeURIComponent(packageCode), auth.user.userId);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const { packageCode: encodedCode } = await context.params;
  const packageCode = decodeURIComponent(encodedCode);
  const detail = await loadWorkshopPackage(runtimeEnv.DB, packageCode, auth.user.userId);
  if (!detail) return Response.json({ error: "패키지를 찾을 수 없습니다." }, { status: 404 });

  try {
    const payload = await request.json() as TraceabilityPayload | WeightPayload | PreviewPayload;
    const now = new Date().toISOString();
    if (payload.action === "apply_traceability") {
      const parsed = parseTraceabilityScan(payload.rawScan ?? "");
      if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
      const allowedLengths = (runtimeEnv.TRACEABILITY_NO_LENGTHS ?? "").split(",").map(Number).filter((value) => Number.isInteger(value) && value > 0);
      const lengthValidation = validateTraceabilityLength(parsed.traceabilityNo, allowedLengths);
      if (!lengthValidation.ok) return Response.json({ error: lengthValidation.error }, { status: 400 });
      const componentIds = [...new Set(payload.componentIds ?? [])];
      const owned = detail.components.filter((component) => componentIds.includes(component.id));
      if (!owned.length || owned.length !== componentIds.length) return Response.json({ error: "이력번호를 적용할 구성품을 선택해주세요." }, { status: 400 });
      const origin = (payload.origin ?? "").trim().slice(0, 100);
      const slaughterhouse = (payload.slaughterhouse ?? "").trim().slice(0, 100);
      const cattleType = (payload.cattleType ?? "").trim().slice(0, 100);
      const grade = (payload.grade ?? "").trim().slice(0, 50);
      const statements: D1PreparedStatement[] = [
        runtimeEnv.DB.prepare("INSERT INTO traceability_records(traceability_no,last_raw_scan,origin,slaughterhouse,cattle_type,grade,source,last_used_by,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(traceability_no) DO UPDATE SET last_raw_scan=excluded.last_raw_scan,origin=CASE WHEN excluded.origin!='' THEN excluded.origin ELSE traceability_records.origin END,slaughterhouse=CASE WHEN excluded.slaughterhouse!='' THEN excluded.slaughterhouse ELSE traceability_records.slaughterhouse END,cattle_type=CASE WHEN excluded.cattle_type!='' THEN excluded.cattle_type ELSE traceability_records.cattle_type END,grade=CASE WHEN excluded.grade!='' THEN excluded.grade ELSE traceability_records.grade END,source=excluded.source,last_used_by=excluded.last_used_by,last_used_at=excluded.last_used_at,updated_at=excluded.updated_at").bind(parsed.traceabilityNo, parsed.raw, origin, slaughterhouse, cattleType, grade, payload.source ?? "manual", auth.user.userId, now, now, now),
      ];
      for (const component of owned) {
        statements.push(runtimeEnv.DB.prepare("UPDATE package_components SET traceability_no=?,origin=CASE WHEN ?!='' THEN ? ELSE COALESCE((SELECT origin FROM traceability_records WHERE traceability_no=?),'') END,slaughterhouse=CASE WHEN ?!='' THEN ? ELSE COALESCE((SELECT slaughterhouse FROM traceability_records WHERE traceability_no=?),'') END,entered_by=?,entered_at=?,updated_at=? WHERE id=? AND package_id=?").bind(parsed.traceabilityNo, origin, origin, parsed.traceabilityNo, slaughterhouse, slaughterhouse, parsed.traceabilityNo, auth.user.userId, now, now, component.id, detail.packageId));
      }
      statements.push(runtimeEnv.DB.prepare("INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) VALUES(?,?,'PACKAGE_TRACEABILITY_UPDATED',?,?,?)").bind(crypto.randomUUID(), detail.orderId, JSON.stringify({ packageId: detail.packageId, componentIds: owned.map((component) => component.id), traceabilityNo: parsed.traceabilityNo }), auth.user.userId, now));
      await runtimeEnv.DB.batch(statements);
      return detailResponse(packageCode, auth.user.userId);
    }

    if (payload.action === "update_weight") {
      if (!payload.componentId || !Number.isInteger(payload.weightG) || Number(payload.weightG) <= 0 || Number(payload.weightG) > 1_000_000) return Response.json({ error: "중량은 0g보다 큰 정수로 입력해주세요." }, { status: 400 });
      const component = detail.components.find((item) => item.id === payload.componentId);
      if (!component) return Response.json({ error: "구성품을 찾을 수 없습니다." }, { status: 404 });
      await runtimeEnv.DB.batch([
        runtimeEnv.DB.prepare("UPDATE package_components SET weight_g=?,entered_by=?,entered_at=?,updated_at=? WHERE id=? AND package_id=?").bind(payload.weightG, auth.user.userId, now, component.id, detail.packageId),
        runtimeEnv.DB.prepare("INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) VALUES(?,?,'PACKAGE_WEIGHT_UPDATED',?,?,?)").bind(crypto.randomUUID(), detail.orderId, JSON.stringify({ packageId: detail.packageId, componentId: component.id, weightG: payload.weightG }), auth.user.userId, now),
      ]);
      return detailResponse(packageCode, auth.user.userId);
    }

    if (payload.action === "preview_label") {
      const labelPayload = labelPayloadFromDetail(detail);
      const latest = await runtimeEnv.DB.prepare("SELECT COALESCE(MAX(version),0) AS version FROM package_labels WHERE package_id=?").bind(detail.packageId).first<{ version: number }>();
      const version = Number(latest?.version ?? 0) + 1;
      await runtimeEnv.DB.batch([
        runtimeEnv.DB.prepare("INSERT INTO package_labels(id,package_id,version,status,payload_json,qr_value,created_by,created_at) VALUES(?,?,?,'draft',?,?,?,?)").bind(crypto.randomUUID(), detail.packageId, version, JSON.stringify(labelPayload), detail.qrValue, auth.user.userId, now),
        runtimeEnv.DB.prepare("INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) VALUES(?,?,'PACKAGE_LABEL_PREVIEWED',?,?,?)").bind(crypto.randomUUID(), detail.orderId, JSON.stringify({ packageId: detail.packageId, labelVersion: version }), auth.user.userId, now),
      ]);
      return Response.json({ ok: true, version, label: labelPayload });
    }

    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "패키지 정보를 저장하지 못했습니다." }, { status: 400 });
  }
}

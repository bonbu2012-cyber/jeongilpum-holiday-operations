import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isConfiguredOperator } from "../../../lib/operator-auth";
import { loadProductionOverview } from "../../../lib/production-data";
import { buildSkinPackCode, validateSkinPackWeight, type SkinPackLabelPayload } from "../../../lib/production-domain";
import { parseTraceabilityScan, validateTraceabilityLength } from "../../../lib/package-domain";

type RoutePayload =
  | { action: "create_batch"; date?: string; componentCode?: string; cutName?: string; productionTarget?: number; rawScan?: string; origin?: string; slaughterhouse?: string; cattleType?: string; grade?: string; storageMethod?: string; expiryText?: string; packagingMaterial?: string; foodType?: string; source?: "manual" | "hid" | "recent" }
  | { action: "change_traceability"; batchId?: string; productionTarget?: number; rawScan?: string; origin?: string; slaughterhouse?: string; cattleType?: string; grade?: string; storageMethod?: string; expiryText?: string; packagingMaterial?: string; foodType?: string; source?: "manual" | "hid" | "recent" }
  | { action: "adjust_target"; batchId?: string; productionTarget?: number }
  | { action: "create_skin_pack"; batchId?: string; weightG?: number; idempotencyKey?: string }
  | { action: "complete_batch"; batchId?: string };
type BatchRow = { id: string; production_date: string; parent_batch_id: string | null; segment_no: number; component_code: string; cut_name_snapshot: string; required_quantity: number; production_target: number; produced_quantity: number; traceability_no: string; origin: string; slaughterhouse: string; cattle_type: string; grade: string; storage_method: string; expiry_text: string; packaging_material: string; food_type: string; status: string };
type ExistingPack = { id: string; skin_pack_code: string };
const runtimeEnv = env as typeof env & { DB: D1Database; OPERATOR_USER_IDS?: string; OPERATOR_EMAILS?: string; TRACEABILITY_NO_LENGTHS?: string };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

async function authorized() {
  const user = await getChatGPTUser();
  if (!user) return { response: Response.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  if (!isConfiguredOperator(user, { userIds: runtimeEnv.OPERATOR_USER_IDS, emails: runtimeEnv.OPERATOR_EMAILS })) return { response: Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 }) };
  return { user };
}

function validDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function optionalText(value: string | undefined, max = 100) { return (value ?? "").trim().slice(0, max); }

async function traceValues(payload: { rawScan?: string; origin?: string; slaughterhouse?: string; cattleType?: string; grade?: string; source?: string }, userId: string, now: string) {
  const parsed = parseTraceabilityScan(payload.rawScan ?? "");
  if (!parsed.ok) throw new Error(parsed.error);
  const lengths = (runtimeEnv.TRACEABILITY_NO_LENGTHS ?? "").split(",").map(Number).filter((value) => Number.isInteger(value) && value > 0);
  const length = validateTraceabilityLength(parsed.traceabilityNo, lengths);
  if (!length.ok) throw new Error(length.error);
  const cached = await runtimeEnv.DB.prepare("SELECT origin,slaughterhouse,cattle_type,grade FROM traceability_records WHERE traceability_no=?").bind(parsed.traceabilityNo).first<{ origin: string; slaughterhouse: string; cattle_type: string; grade: string }>();
  const origin = optionalText(payload.origin) || cached?.origin || "";
  const slaughterhouse = optionalText(payload.slaughterhouse) || cached?.slaughterhouse || "";
  const cattleType = optionalText(payload.cattleType) || cached?.cattle_type || "";
  const grade = optionalText(payload.grade, 50) || cached?.grade || "";
  const statement = runtimeEnv.DB.prepare("INSERT INTO traceability_records(traceability_no,last_raw_scan,origin,slaughterhouse,cattle_type,grade,source,last_used_by,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(traceability_no) DO UPDATE SET last_raw_scan=excluded.last_raw_scan,origin=CASE WHEN excluded.origin!='' THEN excluded.origin ELSE traceability_records.origin END,slaughterhouse=CASE WHEN excluded.slaughterhouse!='' THEN excluded.slaughterhouse ELSE traceability_records.slaughterhouse END,cattle_type=CASE WHEN excluded.cattle_type!='' THEN excluded.cattle_type ELSE traceability_records.cattle_type END,grade=CASE WHEN excluded.grade!='' THEN excluded.grade ELSE traceability_records.grade END,source=excluded.source,last_used_by=excluded.last_used_by,last_used_at=excluded.last_used_at,updated_at=excluded.updated_at").bind(parsed.traceabilityNo, parsed.raw, origin, slaughterhouse, cattleType, grade, payload.source ?? "manual", userId, now, now, now);
  return { traceabilityNo: parsed.traceabilityNo, origin, slaughterhouse, cattleType, grade, statement };
}

export async function GET(request: Request) {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!validDate(date)) return Response.json({ error: "조회 날짜 형식을 확인해주세요." }, { status: 400 });
  try {
    return Response.json(await loadProductionOverview(runtimeEnv.DB, date, auth.user.userId), { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "생산 현황을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  try {
    const payload = await request.json() as RoutePayload;
    const now = new Date().toISOString();

    if (payload.action === "create_batch") {
      const date = payload.date ?? "";
      if (!validDate(date) || !payload.componentCode || !payload.cutName || !Number.isInteger(payload.productionTarget) || Number(payload.productionTarget) < 0) return Response.json({ error: "생산일·부위·생산목표를 확인해주세요." }, { status: 400 });
      const overview = await loadProductionOverview(runtimeEnv.DB, date, auth.user.userId);
      const requirement = overview.requirements.find((item) => item.componentCode === payload.componentCode);
      if (!requirement) return Response.json({ error: "선택 날짜 주문의 BOM에서 해당 부위를 찾을 수 없습니다." }, { status: 409 });
      const trace = await traceValues(payload, auth.user.userId, now);
      const batchId = crypto.randomUUID();
      await runtimeEnv.DB.batch([
        trace.statement,
        runtimeEnv.DB.prepare("INSERT INTO production_batches(id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,required_quantity,available_quantity_at_start,additional_needed,production_target,produced_quantity,traceability_no,origin,slaughterhouse,cattle_type,grade,storage_method,expiry_text,packaging_material,food_type,status,started_by,started_at,created_at,updated_at) VALUES(?,?,NULL,1,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,'in_progress',?,?,?,?)").bind(batchId, date, requirement.componentCode, requirement.componentName, requirement.requiredQuantity, requirement.availableQuantity, requirement.additionalNeeded, payload.productionTarget, trace.traceabilityNo, trace.origin, trace.slaughterhouse, trace.cattleType, trace.grade, optionalText(payload.storageMethod, 200), optionalText(payload.expiryText, 200), optionalText(payload.packagingMaterial, 200), optionalText(payload.foodType, 200), auth.user.userId, now, now, now),
      ]);
      return Response.json({ ok: true, batchId });
    }

    if (payload.action === "adjust_target") {
      if (!payload.batchId || !Number.isInteger(payload.productionTarget) || Number(payload.productionTarget) < 0) return Response.json({ error: "생산목표를 확인해주세요." }, { status: 400 });
      const result = await runtimeEnv.DB.prepare("UPDATE production_batches SET production_target=?,updated_at=? WHERE id=? AND status='in_progress' AND produced_quantity<=?").bind(payload.productionTarget, now, payload.batchId, payload.productionTarget).run();
      if (!result.meta.changes) return Response.json({ error: "생산목표는 이미 생산한 수량보다 작게 설정할 수 없습니다." }, { status: 409 });
      return Response.json({ ok: true });
    }

    if (payload.action === "change_traceability") {
      if (!payload.batchId || !Number.isInteger(payload.productionTarget) || Number(payload.productionTarget) < 0) return Response.json({ error: "새 구간의 생산목표를 확인해주세요." }, { status: 400 });
      const current = await runtimeEnv.DB.prepare("SELECT id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,required_quantity,production_target,produced_quantity,traceability_no,origin,slaughterhouse,cattle_type,grade,storage_method,expiry_text,packaging_material,food_type,status FROM production_batches WHERE id=?").bind(payload.batchId).first<BatchRow>();
      if (!current || current.status !== "in_progress") return Response.json({ error: "진행 중인 batch를 찾을 수 없습니다." }, { status: 404 });
      const trace = await traceValues(payload, auth.user.userId, now);
      const available = await runtimeEnv.DB.prepare("SELECT COUNT(*) AS quantity FROM skin_packs WHERE component_code=? AND status='available'").bind(current.component_code).first<{ quantity: number }>();
      const availableQuantity = Number(available?.quantity ?? 0);
      const childId = crypto.randomUUID();
      await runtimeEnv.DB.batch([
        trace.statement,
        runtimeEnv.DB.prepare("UPDATE production_batches SET status='completed',completed_at=?,updated_at=? WHERE id=? AND status='in_progress'").bind(now, now, current.id),
        runtimeEnv.DB.prepare("INSERT INTO production_batches(id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,required_quantity,available_quantity_at_start,additional_needed,production_target,produced_quantity,traceability_no,origin,slaughterhouse,cattle_type,grade,storage_method,expiry_text,packaging_material,food_type,status,started_by,started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,'in_progress',?,?,?,?)").bind(childId, current.production_date, current.parent_batch_id ?? current.id, current.segment_no + 1, current.component_code, current.cut_name_snapshot, current.required_quantity, availableQuantity, Math.max(0, current.required_quantity - availableQuantity), payload.productionTarget, trace.traceabilityNo, trace.origin, trace.slaughterhouse, trace.cattleType, trace.grade, optionalText(payload.storageMethod, 200) || current.storage_method, optionalText(payload.expiryText, 200) || current.expiry_text, optionalText(payload.packagingMaterial, 200) || current.packaging_material, optionalText(payload.foodType, 200) || current.food_type, auth.user.userId, now, now, now),
      ]);
      return Response.json({ ok: true, batchId: childId });
    }

    if (payload.action === "create_skin_pack") {
      if (!payload.batchId || !validateSkinPackWeight(Number(payload.weightG)) || !payload.idempotencyKey) return Response.json({ error: "batch·중량·중복방지 키를 확인해주세요." }, { status: 400 });
      const prior = await runtimeEnv.DB.prepare("SELECT id,skin_pack_code FROM skin_packs WHERE idempotency_key=?").bind(payload.idempotencyKey).first<ExistingPack>();
      if (prior) return Response.json({ ok: true, skinPackId: prior.id, skinPackCode: prior.skin_pack_code, alreadyApplied: true });
      const batch = await runtimeEnv.DB.prepare("SELECT id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,required_quantity,production_target,produced_quantity,traceability_no,origin,slaughterhouse,cattle_type,grade,storage_method,expiry_text,packaging_material,food_type,status FROM production_batches WHERE id=?").bind(payload.batchId).first<BatchRow>();
      if (!batch || batch.status !== "in_progress") return Response.json({ error: "진행 중인 batch를 찾을 수 없습니다." }, { status: 404 });
      if (batch.produced_quantity >= batch.production_target) return Response.json({ error: "현재 생산목표에 도달했습니다. 목표를 조정한 뒤 계속해주세요." }, { status: 409 });
      const sequence = batch.produced_quantity + 1;
      const codePrefix = buildSkinPackCode(batch.component_code, batch.production_date, 1).slice(0, -4);
      const lastCode = await runtimeEnv.DB.prepare("SELECT COALESCE(MAX(CAST(substr(sp.skin_pack_code,length(?)+1) AS INTEGER)),0) AS sequence FROM skin_packs sp JOIN production_batches pb ON pb.id=sp.production_batch_id WHERE sp.component_code=? AND pb.production_date=?").bind(codePrefix, batch.component_code, batch.production_date).first<{ sequence: number }>();
      const codeSequence = Number(lastCode?.sequence ?? 0) + 1;
      const skinPackId = `sp:${batch.id}:${sequence}`;
      const skinPackCode = buildSkinPackCode(batch.component_code, batch.production_date, codeSequence);
      const label: SkinPackLabelPayload = { skinPackCode, cutName: batch.cut_name_snapshot, weightG: Number(payload.weightG), traceabilityNo: batch.traceability_no, origin: batch.origin, slaughterhouse: batch.slaughterhouse, grade: batch.grade, manufacturedAt: now, storageMethod: batch.storage_method, expiryText: batch.expiry_text, packagingMaterial: batch.packaging_material, foodType: batch.food_type };
      const results = await runtimeEnv.DB.batch([
        runtimeEnv.DB.prepare("INSERT OR IGNORE INTO skin_packs(id,production_batch_id,batch_sequence,skin_pack_code,component_code,cut_name_snapshot,weight_g,traceability_no,origin,slaughterhouse,cattle_type,grade,manufactured_at,storage_method,expiry_text,packaging_material,food_type,status,idempotency_key,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'available',?,?,?,?)").bind(skinPackId, batch.id, sequence, skinPackCode, batch.component_code, batch.cut_name_snapshot, payload.weightG, batch.traceability_no, batch.origin, batch.slaughterhouse, batch.cattle_type, batch.grade, now, batch.storage_method, batch.expiry_text, batch.packaging_material, batch.food_type, payload.idempotencyKey, auth.user.userId, now, now),
        runtimeEnv.DB.prepare("INSERT INTO skin_pack_labels(id,skin_pack_id,version,status,payload_json,created_by,created_at) SELECT ?,?,1,'draft',?,?,? WHERE EXISTS(SELECT 1 FROM skin_packs WHERE id=?) AND NOT EXISTS(SELECT 1 FROM skin_pack_labels WHERE skin_pack_id=?)").bind(crypto.randomUUID(), skinPackId, JSON.stringify(label), auth.user.userId, now, skinPackId, skinPackId),
      ]);
      if (!results[0].meta.changes) {
        const duplicate = await runtimeEnv.DB.prepare("SELECT id,skin_pack_code FROM skin_packs WHERE idempotency_key=?").bind(payload.idempotencyKey).first<ExistingPack>();
        if (duplicate) return Response.json({ ok: true, skinPackId: duplicate.id, skinPackCode: duplicate.skin_pack_code, alreadyApplied: true });
        return Response.json({ error: "다른 작업자가 먼저 팩을 등록했습니다. 최신 batch를 다시 확인해주세요." }, { status: 409 });
      }
      return Response.json({ ok: true, skinPackId, skinPackCode, label });
    }

    if (payload.action === "complete_batch") {
      if (!payload.batchId) return Response.json({ error: "batch를 선택해주세요." }, { status: 400 });
      await runtimeEnv.DB.prepare("UPDATE production_batches SET status='completed',completed_at=?,updated_at=? WHERE id=? AND status='in_progress'").bind(now, now, payload.batchId).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "생산 작업을 저장하지 못했습니다." }, { status: 400 });
  }
}

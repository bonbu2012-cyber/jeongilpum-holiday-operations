import { env } from "cloudflare:workers";
import { OPERATOR_ACTOR, requireOperatorApi } from "../../../lib/operator-session";
import { buildSkinPackCode, validateSkinPackWeight, type SkinPackLabelPayload } from "../../../lib/production-domain";
import { parseTraceabilityScan, validateTraceabilityLength } from "../../../lib/package-domain";

type RoutePayload =
  | { action: "create_batch"; date?: string; componentCode?: string; cutName?: string; productionTarget?: number; rawScan?: string; origin?: string; slaughterhouse?: string; cattleType?: string; grade?: string; storageMethod?: string; expiryText?: string; packagingMaterial?: string; foodType?: string; source?: "manual" | "hid" | "recent" }
  | { action: "change_traceability"; batchId?: string; productionTarget?: number; rawScan?: string; origin?: string; slaughterhouse?: string; cattleType?: string; grade?: string; storageMethod?: string; expiryText?: string; packagingMaterial?: string; foodType?: string; source?: "manual" | "hid" | "recent" }
  | { action: "adjust_target"; batchId?: string; productionTarget?: number }
  | { action: "create_skin_pack"; batchId?: string; weightG?: number; idempotencyKey?: string }
  | { action: "complete_batch"; batchId?: string };

type DemandRow = { product_id: string; product_name_snapshot: string; quantity: number };
type AvailableRow = { component_code: string; quantity: number };
type BatchRow = {
  id: string;
  production_date: string;
  parent_batch_id: string | null;
  segment_no: number;
  component_code: string;
  cut_name_snapshot: string;
  required_quantity: number;
  available_quantity_at_start: number;
  additional_needed: number;
  production_target: number;
  produced_quantity: number;
  traceability_no: string;
  origin: string;
  slaughterhouse: string;
  cattle_type: string;
  grade: string;
  storage_method: string;
  expiry_text: string;
  packaging_material: string;
  food_type: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
};
type TraceRow = {
  traceability_no: string;
  origin: string;
  slaughterhouse: string;
  cattle_type: string;
  grade: string;
  last_used_at: string;
};
type ExistingPack = { id: string; skin_pack_code: string };

const runtimeEnv = env as typeof env & { DB: D1Database; TRACEABILITY_NO_LENGTHS?: string };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function optionalText(value: string | undefined, max = 200) {
  return (value ?? "").trim().slice(0, max);
}

async function traceValues(
  payload: { rawScan?: string; origin?: string; slaughterhouse?: string; cattleType?: string; grade?: string; source?: string },
  now: string,
) {
  const parsed = parseTraceabilityScan(payload.rawScan ?? "");
  if (!parsed.ok) throw new Error(parsed.error);
  const lengths = (runtimeEnv.TRACEABILITY_NO_LENGTHS ?? "")
    .split(",")
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);
  const length = validateTraceabilityLength(parsed.traceabilityNo, lengths);
  if (!length.ok) throw new Error(length.error);

  const cached = await runtimeEnv.DB.prepare(`
    SELECT origin,slaughterhouse,cattle_type,grade
    FROM traceability_records
    WHERE traceability_no=?
  `).bind(parsed.traceabilityNo).first<{ origin: string; slaughterhouse: string; cattle_type: string; grade: string }>();
  const origin = optionalText(payload.origin) || cached?.origin || "";
  const slaughterhouse = optionalText(payload.slaughterhouse) || cached?.slaughterhouse || "";
  const cattleType = optionalText(payload.cattleType) || cached?.cattle_type || "";
  const grade = optionalText(payload.grade, 50) || cached?.grade || "";

  return {
    traceabilityNo: parsed.traceabilityNo,
    origin,
    slaughterhouse,
    cattleType,
    grade,
    statement: runtimeEnv.DB.prepare(`
      INSERT INTO traceability_records(
        traceability_no,last_raw_scan,origin,slaughterhouse,cattle_type,grade,source,
        last_used_by,last_used_at,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(traceability_no) DO UPDATE SET
        last_raw_scan=excluded.last_raw_scan,
        origin=CASE WHEN excluded.origin!='' THEN excluded.origin ELSE traceability_records.origin END,
        slaughterhouse=CASE WHEN excluded.slaughterhouse!='' THEN excluded.slaughterhouse ELSE traceability_records.slaughterhouse END,
        cattle_type=CASE WHEN excluded.cattle_type!='' THEN excluded.cattle_type ELSE traceability_records.cattle_type END,
        grade=CASE WHEN excluded.grade!='' THEN excluded.grade ELSE traceability_records.grade END,
        source=excluded.source,
        last_used_by=excluded.last_used_by,
        last_used_at=excluded.last_used_at,
        updated_at=excluded.updated_at
    `).bind(
      parsed.traceabilityNo,
      parsed.raw,
      origin,
      slaughterhouse,
      cattleType,
      grade,
      payload.source ?? "manual",
      OPERATOR_ACTOR,
      now,
      now,
      now,
    ),
  };
}

function batchResponse(row: BatchRow) {
  return {
    id: row.id,
    productionDate: row.production_date,
    parentBatchId: row.parent_batch_id,
    segmentNo: row.segment_no,
    componentCode: row.component_code,
    cutName: row.cut_name_snapshot,
    requiredQuantity: row.required_quantity,
    availableQuantityAtStart: row.available_quantity_at_start,
    additionalNeeded: row.additional_needed,
    productionTarget: row.production_target,
    producedQuantity: row.produced_quantity,
    traceabilityNo: row.traceability_no,
    origin: row.origin,
    slaughterhouse: row.slaughterhouse,
    cattleType: row.cattle_type,
    grade: row.grade,
    storageMethod: row.storage_method,
    expiryText: row.expiry_text,
    packagingMaterial: row.packaging_material,
    foodType: row.food_type,
    status: row.status,
  };
}

async function loadOverview(date: string) {
  const [demands, available, batches, recent] = await runtimeEnv.DB.batch([
    runtimeEnv.DB.prepare(`
      SELECT product_id,product_name_snapshot,SUM(quantity) AS quantity
      FROM work_items
      WHERE substr(due_at,1,10)=?
        AND work_status!='cancelled'
      GROUP BY product_id,product_name_snapshot
      ORDER BY product_name_snapshot COLLATE NOCASE,product_id
    `).bind(date),
    runtimeEnv.DB.prepare(`
      SELECT component_code,COUNT(*) AS quantity
      FROM skin_packs
      WHERE status='available'
      GROUP BY component_code
    `),
    runtimeEnv.DB.prepare(`
      SELECT
        id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,
        required_quantity,available_quantity_at_start,additional_needed,production_target,
        produced_quantity,traceability_no,origin,slaughterhouse,cattle_type,grade,
        storage_method,expiry_text,packaging_material,food_type,status
      FROM production_batches
      WHERE production_date=?
        AND status!='cancelled'
      ORDER BY component_code,segment_no,started_at,id
    `).bind(date),
    runtimeEnv.DB.prepare(`
      SELECT traceability_no,origin,slaughterhouse,cattle_type,grade,last_used_at
      FROM traceability_records
      WHERE last_used_by=?
      ORDER BY last_used_at DESC
      LIMIT 5
    `).bind(OPERATOR_ACTOR),
  ]);
  const availableByComponent = new Map(
    (available.results as AvailableRow[]).map((row) => [row.component_code, Number(row.quantity)]),
  );

  return {
    requirements: (demands.results as DemandRow[]).map((row) => {
      const requiredQuantity = Number(row.quantity);
      const availableQuantity = availableByComponent.get(row.product_id) ?? 0;
      return {
        componentCode: row.product_id,
        componentName: row.product_name_snapshot,
        requiredQuantity,
        availableQuantity,
        additionalNeeded: Math.max(0, requiredQuantity - availableQuantity),
        sourceProducts: [row.product_name_snapshot],
      };
    }),
    missingProducts: [],
    batches: (batches.results as BatchRow[]).map(batchResponse),
    recentTraceability: (recent.results as TraceRow[]).map((row) => ({
      traceabilityNo: row.traceability_no,
      origin: row.origin,
      slaughterhouse: row.slaughterhouse,
      cattleType: row.cattle_type,
      grade: row.grade,
      lastUsedAt: row.last_used_at,
    })),
  };
}

export async function GET(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;
  const date = new URL(request.url).searchParams.get("date")?.trim() ?? "";
  if (!validDate(date)) return Response.json({ error: "조회 날짜 형식을 확인해주세요." }, { status: 400 });

  try {
    return Response.json(await loadOverview(date), {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "생산 현황을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  try {
    const payload = await request.json() as RoutePayload;
    const now = new Date().toISOString();

    if (payload.action === "create_batch") {
      const date = payload.date?.trim() ?? "";
      const componentCode = optionalText(payload.componentCode, 100);
      const cutName = optionalText(payload.cutName, 200);
      const productionTarget = Number(payload.productionTarget);
      if (!validDate(date) || !componentCode || !cutName || !Number.isInteger(productionTarget) || productionTarget < 0) {
        return Response.json({ error: "생산일·품목·생산목표를 확인해주세요." }, { status: 400 });
      }
      const trace = await traceValues(payload, now);
      const available = await runtimeEnv.DB.prepare(`
        SELECT COUNT(*) AS quantity
        FROM skin_packs
        WHERE component_code=? AND status='available'
      `).bind(componentCode).first<{ quantity: number }>();
      const availableQuantity = Number(available?.quantity ?? 0);
      const batchId = crypto.randomUUID();
      await runtimeEnv.DB.batch([
        trace.statement,
        runtimeEnv.DB.prepare(`
          INSERT INTO production_batches(
            id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,
            required_quantity,available_quantity_at_start,additional_needed,production_target,
            produced_quantity,traceability_no,origin,slaughterhouse,cattle_type,grade,
            storage_method,expiry_text,packaging_material,food_type,status,started_by,started_at,
            created_at,updated_at
          ) VALUES(?,?,NULL,1,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,'in_progress',?,?,?,?)
        `).bind(
          batchId,
          date,
          componentCode,
          cutName,
          0,
          availableQuantity,
          0,
          productionTarget,
          trace.traceabilityNo,
          trace.origin,
          trace.slaughterhouse,
          trace.cattleType,
          trace.grade,
          optionalText(payload.storageMethod),
          optionalText(payload.expiryText),
          optionalText(payload.packagingMaterial),
          optionalText(payload.foodType),
          OPERATOR_ACTOR,
          now,
          now,
          now,
        ),
      ]);
      return Response.json({ ok: true, batchId });
    }

    if (payload.action === "adjust_target") {
      const productionTarget = Number(payload.productionTarget);
      if (!payload.batchId || !Number.isInteger(productionTarget) || productionTarget < 0) {
        return Response.json({ error: "생산목표를 확인해주세요." }, { status: 400 });
      }
      const result = await runtimeEnv.DB.prepare(`
        UPDATE production_batches
        SET production_target=?,updated_at=?
        WHERE id=?
      `).bind(productionTarget, now, payload.batchId).run();
      if (!result.meta.changes) return Response.json({ error: "생산 batch를 찾을 수 없습니다." }, { status: 404 });
      return Response.json({ ok: true });
    }

    if (payload.action === "change_traceability") {
      const productionTarget = Number(payload.productionTarget);
      if (!payload.batchId || !Number.isInteger(productionTarget) || productionTarget < 0) {
        return Response.json({ error: "새 구간의 생산목표를 확인해주세요." }, { status: 400 });
      }
      const current = await runtimeEnv.DB.prepare(`
        SELECT
          id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,
          required_quantity,available_quantity_at_start,additional_needed,production_target,
          produced_quantity,traceability_no,origin,slaughterhouse,cattle_type,grade,
          storage_method,expiry_text,packaging_material,food_type,status
        FROM production_batches
        WHERE id=?
      `).bind(payload.batchId).first<BatchRow>();
      if (!current) return Response.json({ error: "생산 batch를 찾을 수 없습니다." }, { status: 404 });
      const trace = await traceValues(payload, now);
      const available = await runtimeEnv.DB.prepare(`
        SELECT COUNT(*) AS quantity
        FROM skin_packs
        WHERE component_code=? AND status='available'
      `).bind(current.component_code).first<{ quantity: number }>();
      const childId = crypto.randomUUID();
      await runtimeEnv.DB.batch([
        trace.statement,
        runtimeEnv.DB.prepare(`
          UPDATE production_batches
          SET status='completed',completed_at=?,updated_at=?
          WHERE id=?
        `).bind(now, now, current.id),
        runtimeEnv.DB.prepare(`
          INSERT INTO production_batches(
            id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,
            required_quantity,available_quantity_at_start,additional_needed,production_target,
            produced_quantity,traceability_no,origin,slaughterhouse,cattle_type,grade,
            storage_method,expiry_text,packaging_material,food_type,status,started_by,started_at,
            created_at,updated_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,'in_progress',?,?,?,?)
        `).bind(
          childId,
          current.production_date,
          current.parent_batch_id ?? current.id,
          current.segment_no + 1,
          current.component_code,
          current.cut_name_snapshot,
          current.required_quantity,
          Number(available?.quantity ?? 0),
          current.additional_needed,
          productionTarget,
          trace.traceabilityNo,
          trace.origin,
          trace.slaughterhouse,
          trace.cattleType,
          trace.grade,
          optionalText(payload.storageMethod) || current.storage_method,
          optionalText(payload.expiryText) || current.expiry_text,
          optionalText(payload.packagingMaterial) || current.packaging_material,
          optionalText(payload.foodType) || current.food_type,
          OPERATOR_ACTOR,
          now,
          now,
          now,
        ),
      ]);
      return Response.json({ ok: true, batchId: childId });
    }

    if (payload.action === "create_skin_pack") {
      const weightG = Number(payload.weightG);
      const idempotencyKey = payload.idempotencyKey?.trim() ?? "";
      if (!payload.batchId || !validateSkinPackWeight(weightG) || !idempotencyKey) {
        return Response.json({ error: "생산 batch·중량·중복방지 키를 확인해주세요." }, { status: 400 });
      }
      const prior = await runtimeEnv.DB.prepare(`
        SELECT id,skin_pack_code
        FROM skin_packs
        WHERE idempotency_key=?
      `).bind(idempotencyKey).first<ExistingPack>();
      if (prior) return Response.json({ ok: true, skinPackId: prior.id, skinPackCode: prior.skin_pack_code, alreadyApplied: true });

      const batch = await runtimeEnv.DB.prepare(`
        SELECT
          id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,
          required_quantity,available_quantity_at_start,additional_needed,production_target,
          produced_quantity,traceability_no,origin,slaughterhouse,cattle_type,grade,
          storage_method,expiry_text,packaging_material,food_type,status
        FROM production_batches
        WHERE id=?
      `).bind(payload.batchId).first<BatchRow>();
      if (!batch) return Response.json({ error: "생산 batch를 찾을 수 없습니다." }, { status: 404 });

      const next = await runtimeEnv.DB.prepare(`
        SELECT COALESCE(MAX(batch_sequence),0)+1 AS sequence
        FROM skin_packs
        WHERE production_batch_id=?
      `).bind(batch.id).first<{ sequence: number }>();
      const codeNext = await runtimeEnv.DB.prepare(`
        SELECT COALESCE(MAX(CAST(substr(skin_pack_code,length(?)+1) AS INTEGER)),0)+1 AS sequence
        FROM skin_packs
        WHERE skin_pack_code LIKE ?
      `).bind(
        `${batch.component_code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "SP"}-${batch.production_date.replaceAll("-", "").slice(2)}-`,
        `${batch.component_code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "SP"}-${batch.production_date.replaceAll("-", "").slice(2)}-%`,
      ).first<{ sequence: number }>();
      const sequence = Number(next?.sequence ?? 1);
      const skinPackId = crypto.randomUUID();
      const skinPackCode = buildSkinPackCode(batch.component_code, batch.production_date, Number(codeNext?.sequence ?? 1));
      const label: SkinPackLabelPayload = {
        skinPackCode,
        cutName: batch.cut_name_snapshot,
        weightG,
        traceabilityNo: batch.traceability_no,
        origin: batch.origin,
        slaughterhouse: batch.slaughterhouse,
        grade: batch.grade,
        manufacturedAt: now,
        storageMethod: batch.storage_method,
        expiryText: batch.expiry_text,
        packagingMaterial: batch.packaging_material,
        foodType: batch.food_type,
      };
      await runtimeEnv.DB.batch([
        runtimeEnv.DB.prepare(`
          INSERT INTO skin_packs(
            id,production_batch_id,batch_sequence,skin_pack_code,component_code,cut_name_snapshot,
            weight_g,traceability_no,origin,slaughterhouse,cattle_type,grade,manufactured_at,
            storage_method,expiry_text,packaging_material,food_type,status,idempotency_key,
            created_by,created_at,updated_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'available',?,?,?,?)
        `).bind(
          skinPackId,
          batch.id,
          sequence,
          skinPackCode,
          batch.component_code,
          batch.cut_name_snapshot,
          weightG,
          batch.traceability_no,
          batch.origin,
          batch.slaughterhouse,
          batch.cattle_type,
          batch.grade,
          now,
          batch.storage_method,
          batch.expiry_text,
          batch.packaging_material,
          batch.food_type,
          idempotencyKey,
          OPERATOR_ACTOR,
          now,
          now,
        ),
        runtimeEnv.DB.prepare(`
          INSERT INTO skin_pack_labels(id,skin_pack_id,version,status,payload_json,created_by,created_at)
          VALUES(?,?,1,'draft',?,?,?)
        `).bind(crypto.randomUUID(), skinPackId, JSON.stringify(label), OPERATOR_ACTOR, now),
        runtimeEnv.DB.prepare(`
          UPDATE production_batches
          SET produced_quantity=produced_quantity+1,updated_at=?
          WHERE id=?
        `).bind(now, batch.id),
      ]);
      return Response.json({ ok: true, skinPackId, skinPackCode, label });
    }

    if (payload.action === "complete_batch") {
      if (!payload.batchId) return Response.json({ error: "생산 batch를 선택해주세요." }, { status: 400 });
      const result = await runtimeEnv.DB.prepare(`
        UPDATE production_batches
        SET status='completed',completed_at=?,updated_at=?
        WHERE id=?
      `).bind(now, now, payload.batchId).run();
      if (!result.meta.changes) return Response.json({ error: "생산 batch를 찾을 수 없습니다." }, { status: 404 });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "생산 작업을 저장하지 못했습니다." },
      { status: 400 },
    );
  }
}

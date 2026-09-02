import { env } from "cloudflare:workers";
import { OPERATOR_ACTOR, requireOperatorApi } from "../../../lib/operator-session";

type CancelReasonType = "test" | "customer_cancelled" | "custom";
type WorkStatus = "received" | "confirmed" | "in_progress" | "ready" | "completed" | "cancelled";
type StatusPayload = {
  workItemId?: string;
  status?: WorkStatus;
  expectedVersion?: number;
  cancelReasonType?: CancelReasonType;
  cancelReason?: string;
};
type Current = {
  id: string;
  order_id: string;
  work_status: "received" | "confirmed" | "in_progress" | "ready" | "completed" | "cancelled";
  version: number;
};

const runtimeEnv = env as typeof env & { DB: D1Database };
const WORK_STATUSES: WorkStatus[] = ["received", "confirmed", "in_progress", "ready", "completed", "cancelled"];

export async function PATCH(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  try {
    const payload = await request.json() as StatusPayload;
    const workItemId = payload.workItemId?.trim() ?? "";
    if (!workItemId || !payload.status || !WORK_STATUSES.includes(payload.status) || !Number.isInteger(payload.expectedVersion)) {
      return Response.json({ error: "작업 상태 정보가 올바르지 않습니다." }, { status: 400 });
    }
    let cancellationReason: string | null = null;
    if (payload.status === "cancelled") {
      const customReason = payload.cancelReason?.trim() ?? "";
      if (!payload.cancelReasonType || !["test", "customer_cancelled", "custom"].includes(payload.cancelReasonType)) {
        return Response.json({ error: "취소 사유를 선택해주세요." }, { status: 400 });
      }
      if (customReason.length > 200) {
        return Response.json({ error: "직접입력 사유는 200자 이하로 입력해주세요." }, { status: 400 });
      }
      if (payload.cancelReasonType === "custom" && !customReason) {
        return Response.json({ error: "직접입력 취소 사유를 입력해주세요." }, { status: 400 });
      }
      cancellationReason = payload.cancelReasonType === "test"
        ? "테스트"
        : payload.cancelReasonType === "customer_cancelled"
          ? "취소"
          : customReason;
    }

    const current = await runtimeEnv.DB.prepare(
      "SELECT id,order_id,work_status,version FROM work_items WHERE id=?",
    ).bind(workItemId).first<Current>();
    if (!current) return Response.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
    if (current.version !== payload.expectedVersion) {
      return Response.json({
        error: "다른 직원이 먼저 수정했습니다. 최신 내용을 다시 확인해주세요.",
        latestVersion: current.version,
      }, { status: 409 });
    }

    const now = new Date().toISOString();
    const result = await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(`
        UPDATE work_items
        SET work_status=?,version=version+1,updated_at=?
        WHERE id=? AND version=? AND work_status=?
      `).bind(payload.status, now, workItemId, payload.expectedVersion, current.work_status),
      runtimeEnv.DB.prepare(`
        INSERT INTO work_item_events(
          id,work_item_id,order_id,event_type,from_value,to_value,actor,created_at
        ) VALUES(?,?,?,'work_status_changed',?,?,?,?)
      `).bind(
        crypto.randomUUID(),
        current.id,
        current.order_id,
        JSON.stringify({ workStatus: current.work_status }),
        JSON.stringify({
          workStatus: payload.status,
          cancellationReason,
          cancelReasonType: payload.status === "cancelled" ? payload.cancelReasonType : null,
        }),
        OPERATOR_ACTOR,
        now,
      ),
    ]);
    if (!result[0].meta.changes) {
      return Response.json({ error: "작업 상태가 이미 변경되었습니다. 최신 내용을 다시 확인해주세요." }, { status: 409 });
    }
    return Response.json({ ok: true, status: payload.status, version: current.version + 1 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "작업 상태를 변경하지 못했습니다." },
      { status: 500 },
    );
  }
}

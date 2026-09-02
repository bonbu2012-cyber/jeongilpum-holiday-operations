import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

type CancelReasonType = "test" | "customer_cancelled" | "custom";
type WorkStatus = "confirmed" | "in_progress" | "ready" | "completed" | "cancelled";
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

const runtimeEnv = env as typeof env & {
  DB: D1Database;
  OPERATOR_USER_IDS?: string;
  OPERATOR_EMAILS?: string;
};
const allowed: Record<Current["work_status"], WorkStatus[]> = {
  received: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function configured(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function isOperator(user: { userId: string; email: string }) {
  return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId)
    || configured(runtimeEnv.OPERATOR_EMAILS)
      .map((value) => value.toLowerCase())
      .includes(user.email.toLowerCase());
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user)) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });

  try {
    const payload = await request.json() as StatusPayload;
    const workItemId = payload.workItemId?.trim() ?? "";
    if (!workItemId || !payload.status || !Number.isInteger(payload.expectedVersion)) {
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
    if (!allowed[current.work_status].includes(payload.status)) {
      return Response.json({ error: "현재 단계에서 허용되지 않는 변경입니다." }, { status: 409 });
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
        user.userId,
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

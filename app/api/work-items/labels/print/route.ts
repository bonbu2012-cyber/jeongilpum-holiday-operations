import { getDb } from "../../../../../db/index.ts";
import { OPERATOR_ACTOR, requireOperatorApi } from "../../../../lib/operator-session";

export const dynamic = "force-dynamic";

type PrintPayload = {
  workItemIds?: unknown;
  labelSize?: unknown;
};

const runtimeEnv = { DB: getDb() };

function seoulDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}+09:00`;
}

export async function POST(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  try {
    const payload = (await request.json().catch(() => ({}))) as PrintPayload;
    if (!Array.isArray(payload.workItemIds) || !payload.workItemIds.length) {
      return Response.json({ error: "인쇄할 작업 항목 ID 목록을 전달해주세요." }, { status: 400 });
    }

    const workItemIds = payload.workItemIds
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);

    if (!workItemIds.length) {
      return Response.json({ error: "유효한 작업 항목 ID가 없습니다." }, { status: 400 });
    }

    if (workItemIds.length > 500) {
      return Response.json({ error: "한 번에 최대 500개까지 인쇄 기록이 가능합니다." }, { status: 400 });
    }

    const labelSize = payload.labelSize === "50x50" ? "50x50" : "80x100";

    // work_items에서 order_id 확인
    const placeholders = workItemIds.map(() => "?").join(",");
    const rows = await runtimeEnv.DB.prepare(`
      SELECT w.id, w.order_id
      FROM work_items w
      WHERE w.id IN (${placeholders})
    `).bind(...workItemIds).all<{ id: string; order_id: string }>();

    if (!rows.results.length) {
      return Response.json({ error: "해당하는 작업 항목을 찾을 수 없습니다." }, { status: 404 });
    }

    const now = seoulDateTime(new Date());
    const statements = rows.results.map((row) => {
      const eventId = crypto.randomUUID();
      const toValue = JSON.stringify({
        labelSize,
        printedAt: now,
      });
      return runtimeEnv.DB.prepare(`
        INSERT INTO work_item_events (
          id, work_item_id, order_id, event_type, from_value, to_value, actor, created_at
        ) VALUES (?, ?, ?, 'label_printed', NULL, ?, ?, ?)
      `).bind(eventId, row.id, row.order_id, toValue, OPERATOR_ACTOR, now);
    });

    await runtimeEnv.DB.batch(statements);

    return Response.json({
      success: true,
      count: rows.results.length,
      printedAt: now,
      labelSize,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "라벨 인쇄 기록에 실패했습니다." },
      { status: 500 }
    );
  }
}

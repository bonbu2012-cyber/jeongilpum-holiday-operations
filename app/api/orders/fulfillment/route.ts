import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

type Payload = {
  workItemId?: string;
  fulfillmentType?: "pickup" | "shipping";
  pickupDate?: string;
  pickupTime?: string;
  shipDate?: string;
  expectedVersion?: number;
};

type WorkItem = {
  id: string;
  order_id: string;
  delivery_method: "onsite_sale" | "onsite_reservation" | "delivery";
  due_at: string;
  version: number;
};

const runtimeEnv = env as typeof env & {
  DB: D1Database;
  OPERATOR_USER_IDS?: string;
  OPERATOR_EMAILS?: string;
};
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function configured(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function isOperator(user: { userId: string; email: string }) {
  return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId)
    || configured(runtimeEnv.OPERATOR_EMAILS)
      .map((value) => value.toLowerCase())
      .includes(user.email.toLowerCase());
}

function validIsoDate(value: string) {
  if (!isoDatePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validPickupTime(value: string) {
  const match = /^(\d{2}):(00|30)$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  return hour >= 8 && hour <= 21 && (hour < 21 || match[2] === "00");
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user)) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });

  try {
    const payload = await request.json() as Payload;
    const workItemId = payload.workItemId?.trim() ?? "";
    if (!workItemId || !payload.fulfillmentType) {
      return Response.json({ error: "작업과 수령방법을 확인해주세요." }, { status: 400 });
    }
    const pickupDate = payload.pickupDate?.trim() ?? "";
    const pickupTime = payload.pickupTime?.trim() ?? "";
    const shipDate = payload.shipDate?.trim() ?? "";
    if (payload.fulfillmentType === "pickup" && (!validIsoDate(pickupDate) || !validPickupTime(pickupTime))) {
      return Response.json({ error: "방문 날짜와 시간을 확인해주세요." }, { status: 400 });
    }
    if (payload.fulfillmentType === "shipping" && !validIsoDate(shipDate)) {
      return Response.json({ error: "발송 날짜를 확인해주세요." }, { status: 400 });
    }

    const current = await runtimeEnv.DB.prepare(
      "SELECT id,order_id,delivery_method,due_at,version FROM work_items WHERE id=?",
    ).bind(workItemId).first<WorkItem>();
    if (!current) return Response.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
    if (Number.isInteger(payload.expectedVersion) && current.version !== payload.expectedVersion) {
      return Response.json({
        error: "다른 직원이 먼저 수정했습니다. 최신 내용을 다시 확인해주세요.",
        latestVersion: current.version,
      }, { status: 409 });
    }

    const deliveryMethod = payload.fulfillmentType === "pickup" ? "onsite_reservation" : "delivery";
    const dueAt = payload.fulfillmentType === "pickup"
      ? `${pickupDate}T${pickupTime}:00+09:00`
      : `${shipDate}T00:00:00+09:00`;
    const now = new Date().toISOString();
    const result = await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(`
        UPDATE work_items
        SET delivery_method=?,due_at=?,version=version+1,updated_at=?
        WHERE id=? AND version=?
      `).bind(deliveryMethod, dueAt, now, current.id, current.version),
      runtimeEnv.DB.prepare(`
        INSERT INTO work_item_events(
          id,work_item_id,order_id,event_type,from_value,to_value,actor,created_at
        ) VALUES(?,?,?,'schedule_changed',?,?,?,?)
      `).bind(
        crypto.randomUUID(),
        current.id,
        current.order_id,
        JSON.stringify({ deliveryMethod: current.delivery_method, dueAt: current.due_at }),
        JSON.stringify({ deliveryMethod, dueAt }),
        user.userId,
        now,
      ),
    ]);
    if (!result[0].meta.changes) {
      return Response.json({ error: "작업 일정이 이미 변경되었습니다. 최신 내용을 다시 확인해주세요." }, { status: 409 });
    }
    return Response.json({
      workItemId: current.id,
      fulfillmentType: payload.fulfillmentType,
      dueAt,
      version: current.version + 1,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "일정을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}

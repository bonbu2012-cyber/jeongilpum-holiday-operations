import { getDb } from "../../../db";
import { kioskEvents } from "../../../db/schema";

type Payload = { sessionId?: string; eventType?: string; value?: string | null };

const eventTypes = new Set([
  "welcome_recommendation_selected",
  "welcome_browse_selected",
  "recommendation_category_selected",
  "beef_purpose_selected",
  "vacuum_product_selected",
  "recommended_product_selected",
  "product_detail_entered",
  "order_clicked",
  "order_completed",
]);

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Payload;
    const sessionId = payload.sessionId?.trim() ?? "";
    const eventType = payload.eventType?.trim() ?? "";
    const value = typeof payload.value === "string" ? payload.value.trim().slice(0, 120) : null;
    if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !eventTypes.has(eventType)) {
      return Response.json({ error: "올바르지 않은 키오스크 이벤트입니다." }, { status: 400 });
    }
    await getDb().insert(kioskEvents).values({
      id: crypto.randomUUID(),
      sessionId,
      eventType,
      value: value || null,
      createdAt: new Date().toISOString(),
    });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "키오스크 이벤트를 저장하지 못했습니다." }, { status: 500 });
  }
}

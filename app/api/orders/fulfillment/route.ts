import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

type Payload = {
  orderId?: string;
  fulfillmentType?: "pickup" | "shipping";
  pickupDate?: string;
  pickupTime?: string;
  shipDate?: string;
};

type LegacyOrder = {
  id: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  road_address: string | null;
  detail_address: string | null;
  customer_note: string;
};

type OrderItem = { id: string; quantity: number };

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
  return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId) ||
    configured(runtimeEnv.OPERATOR_EMAILS).map((value) => value.toLowerCase()).includes(user.email.toLowerCase());
}

function validIsoDate(value: string) {
  if (!isoDatePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validPickupTime(value: string) {
  const match = /^(\d{2}):(00|30)$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  return hour >= 8 && hour <= 21 && (hour < 21 || match[2] === "00");
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user))
    return Response.json(
      { error: "운영자 권한이 없습니다." },
      { status: 403 },
    );

  try {
    const payload = (await request.json()) as Payload;
    const orderId = payload.orderId?.trim() ?? "";
    const fulfillmentType = payload.fulfillmentType;
    if (!orderId || !fulfillmentType) {
      return Response.json(
        { error: "주문과 수령방법을 확인해주세요." },
        { status: 400 },
      );
    }

    const pickupDate = payload.pickupDate?.trim() ?? "";
    const pickupTime = payload.pickupTime?.trim() ?? "";
    const shipDate = payload.shipDate?.trim() ?? "";
    if (
      fulfillmentType === "pickup" &&
      (!validIsoDate(pickupDate) || !validPickupTime(pickupTime))
    ) {
      return Response.json(
        { error: "방문 날짜와 시간을 확인해주세요." },
        { status: 400 },
      );
    }
    if (fulfillmentType === "shipping" && !validIsoDate(shipDate)) {
      return Response.json(
        { error: "발송 날짜를 확인해주세요." },
        { status: 400 },
      );
    }

    const order = await runtimeEnv.DB.prepare(
      "SELECT id,recipient_name,recipient_phone,road_address,detail_address,customer_note FROM orders WHERE id=?",
    )
      .bind(orderId)
      .first<LegacyOrder>();
    if (!order)
      return Response.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 },
      );

    const existing = await runtimeEnv.DB.prepare(
      "SELECT id FROM fulfillments WHERE order_id=?",
    )
      .bind(orderId)
      .first<{ id: string }>();
    if (existing)
      return Response.json(
        { error: "이미 일정이 지정된 주문입니다." },
        { status: 409 },
      );

    const items = await runtimeEnv.DB.prepare(
      "SELECT id,quantity FROM order_items WHERE order_id=? ORDER BY created_at",
    )
      .bind(orderId)
      .all<OrderItem>();
    if (!items.results.length)
      return Response.json(
        { error: "주문 상품을 찾을 수 없습니다." },
        { status: 409 },
      );

    const fulfillmentId = crypto.randomUUID();
    const now = new Date().toISOString();
    const pickupAt =
      fulfillmentType === "pickup"
        ? `${pickupDate}T${pickupTime}:00+09:00`
        : null;
    const scheduledShipDate = fulfillmentType === "shipping" ? shipDate : null;

    await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(
        `INSERT INTO fulfillments(
          id,order_id,fulfillment_type,pickup_at,ship_date,
          recipient_name,recipient_phone,road_addr,detail_addr,
          status,customer_arrived,note,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,'scheduled',0,?,?,?)`,
      ).bind(
        fulfillmentId,
        orderId,
        fulfillmentType,
        pickupAt,
        scheduledShipDate,
        order.recipient_name,
        order.recipient_phone,
        order.road_address,
        order.detail_address,
        order.customer_note,
        now,
        now,
      ),
      ...items.results.map((item) =>
        runtimeEnv.DB.prepare(
          "INSERT INTO fulfillment_items(id,fulfillment_id,order_item_id,quantity,created_at) VALUES(?,?,?,?,?)",
        ).bind(
          crypto.randomUUID(),
          fulfillmentId,
          item.id,
          item.quantity,
          now,
        ),
      ),
      runtimeEnv.DB.prepare(
        "INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at) VALUES(?,?,'fulfillment_assigned',?,?,?)",
      ).bind(
        crypto.randomUUID(),
        orderId,
        JSON.stringify({
          fulfillmentId,
          fulfillmentType,
          pickupAt,
          shipDate: scheduledShipDate,
        }),
        user.userId,
        now,
      ),
    ]);

    return Response.json(
      { fulfillmentId, fulfillmentType, pickupAt, shipDate: scheduledShipDate },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "일정을 저장하지 못했습니다.";
    if (message.includes("UNIQUE")) {
      return Response.json(
        { error: "이미 일정이 지정된 주문입니다." },
        { status: 409 },
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

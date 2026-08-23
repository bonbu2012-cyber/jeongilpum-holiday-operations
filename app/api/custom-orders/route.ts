import { env } from "cloudflare:workers";

type Payload = {
  idempotencyKey?: string;
  customerName?: string;
  customerPhone?: string;
  giftType?: string;
  quantity?: number;
  budgetRange?: string;
  fulfillmentPreference?: string;
  preferredSchedule?: string;
  note?: string;
};

type RequestRow = {
  request_no: string;
  customer_name: string;
  customer_phone: string;
  gift_type: string;
  quantity: number;
  budget_range: string;
  fulfillment_preference: string;
  preferred_schedule: string;
  note: string;
  status: string;
  created_at: string;
};

const runtimeEnv = env as typeof env & { DB: D1Database };
const budgets = new Set(["10만원 이하","10–20만원","20–30만원","30만원 이상","상담 후 결정"]);
const fulfillments = new Set(["방문수령","택배발송","방문+택배 혼합"]);

function normalizePhone(value: string) {
  return value.replace(/D/g, "");
}

function createRequestNo() {
  const now = new Date();
  const date = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return "CUSTOM-" + date + "-" + String(Math.floor(1000 + Math.random() * 9000));
}

function serialize(row: RequestRow) {
  return {
    requestNo: row.request_no,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    giftType: row.gift_type,
    quantity: row.quantity,
    budgetRange: row.budget_range,
    fulfillmentPreference: row.fulfillment_preference,
    preferredSchedule: row.preferred_schedule,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Payload;
    const key = payload.idempotencyKey?.trim() ?? "";
    const customerName = payload.customerName?.trim() ?? "";
    const customerPhone = normalizePhone(payload.customerPhone ?? "");
    const giftType = payload.giftType?.trim() ?? "";
    const quantity = Number(payload.quantity);
    const budgetRange = payload.budgetRange?.trim() ?? "";
    const fulfillment = payload.fulfillmentPreference?.trim() ?? "";
    if (!key || !customerName || customerPhone.length < 10 || !giftType || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999 || !budgets.has(budgetRange) || !fulfillments.has(fulfillment)) {
      return Response.json({ error: "필수 맞춤주문 정보를 확인해주세요." }, { status: 400 });
    }

    const existing = await runtimeEnv.DB.prepare("SELECT request_no,customer_name,customer_phone,gift_type,quantity,budget_range,fulfillment_preference,preferred_schedule,note,status,created_at FROM custom_order_requests WHERE idempotency_key=?")
      .bind(key).first<RequestRow>();
    if (existing) return Response.json({ request: serialize(existing), duplicate: true });

    const id = crypto.randomUUID();
    const requestNo = createRequestNo();
    const now = new Date().toISOString();
    const preferredSchedule = payload.preferredSchedule?.trim() ?? "";
    const note = payload.note?.trim() ?? "";
    await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare("INSERT INTO custom_order_requests(id,request_no,customer_name,customer_phone,gift_type,quantity,budget_range,fulfillment_preference,preferred_schedule,note,status,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'submitted',?,?,?)")
        .bind(id, requestNo, customerName, customerPhone, giftType, quantity, budgetRange, fulfillment, preferredSchedule, note, key, now, now),
      runtimeEnv.DB.prepare("INSERT INTO custom_order_events(id,request_id,event_type,after_data,created_at) VALUES(?,?,'custom_order_submitted',?,?)")
        .bind(crypto.randomUUID(), id, JSON.stringify({ giftType, quantity, budgetRange, fulfillmentPreference: fulfillment }), now),
      runtimeEnv.DB.prepare("INSERT INTO operational_alerts(id,type,severity,target_role,order_id,title,message,requires_ack,created_at) VALUES(?,'custom_order','info','sales',NULL,?,?,1,?)")
        .bind(crypto.randomUUID(), "새 맞춤주문 접수", customerName + " · " + giftType + " · " + quantity + "세트", now),
    ]);
    const created = await runtimeEnv.DB.prepare("SELECT request_no,customer_name,customer_phone,gift_type,quantity,budget_range,fulfillment_preference,preferred_schedule,note,status,created_at FROM custom_order_requests WHERE id=?")
      .bind(id).first<RequestRow>();
    return Response.json({ request: created ? serialize(created) : { requestNo } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "맞춤주문을 접수하지 못했습니다.";
    if (message.includes("UNIQUE") || message.includes("idempotency")) {
      return Response.json({ error: "같은 맞춤주문을 확인하고 있습니다. 잠시 후 다시 시도해주세요." }, { status: 409 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
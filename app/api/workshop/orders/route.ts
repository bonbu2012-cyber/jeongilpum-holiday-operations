import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { WORKSHOP_DATE_ORDERS_SQL } from "../../../lib/workshop-operations";

type OrderRow = { id: string; order_no: string; buyer_name_snapshot: string; order_status: string; customer_note: string; version: number; submitted_at: string; fulfillment_id: string; fulfillment_type: "pickup" | "shipping"; pickup_at: string | null; ship_date: string | null; customer_arrived: number; fulfillment_note: string };
type ItemRow = { id: string; order_id: string; product_id: string; product_name_snapshot: string; quantity: number };
type PackageRow = { id: string; order_id: string; product_id: string; package_status: string };
type EventRow = { id: string; order_id: string; event_type: string; reason: string | null; actor_id: string | null; created_at: string };

const runtimeEnv = env as typeof env & { DB: D1Database; OPERATOR_USER_IDS?: string; OPERATOR_EMAILS?: string };
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const changeEvents = new Set(["order_changed", "order_updated", "items_changed", "fulfillment_changed", "schedule_changed"]);
const visibleEvents = new Set(["order_submitted", "status_changed", "CUSTOMER_ARRIVED", "change_acknowledged", "fulfillment_assigned", "WORK_ACCEPTED", "WORK_STARTED", "WORK_COMPLETED", ...changeEvents]);

function configured(value: string | undefined) { return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean); }
function isOperator(user: { userId: string; email: string }) { return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId) || configured(runtimeEnv.OPERATOR_EMAILS).map((value) => value.toLowerCase()).includes(user.email.toLowerCase()); }
function validDate(value: string) {
  if (!isoDatePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}
function scheduleLabel(row: OrderRow) {
  if (row.fulfillment_type === "shipping") return `${row.ship_date ?? "일정 미지정"} 발송`;
  return row.pickup_at ? `${row.pickup_at.slice(0, 10)} ${row.pickup_at.slice(11, 16)} 방문` : "일정 미지정";
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user)) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });
  const date = new URL(request.url).searchParams.get("date")?.trim() ?? "";
  if (!validDate(date)) return Response.json({ error: "조회 날짜 형식을 확인해주세요." }, { status: 400 });
  try {
    const result = await runtimeEnv.DB.prepare(WORKSHOP_DATE_ORDERS_SQL).bind(date, date).all<OrderRow>();
    if (!result.results.length) return Response.json({ orders: [] }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
    const ids = result.results.map((order) => order.id);
    const placeholders = ids.map(() => "?").join(",");
    const [items, packages, events] = await Promise.all([
      runtimeEnv.DB.prepare(`SELECT id,order_id,product_id,product_name_snapshot,quantity FROM order_items WHERE order_id IN (${placeholders})`).bind(...ids).all<ItemRow>(),
      runtimeEnv.DB.prepare(`SELECT id,order_id,product_id,package_status FROM packages WHERE order_id IN (${placeholders}) AND package_status!='voided'`).bind(...ids).all<PackageRow>(),
      runtimeEnv.DB.prepare(`SELECT id,order_id,event_type,reason,actor_id,created_at FROM order_events WHERE order_id IN (${placeholders}) ORDER BY created_at DESC,id DESC`).bind(...ids).all<EventRow>(),
    ]);
    const orders = result.results.map((order) => {
      const orderPackages = packages.results.filter((item) => item.order_id === order.id);
      const orderEvents = events.results.filter((event) => event.order_id === order.id && visibleEvents.has(event.event_type));
      const acknowledgedAt = orderEvents.find((event) => event.event_type === "change_acknowledged")?.created_at ?? "";
      const hasUnacknowledgedChange = orderEvents.some((event) => changeEvents.has(event.event_type) && (!acknowledgedAt || event.created_at > acknowledgedAt));
      const workAcceptedAt = orderEvents.find((event) => event.event_type === "WORK_ACCEPTED")?.created_at ?? null;
      const workStartedAt = orderEvents.find((event) => event.event_type === "WORK_STARTED")?.created_at ?? null;
      const workCompletedAt = orderEvents.find((event) => event.event_type === "WORK_COMPLETED")?.created_at ?? null;
      return {
        id: order.id,
        orderNo: order.order_no,
        buyerName: order.buyer_name_snapshot,
        status: order.order_status,
        version: order.version,
        submittedAt: order.submitted_at,
        fulfillmentId: order.fulfillment_id,
        fulfillmentType: order.fulfillment_type,
        pickupAt: order.pickup_at,
        shipDate: order.ship_date,
        scheduleLabel: scheduleLabel(order),
        customerArrived: Boolean(order.customer_arrived),
        note: order.fulfillment_note || order.customer_note,
        items: items.results.filter((item) => item.order_id === order.id).map((item) => {
          const itemPackages = orderPackages.filter((value) => value.product_id === item.product_id);
          return { id: item.id, productId: item.product_id, name: item.product_name_snapshot, quantity: item.quantity, packageTotal: itemPackages.length, packageCompleted: itemPackages.filter((value) => value.package_status === "completed" || value.package_status === "handed_over").length };
        }),
        packageTotal: orderPackages.length,
        packageCompleted: orderPackages.filter((item) => item.package_status === "completed" || item.package_status === "handed_over").length,
        hasUnacknowledgedChange,
        workAcceptedAt,
        workStartedAt,
        workCompletedAt,
        events: orderEvents.map((event) => ({ id: event.id, type: event.event_type, reason: event.reason, actorId: event.actor_id, createdAt: event.created_at })),
      };
    });
    return Response.json({ orders }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "작업 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

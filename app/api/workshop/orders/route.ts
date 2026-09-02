import { env } from "cloudflare:workers";
import type { OrderStatus } from "../../../components/types";
import { requireOperatorApi } from "../../../lib/operator-session";
import { arrivalOffsetMinutes, findSubstituteCandidates, WORKSHOP_DATE_ORDERS_SQL } from "../../../lib/workshop-operations";
import type { WorkshopOrder } from "../../../lib/workshop-types";

type OrderRow = { id: string; order_no: string; buyer_name_snapshot: string; order_status: OrderStatus; customer_note: string; version: number; submitted_at: string; fulfillment_id: string; fulfillment_type: "pickup" | "shipping"; pickup_at: string | null; ship_date: string | null; customer_arrived: number; fulfillment_note: string };
type ItemRow = { id: string; order_id: string; product_id: string; product_name_snapshot: string; quantity: number };
type FulfillmentItemRow = { fulfillment_id: string; order_item_id: string; quantity: number };
type PackageRow = { id: string; package_code: string; order_id: string; order_item_id: string | null; product_id: string; product_name_snapshot: string; package_status: string };
type EventRow = { id: string; order_id: string; event_type: string; reason: string | null; after_data: string | null; actor_id: string | null; created_at: string };
type CustomizationRow = { order_item_id: string };

const runtimeEnv = env as typeof env & { DB: D1Database };
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const changeEvents = new Set(["order_changed", "order_updated", "items_changed", "fulfillment_changed", "schedule_changed"]);
const visibleEvents = new Set(["order_submitted", "status_changed", "CUSTOMER_ARRIVED", "change_acknowledged", "fulfillment_assigned", "WORK_ACCEPTED", "WORK_STARTED", "WORK_COMPLETED", "PACKAGE_REASSIGNED", ...changeEvents]);

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
function reassignedPackageIds(event: EventRow) {
  if (event.event_type !== "PACKAGE_REASSIGNED" || !event.after_data) return [];
  try {
    const data = JSON.parse(event.after_data) as { packageId?: string; replacementPackageId?: string };
    return [data.packageId, data.replacementPackageId].filter((value): value is string => Boolean(value));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;
  const date = new URL(request.url).searchParams.get("date")?.trim() ?? "";
  if (!validDate(date)) return Response.json({ error: "조회 날짜 형식을 확인해주세요." }, { status: 400 });
  try {
    const result = await runtimeEnv.DB.prepare(WORKSHOP_DATE_ORDERS_SQL).bind(date, date).all<OrderRow>();
    if (!result.results.length) return Response.json({ orders: [] }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
    const ids = result.results.map((order) => order.id);
    const fulfillmentIds = result.results.map((order) => order.fulfillment_id);
    const placeholders = ids.map(() => "?").join(",");
    const fulfillmentPlaceholders = fulfillmentIds.map(() => "?").join(",");
    const [items, fulfillmentItems, packages, events, customizations] = await Promise.all([
      runtimeEnv.DB.prepare(`SELECT id,order_id,product_id,product_name_snapshot,quantity FROM order_items WHERE order_id IN (${placeholders})`).bind(...ids).all<ItemRow>(),
      runtimeEnv.DB.prepare(`SELECT fulfillment_id,order_item_id,quantity FROM fulfillment_items WHERE fulfillment_id IN (${fulfillmentPlaceholders})`).bind(...fulfillmentIds).all<FulfillmentItemRow>(),
      runtimeEnv.DB.prepare(`SELECT id,package_code,order_id,order_item_id,product_id,product_name_snapshot,package_status FROM packages WHERE order_id IN (${placeholders}) AND package_status!='voided'`).bind(...ids).all<PackageRow>(),
      runtimeEnv.DB.prepare(`SELECT id,order_id,event_type,reason,after_data,actor_id,created_at FROM order_events WHERE order_id IN (${placeholders}) ORDER BY created_at DESC,id DESC`).bind(...ids).all<EventRow>(),
      runtimeEnv.DB.prepare(`SELECT c.order_item_id FROM order_item_customizations c JOIN order_items i ON i.id=c.order_item_id WHERE i.order_id IN (${placeholders})`).bind(...ids).all<CustomizationRow>(),
    ]);
    const customizedItemIds = new Set(customizations.results.map((item) => item.order_item_id));
    const orders: WorkshopOrder[] = result.results.map((order) => {
      const orderPackages = packages.results.filter((item) => item.order_id === order.id);
      const allOrderEvents = events.results.filter((event) => event.order_id === order.id);
      const orderEvents = allOrderEvents.filter((event) => visibleEvents.has(event.event_type));
      const acknowledgedAt = orderEvents.find((event) => event.event_type === "change_acknowledged")?.created_at ?? "";
      const unacknowledgedChanges = orderEvents.filter((event) => changeEvents.has(event.event_type) && (!acknowledgedAt || event.created_at > acknowledgedAt));
      const acceptedEvent = orderEvents.find((event) => event.event_type === "WORK_ACCEPTED");
      const startedEvent = orderEvents.find((event) => event.event_type === "WORK_STARTED");
      const completedEvent = orderEvents.find((event) => event.event_type === "WORK_COMPLETED");
      const actualArrivedAt = orderEvents.find((event) => event.event_type === "CUSTOMER_ARRIVED")?.created_at ?? null;
      const latestChangeAt = unacknowledgedChanges[0]?.created_at ?? null;
      const changeSeverity = !latestChangeAt ? null : startedEvent && latestChangeAt > startedEvent.created_at ? "after_start" : "before_start";
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
        actualArrivedAt,
        arrivalOffsetMinutes: arrivalOffsetMinutes(order.pickup_at, actualArrivedAt),
        note: order.fulfillment_note || order.customer_note,
        hasSpecialRequest: Boolean(order.fulfillment_note.trim() || order.customer_note.trim()),
        items: items.results.filter((item) => item.order_id === order.id).map((item) => {
          const itemPackages = orderPackages.filter((value) => value.product_id === item.product_id);
          const fulfillmentItem = fulfillmentItems.results.find((value) => value.fulfillment_id === order.fulfillment_id && value.order_item_id === item.id);
          return {
            id: item.id,
            productId: item.product_id,
            name: item.product_name_snapshot,
            quantity: fulfillmentItem?.quantity ?? item.quantity,
            packageTotal: itemPackages.length,
            packageCompleted: itemPackages.filter((value) => value.package_status === "completed" || value.package_status === "handed_over").length,
            hasCustomization: customizedItemIds.has(item.id),
          };
        }),
        packages: orderPackages.map((item) => ({ id: item.id, packageCode: item.package_code, productId: item.product_id, productName: item.product_name_snapshot, packageStatus: item.package_status })),
        packageTotal: orderPackages.length,
        packageCompleted: orderPackages.filter((item) => item.package_status === "completed" || item.package_status === "handed_over").length,
        hasUnacknowledgedChange: unacknowledgedChanges.length > 0,
        changeSeverity,
        workAcceptedAt: acceptedEvent?.created_at ?? null,
        workAcceptedBy: acceptedEvent?.actor_id ?? null,
        workStartedAt: startedEvent?.created_at ?? null,
        workCompletedAt: completedEvent?.created_at ?? null,
        substituteCandidates: [],
        events: orderEvents.map((event) => ({ id: event.id, type: event.event_type, reason: event.reason, actorId: event.actor_id, createdAt: event.created_at })),
      };
    });
    const reassignedIds = new Set(events.results.flatMap(reassignedPackageIds));
    const candidates = findSubstituteCandidates(orders, packages.results.map((item) => ({ id: item.id, packageCode: item.package_code, orderId: item.order_id, productId: item.product_id, packageStatus: item.package_status })), reassignedIds);
    return Response.json({ orders: orders.map((order) => ({ ...order, substituteCandidates: candidates.get(order.id) ?? [] })) }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "작업 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

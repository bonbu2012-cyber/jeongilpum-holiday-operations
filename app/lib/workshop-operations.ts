import type { WorkshopOrder } from "./workshop-types";

export const WORKSHOP_DATE_ORDERS_SQL = "SELECT o.id,o.order_no,o.buyer_name_snapshot,o.order_status,o.customer_note,o.version,o.submitted_at,f.id AS fulfillment_id,f.fulfillment_type,f.pickup_at,f.ship_date,f.customer_arrived,f.note AS fulfillment_note FROM orders o JOIN fulfillments f ON f.order_id=o.id WHERE o.order_status IN ('submitted','confirmed','in_progress','ready') AND ((f.fulfillment_type='pickup' AND substr(f.pickup_at,1,10)=?) OR (f.fulfillment_type='shipping' AND f.ship_date=?)) ORDER BY o.created_at ASC LIMIT 500";

export type WorkshopTab = "orders" | "products" | "completed";
export type WorkshopAction = "accept" | "start" | "complete";

export function workshopScheduleDate(order: WorkshopOrder) {
  return order.fulfillmentType === "pickup" ? order.pickupAt?.slice(0, 10) ?? "" : order.shipDate ?? "";
}

export function workshopScheduleTime(order: WorkshopOrder) {
  return order.fulfillmentType === "pickup" ? order.pickupAt?.slice(11, 16) ?? "미지정" : "발송";
}

export function isWorkshopDueSoon(order: WorkshopOrder, now: Date) {
  if (order.fulfillmentType !== "pickup" || !order.pickupAt || order.status === "ready") return false;
  const difference = new Date(order.pickupAt).getTime() - now.getTime();
  return difference >= 0 && difference <= 30 * 60 * 1000;
}

export function workshopPriorityRank(order: WorkshopOrder, now: Date) {
  if (order.customerArrived && order.status !== "ready") return 0;
  if (isWorkshopDueSoon(order, now)) return 1;
  if (order.hasUnacknowledgedChange && order.status !== "ready") return 2;
  if (order.status === "in_progress" || (order.status === "confirmed" && order.workAcceptedAt)) return 3;
  if (order.status === "submitted" || order.status === "confirmed") return 4;
  if (order.status === "ready") return 5;
  return 6;
}

export function sortWorkshopOrders(orders: WorkshopOrder[], now = new Date()) {
  return [...orders].sort((left, right) => {
    const rank = workshopPriorityRank(left, now) - workshopPriorityRank(right, now);
    if (rank) return rank;
    const schedule = (left.pickupAt ?? left.shipDate ?? "9999").localeCompare(right.pickupAt ?? right.shipDate ?? "9999");
    if (schedule) return schedule;
    return left.submittedAt.localeCompare(right.submittedAt);
  });
}

export function summarizeWorkshopOrders(orders: WorkshopOrder[]) {
  return {
    total: orders.length,
    waiting: orders.filter((order) => order.status === "submitted" || order.status === "confirmed").length,
    inProgress: orders.filter((order) => order.status === "in_progress").length,
    completed: orders.filter((order) => order.status === "ready").length,
    arrived: orders.filter((order) => order.customerArrived && order.status !== "ready").length,
    changes: orders.filter((order) => order.hasUnacknowledgedChange && order.status !== "ready").length,
  };
}

export function aggregateWorkshopProducts(orders: WorkshopOrder[]) {
  const products = new Map<string, { productId: string; name: string; total: number; completed: number; remaining: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = products.get(item.productId) ?? { productId: item.productId, name: item.name, total: 0, completed: 0, remaining: 0 };
      current.total += item.quantity;
      current.completed += Math.min(item.quantity, item.packageCompleted);
      current.remaining = Math.max(0, current.total - current.completed);
      products.set(item.productId, current);
    }
  }
  return [...products.values()].sort((left, right) => right.remaining - left.remaining || left.name.localeCompare(right.name));
}

export function workshopStatusLabel(order: WorkshopOrder) {
  if (order.status === "ready") return "준비완료";
  if (order.status === "in_progress") return "작업중";
  if (order.status === "confirmed" && order.workAcceptedAt) return "작업수락";
  if (order.status === "confirmed") return "작업대기";
  return "판매장 확인 대기";
}

export function workshopActionEventType(action: WorkshopAction) {
  return action === "accept" ? "WORK_ACCEPTED" : action === "start" ? "WORK_STARTED" : "WORK_COMPLETED";
}

export function workshopActionNextStatus(action: WorkshopAction) {
  return action === "complete" ? "ready" : action === "start" ? "in_progress" : "confirmed";
}

export function canApplyWorkshopAction(order: Pick<WorkshopOrder, "status" | "workAcceptedAt">, action: WorkshopAction) {
  if (action === "accept") return order.status === "confirmed" && !order.workAcceptedAt;
  if (action === "start") return order.status === "confirmed" && Boolean(order.workAcceptedAt);
  return order.status === "in_progress";
}

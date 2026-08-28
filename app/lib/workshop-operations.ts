import type { OrderStatus } from "../components/types";
import type { SubstituteCandidate, WorkshopItem, WorkshopOrder } from "./workshop-types";

export const WORKSHOP_DATE_ORDERS_SQL = "SELECT o.id,o.order_no,o.buyer_name_snapshot,o.order_status,o.customer_note,o.version,o.submitted_at,f.id AS fulfillment_id,f.fulfillment_type,f.pickup_at,f.ship_date,f.customer_arrived,f.note AS fulfillment_note FROM orders o JOIN fulfillments f ON f.order_id=o.id WHERE o.order_status IN ('submitted','confirmed','in_progress','ready') AND ((f.fulfillment_type='pickup' AND substr(f.pickup_at,1,10)=?) OR (f.fulfillment_type='shipping' AND f.ship_date=?)) ORDER BY o.created_at ASC LIMIT 500";

export type WorkshopTab = "timeline" | "products" | "completed";
export type WorkshopAction = "accept" | "start" | "complete";
export type SubstituteOrderInput = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  fulfillmentType: "pickup" | "shipping";
  pickupAt: string | null;
  actualArrivedAt: string | null;
  hasSpecialRequest: boolean;
  items: { productId: string; name: string; hasCustomization: boolean }[];
};
export type SubstitutePackageInput = { id: string; packageCode: string; orderId: string; productId: string; packageStatus: string };

export function workshopScheduleDate(order: WorkshopOrder) {
  return order.fulfillmentType === "pickup" ? order.pickupAt?.slice(0, 10) ?? "" : order.shipDate ?? "";
}

export function workshopScheduleTime(order: WorkshopOrder) {
  return order.fulfillmentType === "pickup" ? order.pickupAt?.slice(11, 16) ?? "미지정" : "택배";
}

export function pickupUrgency(order: Pick<WorkshopOrder, "fulfillmentType" | "pickupAt" | "status">, now: Date) {
  if (order.status === "ready" || order.fulfillmentType !== "pickup" || !order.pickupAt) return null;
  const minutes = Math.ceil((new Date(order.pickupAt).getTime() - now.getTime()) / 60000);
  if (minutes < 0) return { level: "urgent" as const, minutes, label: `긴급 · ${Math.abs(minutes)}분 지연` };
  if (minutes <= 15) return { level: "urgent" as const, minutes, label: `긴급 · ${minutes}분` };
  if (minutes <= 30) return { level: "due" as const, minutes, label: `임박 · ${minutes}분` };
  if (minutes <= 60) return { level: "hour" as const, minutes, label: `1시간 이내 · ${minutes}분` };
  return null;
}

export function isWorkshopDueSoon(order: WorkshopOrder, now: Date) {
  const urgency = pickupUrgency(order, now);
  return urgency?.level === "urgent" || urgency?.level === "due";
}

export function dueSoonLabel(order: WorkshopOrder, now: Date) {
  return pickupUrgency(order, now)?.label ?? null;
}

export function workshopPriorityRank(order: WorkshopOrder, now: Date) {
  if (order.customerArrived && order.status !== "ready") return 0;
  const urgency = pickupUrgency(order, now);
  if (urgency?.level === "urgent") return 1;
  if (urgency?.level === "due") return 2;
  if (order.hasUnacknowledgedChange && order.status !== "ready") return 3;
  if (order.status === "in_progress") return 4;
  if (order.status === "confirmed" && order.workAcceptedAt) return 5;
  if (order.status === "submitted" || order.status === "confirmed") return 6;
  if (order.status === "ready") return 7;
  return 8;
}

export function sortWorkshopOrders(orders: WorkshopOrder[], now = new Date()) {
  return [...orders].sort((left, right) => {
    const rank = workshopPriorityRank(left, now) - workshopPriorityRank(right, now);
    if (rank) return rank;
    return timelineSortKey(left).localeCompare(timelineSortKey(right)) || left.submittedAt.localeCompare(right.submittedAt);
  });
}

export function timelineSortKey(order: WorkshopOrder) {
  if (order.fulfillmentType === "pickup") return `0-${order.pickupAt ?? "9999"}`;
  return `1-${order.shipDate ?? "9999"}-${order.submittedAt}`;
}

export function sortTimelineOrders(orders: WorkshopOrder[]) {
  return [...orders].sort((left, right) => timelineSortKey(left).localeCompare(timelineSortKey(right)) || left.submittedAt.localeCompare(right.submittedAt));
}

export function filterWorkshopOrdersByProduct(orders: WorkshopOrder[], productId: string | null) {
  if (!productId) return orders;
  return orders.filter((order) => order.items.some((item) => item.productId === productId));
}

export function summarizeWorkshopOrders(orders: WorkshopOrder[]) {
  return {
    total: orders.length,
    waiting: orders.filter((order) => order.status === "submitted" || (order.status === "confirmed" && !order.workAcceptedAt)).length,
    accepted: orders.filter((order) => order.status === "confirmed" && Boolean(order.workAcceptedAt)).length,
    inProgress: orders.filter((order) => order.status === "in_progress").length,
    completed: orders.filter((order) => order.status === "ready").length,
    arrived: orders.filter((order) => order.customerArrived && order.status !== "ready").length,
    changes: orders.filter((order) => order.hasUnacknowledgedChange && order.status !== "ready").length,
  };
}

export function completedQuantityForItem(order: Pick<WorkshopOrder, "status">, item: WorkshopItem) {
  if (item.packageTotal > 0) return Math.min(item.quantity, item.packageCompleted);
  return order.status === "ready" ? item.quantity : 0;
}

export function aggregateWorkshopProducts(orders: WorkshopOrder[]) {
  const products = new Map<string, { productId: string; name: string; total: number; completed: number; remaining: number; nextDueAt: string | null }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = products.get(item.productId) ?? { productId: item.productId, name: item.name, total: 0, completed: 0, remaining: 0, nextDueAt: null };
      const completed = completedQuantityForItem(order, item);
      current.total += item.quantity;
      current.completed += completed;
      current.remaining = Math.max(0, current.total - current.completed);
      if (completed < item.quantity) {
        const dueAt = order.fulfillmentType === "pickup" ? order.pickupAt : order.shipDate;
        if (dueAt && (!current.nextDueAt || dueAt < current.nextDueAt)) current.nextDueAt = dueAt;
      }
      products.set(item.productId, current);
    }
  }
  return [...products.values()].sort((left, right) => {
    if (left.nextDueAt && right.nextDueAt) {
      const due = left.nextDueAt.localeCompare(right.nextDueAt);
      if (due) return due;
    } else if (left.nextDueAt) return -1;
    else if (right.nextDueAt) return 1;
    return right.remaining - left.remaining || left.name.localeCompare(right.name);
  });
}

export function arrivalOffsetMinutes(pickupAt: string | null, actualArrivedAt: string | null) {
  if (!pickupAt || !actualArrivedAt) return null;
  return Math.round((new Date(pickupAt).getTime() - new Date(actualArrivedAt).getTime()) / 60000);
}

export function arrivalTimingLabel(minutes: number | null) {
  if (minutes === null) return "고객도착";
  if (minutes > 0) return `고객 조기도착 · ${minutes}분 빠름`;
  if (minutes < 0) return `고객 도착 · ${Math.abs(minutes)}분 늦음`;
  return "고객 도착 · 예약시간";
}

export function findSubstituteCandidates(orders: SubstituteOrderInput[], packages: SubstitutePackageInput[], reassignedPackageIds = new Set<string>()) {
  const byOrder = new Map<string, SubstituteCandidate[]>();
  for (const target of orders) {
    const earlyMinutes = arrivalOffsetMinutes(target.pickupAt, target.actualArrivedAt);
    if (target.fulfillmentType !== "pickup" || target.status === "ready" || !target.pickupAt || !earlyMinutes || earlyMinutes <= 0 || target.hasSpecialRequest) continue;
    const targetProducts = new Map(target.items.filter((item) => !item.hasCustomization).map((item) => [item.productId, item.name]));
    if (!targetProducts.size) continue;
    const candidates: SubstituteCandidate[] = [];
    for (const value of packages) {
      if (value.packageStatus !== "completed" || value.orderId === target.id || reassignedPackageIds.has(value.id) || !targetProducts.has(value.productId)) continue;
      const pendingReplacement = packages.some((item) => item.orderId === target.id && item.productId === value.productId && ["queued", "in_progress"].includes(item.packageStatus) && !reassignedPackageIds.has(item.id));
      if (!pendingReplacement) continue;
      const source = orders.find((order) => order.id === value.orderId);
      if (!source || source.fulfillmentType !== "pickup" || !source.pickupAt || source.pickupAt.slice(0, 10) !== target.pickupAt.slice(0, 10) || source.pickupAt <= target.pickupAt || source.hasSpecialRequest || ["fulfilled", "cancelled"].includes(source.status)) continue;
      const sourceItem = source.items.find((item) => item.productId === value.productId);
      if (!sourceItem || sourceItem.hasCustomization) continue;
      candidates.push({ packageId: value.id, packageCode: value.packageCode, productId: value.productId, productName: targetProducts.get(value.productId) ?? sourceItem.name, sourceOrderId: source.id, sourceOrderNo: source.orderNo, sourcePickupAt: source.pickupAt });
    }
    if (candidates.length) byOrder.set(target.id, candidates.sort((left, right) => left.sourcePickupAt.localeCompare(right.sourcePickupAt)));
  }
  return byOrder;
}

export function workshopStatusLabel(order: WorkshopOrder) {
  if (order.status === "ready") return "준비완료";
  if (order.status === "in_progress") return "작업중";
  if (order.status === "confirmed" && order.workAcceptedAt) return "수락완료";
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
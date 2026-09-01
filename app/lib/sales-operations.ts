import type { OrderRecord } from "../components/types";

export type SalesFilter = "all" | "onsite" | "pickup" | "shipping" | "incomplete" | "ready";
export type AttentionFilter = "arrived" | "due-soon" | "changes" | null;

export function isTerminalOrder(order: OrderRecord) {
  return order.status === "fulfilled" || order.status === "cancelled";
}

export function workStatusLabel(order: OrderRecord) {
  if (order.status === "cancelled") return "취소";
  if (order.fulfillmentType === "onsite" && order.status === "fulfilled") return "판매완료";
  if (order.status === "fulfilled") return order.fulfillmentType === "shipping" ? "출고완료" : "전달완료";
  if (order.status === "ready") return "준비완료";
  if (order.status === "in_progress") return "작업중";
  if (order.status === "confirmed" && order.workAcceptedAt) return "작업수락";
  return "작업대기";
}

export function scheduleDate(order: OrderRecord) {
  if (order.fulfillmentType === "pickup" || order.fulfillmentType === "onsite") return order.pickupAt?.slice(0, 10) ?? "";
  return order.shipDate ?? "";
}

export function scheduleTime(order: OrderRecord) {
  if (order.fulfillmentType === "shipping") return "발송";
  return order.pickupAt?.slice(11, 16) ?? "미지정";
}

export function isDueWithinThirtyMinutes(order: OrderRecord, now: Date) {
  if (order.fulfillmentType !== "pickup" || !order.pickupAt || isTerminalOrder(order)) return false;
  const difference = new Date(order.pickupAt).getTime() - now.getTime();
  return difference >= 0 && difference <= 30 * 60 * 1000;
}

export function priorityRank(order: OrderRecord, now: Date) {
  if (order.customerArrived && !isTerminalOrder(order)) return 0;
  if (isDueWithinThirtyMinutes(order, now)) return 1;
  if (order.hasUnacknowledgedChange && !isTerminalOrder(order)) return 2;
  if (["submitted", "confirmed", "in_progress"].includes(order.status)) return 3;
  if (order.status === "ready") return 4;
  return 5;
}

export function sortOperationalOrders(orders: OrderRecord[], now = new Date()) {
  return [...orders].sort((left, right) => {
    const priority = priorityRank(left, now) - priorityRank(right, now);
    if (priority) return priority;
    const schedule = (left.pickupAt ?? left.shipDate ?? "9999").localeCompare(right.pickupAt ?? right.shipDate ?? "9999");
    if (schedule) return schedule;
    return left.submittedAt.localeCompare(right.submittedAt);
  });
}

export function filterOperationalOrders(orders: OrderRecord[], filter: SalesFilter, attention: AttentionFilter, now = new Date()) {
  return orders.filter((order) => {
    if (order.status === "cancelled") return false;
    if (filter === "onsite" && order.fulfillmentType !== "onsite") return false;
    if (filter === "pickup" && order.fulfillmentType !== "pickup") return false;
    if (filter === "shipping" && order.fulfillmentType !== "shipping") return false;
    if (filter === "incomplete" && isTerminalOrder(order)) return false;
    if (filter === "ready" && order.status !== "ready") return false;
    if (attention === "arrived" && !(order.customerArrived && !isTerminalOrder(order))) return false;
    if (attention === "due-soon" && !isDueWithinThirtyMinutes(order, now)) return false;
    if (attention === "changes" && !order.hasUnacknowledgedChange) return false;
    return true;
  });
}

export function summarizeOperationalOrders(orders: OrderRecord[], now = new Date()) {
  return {
    total: orders.length,
    waiting: orders.filter((order) => ["submitted", "confirmed"].includes(order.status)).length,
    inProgress: orders.filter((order) => order.status === "in_progress").length,
    ready: orders.filter((order) => order.status === "ready").length,
    fulfilled: orders.filter((order) => order.status === "fulfilled").length,
    onsite: orders.filter((order) => order.fulfillmentType === "onsite").length,
    pickup: orders.filter((order) => order.fulfillmentType === "pickup").length,
    shipping: orders.filter((order) => order.fulfillmentType === "shipping").length,
    arrived: orders.filter((order) => order.customerArrived && !isTerminalOrder(order)).length,
    dueSoon: orders.filter((order) => isDueWithinThirtyMinutes(order, now)).length,
    changes: orders.filter((order) => order.hasUnacknowledgedChange).length,
  };
}

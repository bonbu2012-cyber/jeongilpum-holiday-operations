import type { WorkshopAction } from "./workshop-operations";
import type { WorkshopOrder } from "./workshop-types";

export async function fetchWorkshopOrders(date: string) {
  const response = await fetch(`/api/workshop/orders?date=${encodeURIComponent(date)}`, { cache: "no-store" });
  const data = await response.json() as { orders?: WorkshopOrder[]; error?: string };
  if (!response.ok) throw new Error(data.error || "작업 목록을 불러오지 못했습니다.");
  return data.orders ?? [];
}

export async function runWorkshopAction(order: WorkshopOrder, action: WorkshopAction) {
  const response = await fetch("/api/workshop/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: order.id, action, expectedVersion: order.version }),
  });
  const data = await response.json() as { error?: string; alreadyApplied?: boolean };
  if (!response.ok) throw new Error(data.error || "작업 상태를 변경하지 못했습니다.");
  return data;
}

export const WORK_STATUS_ORDER = [
  "received",
  "confirmed",
  "in_progress",
  "ready",
  "completed",
  "cancelled",
] as const;

export type WorkStatus = (typeof WORK_STATUS_ORDER)[number];

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  received: "주문 접수",
  confirmed: "주문 확인",
  in_progress: "작업 중",
  ready: "준비 완료",
  completed: "수령 완료",
  cancelled: "취소",
};

export const WORK_STATUS_OPTIONS = WORK_STATUS_ORDER;

export function workStatusLabel(status: WorkStatus) {
  return WORK_STATUS_LABELS[status];
}

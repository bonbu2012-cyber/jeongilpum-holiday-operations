"use client";

import { useState } from "react";
import type { OrderRecord } from "./types";
import { workStatusLabel } from "../lib/sales-operations";
import { arrivalTimingLabel } from "../lib/workshop-operations";
import { FieldInput, FieldSelect, FieldTextarea } from "../ui";

export type SchedulePayload = {
  fulfillmentType: "pickup" | "shipping";
  pickupDate?: string;
  pickupTime?: string;
  shipDate?: string;
};

export type StatusChangeOptions = {
  cancelReasonType?: "test" | "customer_cancelled" | "custom";
  cancelReason?: string;
};

const won = (value: number) => value.toLocaleString("ko-KR") + "원";
const todayInSeoul = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const pickupTimes = Array.from({ length: 27 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
});
const eventLabel: Record<string, string> = {
  order_submitted: "주문 접수",
  status_changed: "주문 상태 변경",
  fulfillment_assigned: "수령 일정 지정",
  payment_recorded: "결제 기록",
  credit_recorded: "외상 등록",
  CUSTOMER_ARRIVED: "고객 도착",
  PACKAGE_REASSIGNED: "대체 완성품 재배정",
};

export default function SalesOrderDetail({
  order,
  onClose,
  onArrival,
  onStatus,
  onOpenLedger,
  assignSchedule,
}: {
  order: OrderRecord;
  onClose: () => void;
  onArrival: (order: OrderRecord) => Promise<void>;
  onStatus: (order: OrderRecord, status: "confirmed" | "fulfilled" | "cancelled", options?: StatusChangeOptions) => Promise<boolean>;
  onOpenLedger: (customerAccountId: string) => void;
  assignSchedule: (order: OrderRecord, payload: SchedulePayload) => Promise<boolean>;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelEditorOpen, setCancelEditorOpen] = useState(false);
  const [cancelReasonType, setCancelReasonType] = useState<"" | "test" | "customer_cancelled" | "custom">("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const address = [order.roadAddress, order.detailAddress].filter(Boolean).join(" ");
  const cancelOrder = async () => {
    if (!cancelReasonType || (cancelReasonType === "custom" && !cancelReason.trim())) return;
    setCancelling(true);
    const changed = await onStatus(order, "cancelled", { cancelReasonType, cancelReason: cancelReason.trim() });
    setCancelling(false);
    if (changed) setCancelEditorOpen(false);
  };

  return (
    <div className="sales-drawer-backdrop">
      <aside className="sales-order-drawer" aria-label="주문 상세">
        <header><div><small>{order.orderNo}</small><h2>{order.buyerName}</h2></div><button onClick={onClose} aria-label="주문 상세 닫기">×</button></header>

        <section className="detail-grid">
          <p><span>전화번호</span><b>{order.buyerPhone}</b></p>
          <p><span>구분</span><b>{order.fulfillmentId ? (order.fulfillmentType === "onsite" ? "현장판매" : order.fulfillmentType === "pickup" ? "방문수령" : "택배발송") : "일정 미지정"}</b></p>
          <p><span>일정</span><b>{order.scheduleLabel}</b></p>
          <p><span>작업상태</span><b>{workStatusLabel(order)}</b></p>
          {order.recipientName && <p><span>수령인</span><b>{order.recipientName} · {order.recipientPhone}</b></p>}
          {order.fulfillmentType === "shipping" && <p className="wide"><span>배송주소</span><b>{order.postalCode && "(" + order.postalCode + ") "}{address || "주소 미입력"}</b><small>{order.jibunAddr || ""} {order.roadAddrReference || ""}</small></p>}
        </section>

        <section className="detail-items"><h3>주문상품</h3>{order.items.map((item) => <div key={item.id}><span>{item.name}</span><b>{item.quantity}개</b><strong>{won(item.unitPrice * item.quantity)}</strong></div>)}</section>
        {order.fulfillmentType !== "onsite" && <section className="detail-progress"><h3>작업장 진행</h3><p><b>{workStatusLabel(order)}</b>{order.packageTotal > 0 ? <span>{order.packageCompleted} / {order.packageTotal} 완료</span> : <span>완성품 생성 전 또는 해당 없음</span>}</p></section>}
        {order.customerArrived && <section className="detail-arrival"><h3>고객 도착</h3><div><p><span>예약시간</span><b>{order.pickupAt?.slice(11, 16) ?? "미지정"}</b></p><p><span>실제도착시간</span><b>{order.actualArrivedAt ? new Date(order.actualArrivedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }) : "기록 없음"}</b></p><p><span>도착상태</span><b>{arrivalTimingLabel(order.arrivalOffsetMinutes)}</b></p><p><span>현재 준비상태</span><b>{order.status === "ready" ? "바로 전달 가능" : workStatusLabel(order)}</b></p></div>{order.substituteCandidateCount > 0 && order.status !== "ready" && <strong>대체 가능한 동일 완성품 {order.substituteCandidateCount}개 있음</strong>}</section>}
        {order.note && <section className="detail-note"><h3>요청사항</h3><p>{order.note}</p></section>}
        {!order.fulfillmentId && <ScheduleEditor order={order} assignSchedule={assignSchedule} />}
        <CustomerPaymentPanel order={order} onOpenLedger={onOpenLedger} />

        <section className="detail-actions">
          {order.status === "submitted" && order.fulfillmentId && <button className="primary" onClick={() => void onStatus(order, "confirmed")}>주문 확인 · 작업장 전달</button>}
          {order.fulfillmentType === "pickup" && order.fulfillmentId && !["cancelled", "fulfilled"].includes(order.status) && <button className="arrival" onClick={() => void onArrival(order)} disabled={order.customerArrived}>{order.customerArrived ? "고객 도착 기록됨" : "고객 도착"}</button>}
          {order.status === "ready" && <button className="primary" onClick={() => void onStatus(order, "fulfilled")}>{order.fulfillmentType === "shipping" ? "출고 완료" : "전달 완료"}</button>}
          <button disabled title="안전한 주문 수정 절차가 아직 준비되지 않았습니다.">주문 수정 · 준비중</button>
          {!["fulfilled", "cancelled"].includes(order.status) && <button className="danger" onClick={() => setCancelEditorOpen(true)}>주문 취소</button>}
          <button onClick={() => setHistoryOpen((value) => !value)}>이력 보기</button>
        </section>

        {cancelEditorOpen && <section className="order-cancellation-editor" aria-label="주문 취소 사유 입력">
          <h3>주문 취소</h3>
          <p>구매 기록과 취소 사유는 남고, 이 주문은 통계·미수금·생산 집계에서 제외됩니다.</p>
          <FieldSelect id="sales-order-cancel-reason" label="취소 사유" value={cancelReasonType} onChange={(event) => setCancelReasonType(event.target.value as typeof cancelReasonType)}>
            <option value="">사유를 선택해주세요</option>
            <option value="test">테스트</option>
            <option value="customer_cancelled">취소</option>
            <option value="custom">직접입력</option>
          </FieldSelect>
          {cancelReasonType === "custom" && <FieldTextarea id="sales-order-cancel-custom-reason" label="직접입력 사유" maxLength={200} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="취소 사유를 입력해주세요" />}
          <div><button onClick={() => setCancelEditorOpen(false)} disabled={cancelling}>닫기</button><button className="danger" onClick={() => void cancelOrder()} disabled={cancelling || !cancelReasonType || (cancelReasonType === "custom" && !cancelReason.trim())}>{cancelling ? "취소 처리 중…" : "기록을 남기고 취소"}</button></div>
        </section>}

        {historyOpen && <section className="detail-history"><h3>주문 이력</h3>{order.events.length ? <ol>{order.events.map((event) => <li key={event.id}><b>{eventLabel[event.type] || event.type}</b><span>{new Date(event.createdAt).toLocaleString("ko-KR")}</span>{event.reason && <small>{event.reason}</small>}</li>)}</ol> : <p>기록된 이력이 없습니다.</p>}</section>}
      </aside>
    </div>
  );
}

function CustomerPaymentPanel({ order, onOpenLedger }: {
  order: OrderRecord;
  onOpenLedger: (customerAccountId: string) => void;
}) {
  const statusText = {
    credit: "외상",
    partial: "부분 결제",
    paid: "결제 완료",
    advance: "선수금",
  }[order.customerPaymentStatus];

  return <section className="payment-panel drawer-payment">
    <header><h3>고객 결제·미수</h3><em className={"payment-state " + order.customerPaymentStatus}>{statusText}</em></header>
    <div className="payment-summary">
      <p><span>고객 총 주문금액</span><b>{won(order.customerTotalOrdered)}</b></p>
      <p><span>고객 순입금</span><b>{won(order.customerNetReceived)}</b></p>
      <p><span>현재 미수금</span><b>{won(order.customerReceivable)}</b></p>
      <p><span>현재 선수금</span><b>{won(order.customerAdvance)}</b></p>
    </div>
    <p className="credit-note">결제는 주문별로 임의 배분하지 않고 같은 이름·전화번호의 고객 장부에서 통합 관리합니다.</p>
    <div className="payment-actions">
      <button
        type="button"
        className="task-primary"
        disabled={!order.customerAccountId}
        onClick={() => order.customerAccountId && onOpenLedger(order.customerAccountId)}
      >
        고객 장부에서 결제 관리
      </button>
    </div>
  </section>;
}

function ScheduleEditor({ order, assignSchedule }: {
  order: OrderRecord;
  assignSchedule: (order: OrderRecord, payload: SchedulePayload) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "shipping">(order.fulfillmentType === "shipping" ? "shipping" : "pickup");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("08:00");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!date) return;
    setSaving(true);
    const saved = await assignSchedule(order, fulfillmentType === "pickup" ? { fulfillmentType, pickupDate: date, pickupTime: time } : { fulfillmentType, shipDate: date });
    setSaving(false);
    if (saved) setOpen(false);
  };
  if (!open) return <section className="legacy-actions"><p>기존 주문의 날짜를 추정하지 않습니다.</p><button className="task-primary" onClick={() => setOpen(true)}>수령방법·일정 지정</button></section>;
  return <section className="legacy-schedule-editor">
    <h3>기존 주문 일정 지정</h3>
    <FieldSelect id="sales-legacy-fulfillment-type" label="수령방법" value={fulfillmentType} onChange={(event) => setFulfillmentType(event.target.value as "pickup" | "shipping")}><option value="pickup">방문수령</option><option value="shipping">택배발송</option></FieldSelect>
    <FieldInput id="sales-legacy-fulfillment-date" label={fulfillmentType === "pickup" ? "방문 날짜" : "발송 날짜"} type="date" min={todayInSeoul()} value={date} onChange={(event) => setDate(event.target.value)} />
    {fulfillmentType === "pickup" && <FieldSelect id="sales-legacy-pickup-time" label="방문 시간" value={time} onChange={(event) => setTime(event.target.value)}>{pickupTimes.map((value) => <option key={value} value={value}>{value}</option>)}</FieldSelect>}
    <div className="legacy-editor-buttons"><button onClick={() => setOpen(false)} disabled={saving}>취소</button><button className="task-primary" onClick={() => void save()} disabled={saving || !date}>{saving ? "저장 중…" : "일정 저장"}</button></div>
  </section>;
}

"use client";

import { useState } from "react";
import type { OrderRecord } from "./types";
import { workStatusLabel } from "../lib/sales-operations";
import { arrivalTimingLabel } from "../lib/workshop-operations";

export type SchedulePayload = {
  fulfillmentType: "pickup" | "shipping";
  pickupDate?: string;
  pickupTime?: string;
  shipDate?: string;
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
  onSaved,
  assignSchedule,
}: {
  order: OrderRecord;
  onClose: () => void;
  onArrival: (order: OrderRecord) => Promise<void>;
  onStatus: (order: OrderRecord, status: "confirmed" | "fulfilled" | "cancelled") => Promise<void>;
  onSaved: () => void;
  assignSchedule: (order: OrderRecord, payload: SchedulePayload) => Promise<boolean>;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const address = [order.roadAddress, order.detailAddress].filter(Boolean).join(" ");

  return (
    <div className="sales-drawer-backdrop">
      <aside className="sales-order-drawer" aria-label="주문 상세">
        <header><div><small>{order.orderNo}</small><h2>{order.buyerName}</h2></div><button onClick={onClose} aria-label="주문 상세 닫기">×</button></header>

        <section className="detail-grid">
          <p><span>전화번호</span><b>{order.buyerPhone}</b></p>
          <p><span>구분</span><b>{order.fulfillmentId ? (order.fulfillmentType === "pickup" ? "방문수령" : "택배발송") : "일정 미지정"}</b></p>
          <p><span>일정</span><b>{order.scheduleLabel}</b></p>
          <p><span>작업상태</span><b>{workStatusLabel(order)}</b></p>
          {order.recipientName && <p><span>수령인</span><b>{order.recipientName} · {order.recipientPhone}</b></p>}
          {order.fulfillmentType === "shipping" && <p className="wide"><span>배송주소</span><b>{order.postalCode && "(" + order.postalCode + ") "}{address || "주소 미입력"}</b><small>{order.jibunAddr || ""} {order.roadAddrReference || ""}</small></p>}
        </section>

        <section className="detail-items"><h3>주문상품</h3>{order.items.map((item) => <div key={item.id}><span>{item.name}</span><b>{item.quantity}개</b><strong>{won(item.unitPrice * item.quantity)}</strong></div>)}</section>
        <section className="detail-progress"><h3>작업장 진행</h3><p><b>{workStatusLabel(order)}</b>{order.packageTotal > 0 ? <span>{order.packageCompleted} / {order.packageTotal} 완료</span> : <span>package 생성 전 또는 해당 없음</span>}</p></section>
        {order.customerArrived && <section className="detail-arrival"><h3>고객 도착</h3><div><p><span>예약시간</span><b>{order.pickupAt?.slice(11, 16) ?? "미지정"}</b></p><p><span>실제도착시간</span><b>{order.actualArrivedAt ? new Date(order.actualArrivedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }) : "기록 없음"}</b></p><p><span>도착상태</span><b>{arrivalTimingLabel(order.arrivalOffsetMinutes)}</b></p><p><span>현재 준비상태</span><b>{order.status === "ready" ? "바로 전달 가능" : workStatusLabel(order)}</b></p></div>{order.substituteCandidateCount > 0 && order.status !== "ready" && <strong>대체 가능한 동일 완성품 {order.substituteCandidateCount}개 있음</strong>}</section>}
        {order.note && <section className="detail-note"><h3>요청사항</h3><p>{order.note}</p></section>}
        {!order.fulfillmentId && <ScheduleEditor order={order} assignSchedule={assignSchedule} />}
        <PaymentPanel order={order} onSaved={onSaved} />

        <section className="detail-actions">
          {order.status === "submitted" && order.fulfillmentId && <button className="primary" onClick={() => void onStatus(order, "confirmed")}>주문 확인 · 작업장 전달</button>}
          {order.fulfillmentType === "pickup" && order.fulfillmentId && !["cancelled", "fulfilled"].includes(order.status) && <button className="arrival" onClick={() => void onArrival(order)} disabled={order.customerArrived}>{order.customerArrived ? "고객 도착 기록됨" : "고객 도착"}</button>}
          {order.status === "ready" && <button className="primary" onClick={() => void onStatus(order, "fulfilled")}>{order.fulfillmentType === "shipping" ? "출고 완료" : "전달 완료"}</button>}
          <button disabled title="안전한 주문 수정 workflow가 아직 준비되지 않았습니다.">주문 수정 · 준비중</button>
          {!["fulfilled", "cancelled"].includes(order.status) && <button className="danger" onClick={() => { if (window.confirm("이 주문을 취소하고 감사 이력을 남길까요?")) void onStatus(order, "cancelled"); }}>주문 취소</button>}
          <button onClick={() => setHistoryOpen((value) => !value)}>이력 보기</button>
        </section>

        {historyOpen && <section className="detail-history"><h3>주문 이력</h3>{order.events.length ? <ol>{order.events.map((event) => <li key={event.id}><b>{eventLabel[event.type] || event.type}</b><span>{new Date(event.createdAt).toLocaleString("ko-KR")}</span>{event.reason && <small>{event.reason}</small>}</li>)}</ol> : <p>기록된 이력이 없습니다.</p>}</section>}
      </aside>
    </div>
  );
}

function PaymentPanel({ order, onSaved }: { order: OrderRecord; onSaved: () => void }) {
  const [mode, setMode] = useState<"payment" | "credit" | null>(null);
  const [method, setMethod] = useState<"card" | "cash" | "bank_transfer">("card");
  const [amount, setAmount] = useState(String(order.balance));
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const statusText = { unpaid: "미결제", partial: "부분결제", paid: "결제완료", credit: "외상" }[order.paymentStatus];

  const open = (next: "payment" | "credit") => {
    setMode(next);
    setAmount(String(order.balance));
    setError("");
  };
  const save = async () => {
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount <= 0 || numericAmount > order.balance) {
      setError("결제금액을 잔액 이내의 1원 이상 금액으로 입력해주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/orders/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          orderId: order.id,
          method: mode === "payment" ? method : undefined,
          amount: numericAmount,
          paidAt: mode === "payment" ? new Date(paidAt).toISOString() : undefined,
          dueDate: mode === "credit" ? dueDate : undefined,
          memo,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "결제정보를 저장하지 못했습니다.");
      setMode(null);
      setMemo("");
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "결제정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="payment-panel drawer-payment">
    <header><h3>결제정보</h3><em className={"payment-state " + order.paymentStatus}>{statusText}</em></header>
    <div className="payment-summary">
      <p><span>총 주문금액</span><b>{won(order.totalAmount)}</b></p><p><span>결제누계</span><b>{won(order.paidAmount)}</b></p>
      <p><span>잔액</span><b>{won(order.balance)}</b></p><p><span>결제상태</span><b>{statusText}</b></p>
    </div>
    {order.paymentStatus === "credit" && <p className="credit-note">외상 예정일 {order.creditDueDate || "미지정"}{order.creditMemo ? " · " + order.creditMemo : ""}</p>}
    {order.payments.length > 0 && <div className="payment-history-block"><h4>결제내역</h4><ul className="payment-history">{order.payments.map((payment) => <li key={payment.id}><span>{{ card: "카드", cash: "현금", bank_transfer: "계좌이체" }[payment.method || "card"]} · {new Date(payment.paidAt).toLocaleString("ko-KR")}</span><b>{won(payment.amount)}</b></li>)}</ul></div>}
    {order.balance > 0 && <div className="payment-actions"><button type="button" onClick={() => open("payment")}>결제 기록</button><button type="button" onClick={() => open("credit")}>외상 처리</button></div>}
    {mode && <div className="payment-editor">
      <h4>{mode === "payment" ? "결제 기록" : "외상 처리"}</h4>
      {mode === "payment" && <div className="payment-methods">{([["card", "카드"], ["cash", "현금"], ["bank_transfer", "계좌이체"]] as const).map(([value, label]) => <button type="button" key={value} className={method === value ? "selected" : ""} onClick={() => setMethod(value)}>{label}</button>)}</div>}
      <label><span>{mode === "payment" ? "결제금액" : "외상 잔액"}</span><input type="number" min="1" max={order.balance} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      {mode === "payment" ? <label><span>결제일시</span><input type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label> : <label><span>예정일</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>}
      <label><span>메모</span><input value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
      {error && <p className="payment-error" role="alert">{error}</p>}
      <div><button type="button" onClick={() => setMode(null)} disabled={saving}>닫기</button><button type="button" className="task-primary" onClick={() => void save()} disabled={saving}>{saving ? "저장 중…" : mode === "payment" ? "결제 등록" : "외상 저장"}</button></div>
    </div>}
  </section>;
}

function ScheduleEditor({ order, assignSchedule }: {
  order: OrderRecord;
  assignSchedule: (order: OrderRecord, payload: SchedulePayload) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "shipping">(order.fulfillmentType);
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
    <label><span>수령방법</span><select value={fulfillmentType} onChange={(event) => setFulfillmentType(event.target.value as "pickup" | "shipping")}><option value="pickup">방문수령</option><option value="shipping">택배발송</option></select></label>
    <label><span>{fulfillmentType === "pickup" ? "방문 날짜" : "발송 날짜"}</span><input type="date" min={todayInSeoul()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
    {fulfillmentType === "pickup" && <label><span>방문 시간</span><select value={time} onChange={(event) => setTime(event.target.value)}>{pickupTimes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
    <div className="legacy-editor-buttons"><button onClick={() => setOpen(false)} disabled={saving}>취소</button><button className="task-primary" onClick={() => void save()} disabled={saving || !date}>{saving ? "저장 중…" : "일정 저장"}</button></div>
  </section>;
}

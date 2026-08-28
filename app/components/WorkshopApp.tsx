"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppNav from "./AppNav";
import { fetchWorkshopOrders, reassignCompletedPackage, runWorkshopAction } from "../lib/workshop-client";
import {
  aggregateWorkshopProducts,
  arrivalTimingLabel,
  dueSoonLabel,
  filterWorkshopOrdersByProduct,
  isWorkshopDueSoon,
  pickupUrgency,
  sortTimelineOrders,
  sortWorkshopOrders,
  summarizeWorkshopOrders,
  workshopStatusLabel,
  type WorkshopAction,
  type WorkshopTab,
} from "../lib/workshop-operations";
import type { SubstituteCandidate, WorkshopOrder } from "../lib/workshop-types";
import "../workshop-flow.css";

const todayInSeoul = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const moveDate = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
};
const dateHeading = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
};
const nextDueLabel = (value: string | null) => !value ? "완료" : value.includes("T") ? value.slice(11, 16) : `[택배] ${value}`;
const shortDateTime = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const eventLabel: Record<string, string> = {
  order_submitted: "주문 접수",
  status_changed: "주문 상태 변경",
  CUSTOMER_ARRIVED: "고객 도착",
  WORK_ACCEPTED: "작업 수락",
  WORK_STARTED: "작업 시작",
  WORK_COMPLETED: "상품 준비완료",
  order_changed: "주문 변경",
  order_updated: "주문 변경",
  items_changed: "상품 변경",
  fulfillment_changed: "수령방법 변경",
  schedule_changed: "일정 변경",
  change_acknowledged: "변경 확인",
  fulfillment_assigned: "수령 일정 지정",
  PACKAGE_REASSIGNED: "대체 완성품 재배정",
};

export default function WorkshopApp() {
  const [orders, setOrders] = useState<WorkshopOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayInSeoul);
  const [tab, setTab] = useState<WorkshopTab>("timeline");
  const [selectedOrder, setSelectedOrder] = useState<WorkshopOrder | null>(null);
  const [productFilterId, setProductFilterId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [busyPackageId, setBusyPackageId] = useState("");
  const [lastSync, setLastSync] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(async (silent = false) => {
    const requestId = ++requestSequence.current;
    if (!silent) setRefreshing(true);
    try {
      const result = await fetchWorkshopOrders(selectedDate);
      if (requestId !== requestSequence.current) return;
      setOrders(result);
      setSelectedOrder((current) => current ? result.find((order) => order.id === current.id) ?? current : null);
      setError("");
      setLastSync(new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()));
    } catch (caught) {
      if (requestId === requestSequence.current) setError(caught instanceof Error ? caught.message : "작업 목록을 불러오지 못했습니다.");
    } finally {
      if (requestId === requestSequence.current) setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    const timer = setInterval(() => void load(true), 2500);
    const sync = () => void load(true);
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
    };
  }, [load]);

  const perform = async (order: WorkshopOrder, action: WorkshopAction) => {
    setBusyOrderId(order.id);
    try {
      const result = await runWorkshopAction(order, action);
      setNotice(result.alreadyApplied ? "이미 처리된 작업입니다. 최신 상태를 불러왔습니다." : action === "accept" ? "작업을 수락했습니다." : action === "start" ? "작업을 시작했습니다." : "상품 준비완료로 표시했습니다.");
      await load();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "작업 상태를 변경하지 못했습니다.");
      await load(true);
    } finally {
      setBusyOrderId("");
    }
  };

  const performReassignment = async (order: WorkshopOrder, candidate: SubstituteCandidate) => {
    setBusyPackageId(candidate.packageId);
    try {
      const result = await reassignCompletedPackage(order, candidate);
      setNotice(result.alreadyApplied ? "이미 적용된 재배정입니다. 최신 상태를 불러왔습니다." : "대체 완성품을 적용했습니다. 두 주문의 생산 현황을 다시 계산했습니다.");
      await load();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "대체 완성품을 적용하지 못했습니다.");
      await load(true);
    } finally {
      setBusyPackageId("");
    }
  };

  const now = new Date();
  const summary = summarizeWorkshopOrders(orders);
  const products = aggregateWorkshopProducts(orders);
  const filteredOrders = filterWorkshopOrdersByProduct(orders, productFilterId);
  const incomplete = filteredOrders.filter((order) => order.status !== "ready");
  const urgent = sortWorkshopOrders(incomplete.filter((order) => order.customerArrived || isWorkshopDueSoon(order, now)), now);
  const timelineSource = showAllTimeline ? filteredOrders : incomplete;
  const timeline = sortTimelineOrders(timelineSource.filter((order) => !urgent.some((urgentOrder) => urgentOrder.id === order.id)));
  const completed = sortTimelineOrders(filteredOrders.filter((order) => order.status === "ready"));
  const selectedProduct = products.find((product) => product.productId === productFilterId);

  const selectProduct = (productId: string) => {
    setProductFilterId((current) => current === productId ? null : productId);
    setTab("timeline");
  };

  return <div className="workshop-app">
    <header className="workshop-header">
      <a href="/workshop" className="workshop-brand"><b>正</b><span>정일품 작업장<small>DIGITAL WORK WHITEBOARD</small></span></a>
      <AppNav current="workshop" />
      <button className="workshop-sync" onClick={() => void load()} disabled={refreshing}>{refreshing ? "동기화 중…" : "지금 새로고침"}</button>
    </header>

    <main className="workshop-main">
      <section className="workshop-date-toolbar" aria-label="작업 기준일 선택">
        <button onClick={() => setSelectedDate(moveDate(selectedDate, -1))}>← 이전날</button>
        <div><small>{selectedDate === todayInSeoul() ? "오늘 생산판" : "선택 날짜 생산판"}</small><h1>{dateHeading(selectedDate)}</h1><span>방문수령일·택배 발송일 기준 · 최근 동기화 {lastSync || "준비 중"}</span></div>
        <button onClick={() => setSelectedDate(moveDate(selectedDate, 1))}>다음날 →</button>
        <label><span>달력</span><input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setProductFilterId(null); }} /></label>
      </section>

      {error && <div className="access-error workshop-error" role="alert"><b>작업 목록에 연결할 수 없습니다</b><span>{error}</span><a href="/signin-with-chatgpt?return_to=/workshop">작업자 로그인</a></div>}

      <section className="workshop-summary" aria-label="오늘 작업 요약">
        <div><small>전체 주문</small><b>{summary.total}</b></div>
        <div><small>작업대기</small><b>{summary.waiting}</b></div>
        <div><small>수락완료</small><b>{summary.accepted}</b></div>
        <div><small>작업중</small><b>{summary.inProgress}</b></div>
        <div><small>준비완료</small><b>{summary.completed}</b></div>
        <div className={summary.arrived ? "attention" : ""}><small>고객도착</small><b>{summary.arrived}</b></div>
        <div className={summary.changes ? "attention" : ""}><small>변경확인</small><b>{summary.changes}</b></div>
      </section>

      <ProductBoard products={products} selectedProductId={productFilterId} onSelect={selectProduct} />

      <nav className="workshop-tabs" aria-label="작업장 보기">
        <button className={tab === "timeline" ? "active" : ""} onClick={() => setTab("timeline")}>타임라인</button>
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>상품별</button>
        <button className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>완료</button>
      </nav>

      {productFilterId && <div className="workshop-filter-chip"><b>{selectedProduct?.name ?? "선택 상품"}</b> 포함 주문만 표시 중 <button onClick={() => setProductFilterId(null)}>필터 해제 ×</button></div>}

      {tab === "timeline" && <>
        {urgent.length > 0 && <TimelineSection title="긴급" description="고객도착 또는 30분 이내 방문 예정" orders={urgent} onSelect={setSelectedOrder} onAction={perform} busyOrderId={busyOrderId} now={now} urgent />}
        <section className="whiteboard-section">
          <header><div><small>TIME ORDER</small><h2>시간대별 작업 타임라인</h2></div><button onClick={() => setShowAllTimeline((value) => !value)}>{showAllTimeline ? "미완료만 보기" : "전체 보기"}</button></header>
          <TimelineRows orders={timeline} onSelect={setSelectedOrder} onAction={perform} busyOrderId={busyOrderId} now={now} empty="선택 조건의 작업 주문이 없습니다." />
        </section>
        <section className="completed-fold"><header><div><small>COMPLETED</small><h2>준비완료 {completed.length}건</h2></div><button onClick={() => setShowCompleted((value) => !value)}>{showCompleted ? "접기 ↑" : "펼치기 ↓"}</button></header>{showCompleted && <TimelineRows orders={completed} onSelect={setSelectedOrder} onAction={perform} busyOrderId={busyOrderId} now={now} empty="준비완료 주문이 없습니다." />}</section>
      </>}

      {tab === "products" && <section className="product-focus-panel"><h2>상품별 주문 필터</h2><p>위 생산량 표에서 상품명을 선택하면 해당 상품이 포함된 주문만 타임라인에 표시됩니다.</p>{selectedProduct && <button onClick={() => setTab("timeline")}>{selectedProduct.name} 주문 타임라인 보기 →</button>}</section>}

      {tab === "completed" && <section className="whiteboard-section"><header><div><small>READY</small><h2>준비완료 주문</h2></div></header><TimelineRows orders={completed} onSelect={setSelectedOrder} onAction={perform} busyOrderId={busyOrderId} now={now} empty="선택 날짜의 준비완료 주문이 없습니다." /></section>}
    </main>

    {selectedOrder && <WorkshopDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} onAction={perform} onReassign={performReassignment} busy={busyOrderId === selectedOrder.id} busyPackageId={busyPackageId} />}
    {notice && <div className="ops-toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="알림 닫기">×</button></div>}
  </div>;
}

function ProductBoard({ products, selectedProductId, onSelect }: { products: ReturnType<typeof aggregateWorkshopProducts>; selectedProductId: string | null; onSelect: (productId: string) => void }) {
  return <section className="production-board"><header><div><small>PRODUCTION TOTAL</small><h2>오늘 상품별 생산량</h2></div><p>실제 주문수량과 package 완료 근거만 사용</p></header>{products.length ? <div className="production-table-wrap"><table><thead><tr><th>상품</th><th>총 필요</th><th>완료</th><th>남음</th><th>가장 빠른 시간</th></tr></thead><tbody>{products.map((product) => <tr key={product.productId} className={selectedProductId === product.productId ? "selected" : ""}><td><button onClick={() => onSelect(product.productId)}>{product.name}</button></td><td>{product.total}</td><td>{product.completed}</td><td><b>{product.remaining}</b></td><td><strong>{nextDueLabel(product.nextDueAt)}</strong></td></tr>)}</tbody></table></div> : <div className="workshop-empty">선택 날짜의 생산 대상이 없습니다.</div>}</section>;
}

function TimelineSection({ title, description, orders, onSelect, onAction, busyOrderId, now, urgent = false }: { title: string; description: string; orders: WorkshopOrder[]; onSelect: (order: WorkshopOrder) => void; onAction: (order: WorkshopOrder, action: WorkshopAction) => Promise<void>; busyOrderId: string; now: Date; urgent?: boolean }) {
  return <section className={`whiteboard-section ${urgent ? "urgent-board" : ""}`}><header><div><small>PRIORITY</small><h2>{title} {orders.length}건</h2></div><p>{description}</p></header><TimelineRows orders={orders} onSelect={onSelect} onAction={onAction} busyOrderId={busyOrderId} now={now} empty="긴급 주문이 없습니다." /></section>;
}

function TimelineRows({ orders, onSelect, onAction, busyOrderId, now, empty }: { orders: WorkshopOrder[]; onSelect: (order: WorkshopOrder) => void; onAction: (order: WorkshopOrder, action: WorkshopAction) => Promise<void>; busyOrderId: string; now: Date; empty: string }) {
  if (!orders.length) return <div className="workshop-empty">{empty}</div>;
  return <div className="timeline-list">{orders.map((order) => <TimelineRow key={order.id} order={order} onSelect={onSelect} onAction={onAction} busy={busyOrderId === order.id} now={now} />)}</div>;
}

function TimelineRow({ order, onSelect, onAction, busy, now }: { order: WorkshopOrder; onSelect: (order: WorkshopOrder) => void; onAction: (order: WorkshopOrder, action: WorkshopAction) => Promise<void>; busy: boolean; now: Date }) {
  const action = order.status === "confirmed" ? order.workAcceptedAt ? "start" : "accept" : order.status === "in_progress" ? "complete" : null;
  const actionText = action === "accept" ? "작업 수락" : action === "start" ? "작업 시작" : "상품 준비완료";
  const due = dueSoonLabel(order, now);
  const urgency = pickupUrgency(order, now);
  return <article className={`timeline-row ${order.status === "ready" ? "ready" : ""} ${order.customerArrived && order.status !== "ready" ? "arrived" : ""}`}>
    <div className="completion-mark" aria-label={order.status === "ready" ? "준비완료" : "미완료"}>{order.status === "ready" ? "✓" : "☐"}</div>
    <div className="timeline-time">{order.fulfillmentType === "pickup" ? <><b>{order.pickupAt?.slice(11, 16) ?? "--:--"}</b><small>방문</small></> : <><b>[택배]</b><small>{order.shipDate} 발송</small></>}</div>
    <div className="timeline-customer"><button onClick={() => onSelect(order)}>{order.buyerName}</button><small>{order.orderNo}</small></div>
    <div className="timeline-products">{order.items.map((item) => <span key={item.id}>{item.name} <b>×{item.quantity}</b></span>)}{order.packageTotal > 0 && <small>{order.packageCompleted} / {order.packageTotal} package 완료</small>}</div>
    <div className="timeline-flags">{order.customerArrived && order.status !== "ready" && <b className="arrival-badge">{arrivalTimingLabel(order.arrivalOffsetMinutes)}</b>}{due && <b className={`urgency-${urgency?.level}`}>{due}</b>}{order.substituteCandidates.length > 0 && <b className="substitute-badge">대체 완성품 {order.substituteCandidates.length}</b>}{order.hasUnacknowledgedChange && <b className={order.changeSeverity === "after_start" ? "strong-change" : ""}>{order.changeSeverity === "after_start" ? "작업 후 변경 확인 필요" : "변경"}</b>}</div>
    <div className="timeline-status"><strong>{order.status === "ready" ? "✓ 준비완료" : workshopStatusLabel(order)}</strong>{order.workAcceptedAt && order.status === "confirmed" && <small>{shortDateTime(order.workAcceptedAt)} 수락</small>}</div>
    <div className="timeline-action">{action ? <button disabled={busy} onClick={() => void onAction(order, action)}>{busy ? "처리 중…" : actionText}</button> : <button className="detail-only" onClick={() => onSelect(order)}>상세보기</button>}</div>
  </article>;
}

function WorkshopDetail({ order, onClose, onAction, onReassign, busy, busyPackageId }: { order: WorkshopOrder; onClose: () => void; onAction: (order: WorkshopOrder, action: WorkshopAction) => Promise<void>; onReassign: (order: WorkshopOrder, candidate: SubstituteCandidate) => Promise<void>; busy: boolean; busyPackageId: string }) {
  const action = order.status === "confirmed" ? order.workAcceptedAt ? "start" : "accept" : order.status === "in_progress" ? "complete" : null;
  return <div className="workshop-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="workshop-drawer" role="dialog" aria-modal="true" aria-label={`${order.orderNo} 작업 상세`}><header><div><small>{order.orderNo}</small><h2>{order.status === "ready" ? "✓ " : "☐ "}{order.buyerName}</h2></div><button onClick={onClose} aria-label="작업 상세 닫기">×</button></header>
    <section className="workshop-detail-grid"><p><span>수령방법</span><b>{order.fulfillmentType === "pickup" ? "방문수령" : "택배발송"}</b></p><p><span>작업 기준일정</span><b>{order.scheduleLabel}</b></p><p><span>작업상태</span><b>{workshopStatusLabel(order)}</b></p><p><span>고객상태</span><b>{order.customerArrived ? arrivalTimingLabel(order.arrivalOffsetMinutes) : "도착 전"}</b>{order.actualArrivedAt && <small>실제 {shortDateTime(order.actualArrivedAt)}</small>}</p>{order.workAcceptedAt && <p><span>작업 수락</span><b>{shortDateTime(order.workAcceptedAt)}</b><small>담당 {order.workAcceptedBy ?? "운영자"}</small></p>}{order.workStartedAt && <p><span>작업 시작</span><b>{shortDateTime(order.workStartedAt)}</b></p>}</section>
    <section className="workshop-detail-items"><h3>작업 상품</h3>{order.items.map((item) => <div key={item.id}><b>{item.name}</b><span>× {item.quantity}</span>{item.packageTotal > 0 ? <small>{item.packageCompleted} / {item.packageTotal} 완료</small> : <small>{order.status === "ready" ? "주문 전체 준비완료" : "부분완료 근거 없음"}</small>}</div>)}</section>
    {order.substituteCandidates.length > 0 && <section className="workshop-substitutes"><h3>대체 가능한 완성품</h3><p>조기도착 고객에게 같은 날 더 늦은 주문의 동일 완성품을 1:1 맞교환합니다.</p>{order.substituteCandidates.map((candidate) => <div key={candidate.packageId}><span><b>{candidate.productName} · {candidate.packageCode}</b><small>{candidate.sourceOrderNo} · {candidate.sourcePickupAt.slice(11, 16)} 예약분</small></span><button disabled={Boolean(busyPackageId)} onClick={() => void onReassign(order, candidate)}>{busyPackageId === candidate.packageId ? "재배정 중…" : "대체 완성품 적용"}</button></div>)}</section>}
    {order.note && <section className="workshop-detail-note"><h3>작업 요청사항</h3><p>{order.note}</p></section>}
    <section className="workshop-detail-history"><h3>작업·변경 이력</h3>{order.events.length ? <ol>{order.events.map((event) => <li key={event.id}><b>{eventLabel[event.type] ?? event.type}</b><time>{new Date(event.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</time>{event.reason && <small>{event.reason}</small>}</li>)}</ol> : <p>표시할 작업 이력이 없습니다.</p>}</section>
    {action && <button className={`workshop-action ${action}`} disabled={busy} onClick={() => void onAction(order, action)}>{busy ? "처리 중…" : action === "accept" ? "작업 수락" : action === "start" ? "작업 시작" : "상품 준비완료"}</button>}
  </aside></div>;
}
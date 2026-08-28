"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppNav from "./AppNav";
import { fetchWorkshopOrders, runWorkshopAction } from "../lib/workshop-client";
import {
  aggregateWorkshopProducts,
  sortWorkshopOrders,
  summarizeWorkshopOrders,
  workshopPriorityRank,
  workshopScheduleTime,
  workshopStatusLabel,
  type WorkshopAction,
  type WorkshopTab,
} from "../lib/workshop-operations";
import type { WorkshopOrder } from "../lib/workshop-types";
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
};

export default function WorkshopApp() {
  const [orders, setOrders] = useState<WorkshopOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayInSeoul);
  const [tab, setTab] = useState<WorkshopTab>("orders");
  const [selectedOrder, setSelectedOrder] = useState<WorkshopOrder | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState("");
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

  const now = new Date();
  const sorted = sortWorkshopOrders(orders, now);
  const urgent = sorted.filter((order) => order.status !== "ready" && workshopPriorityRank(order, now) <= 2);
  const ordinary = sorted.filter((order) => order.status !== "ready" && workshopPriorityRank(order, now) > 2);
  const completed = sorted.filter((order) => order.status === "ready");
  const summary = summarizeWorkshopOrders(orders);
  const products = aggregateWorkshopProducts(orders);

  return <div className="workshop-app">
    <header className="workshop-header">
      <a href="/workshop" className="workshop-brand"><b>正</b><span>정일품 작업장<small>WORKSHOP OPERATIONS</small></span></a>
      <AppNav current="workshop" />
      <button className="workshop-sync" onClick={() => void load()} disabled={refreshing}>{refreshing ? "동기화 중…" : "지금 새로고침"}</button>
    </header>

    <main className="workshop-main">
      <section className="workshop-date-toolbar" aria-label="작업 날짜 선택">
        <button onClick={() => setSelectedDate(moveDate(selectedDate, -1))}>← 이전날</button>
        <div><small>{selectedDate === todayInSeoul() ? "오늘 작업" : "선택 날짜 작업"}</small><h1>{dateHeading(selectedDate)}</h1><span>최근 동기화 {lastSync || "준비 중"} · 약 3초 간격 자동 반영</span></div>
        <button onClick={() => setSelectedDate(moveDate(selectedDate, 1))}>다음날 →</button>
        <label><span>달력</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
      </section>

      {error && <div className="access-error workshop-error" role="alert"><b>작업 목록에 연결할 수 없습니다</b><span>{error}</span><a href="/signin-with-chatgpt?return_to=/workshop">작업자 로그인</a></div>}

      <section className="workshop-summary" aria-label="작업 현황 요약">
        <div><small>오늘 작업</small><b>{summary.total}</b></div>
        <div><small>작업대기</small><b>{summary.waiting}</b></div>
        <div><small>작업중</small><b>{summary.inProgress}</b></div>
        <div><small>완료</small><b>{summary.completed}</b></div>
        <div className={summary.arrived ? "attention" : ""}><small>고객도착</small><b>{summary.arrived}</b></div>
        <div className={summary.changes ? "attention" : ""}><small>변경확인 필요</small><b>{summary.changes}</b></div>
      </section>

      <nav className="workshop-tabs" aria-label="작업장 보기">
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>오늘 작업</button>
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>상품별</button>
        <button className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>완료</button>
      </nav>

      {tab === "orders" && <>
        <WorkSection title="긴급작업" description="고객도착 · 30분 이내 · 주문변경" orders={urgent} empty="현재 긴급작업이 없습니다." onSelect={setSelectedOrder} onAction={perform} busyOrderId={busyOrderId} urgent />
        <WorkSection title="일반작업" description="작업중인 주문 다음으로 일정이 빠른 작업" orders={ordinary} empty="현재 진행할 일반작업이 없습니다." onSelect={setSelectedOrder} onAction={perform} busyOrderId={busyOrderId} />
        <section className="workshop-section completed-section"><header><div><small>COMPLETED</small><h2>완료작업 <b>{completed.length}</b>건</h2></div><button onClick={() => setShowCompleted((value) => !value)}>{showCompleted ? "접기 ↑" : "펼치기 ↓"}</button></header>{showCompleted && <div className="workshop-grid">{completed.map((order) => <WorkCard key={order.id} order={order} onSelect={setSelectedOrder} onAction={perform} busy={busyOrderId === order.id} />)}</div>}</section>
      </>}

      {tab === "products" && <section className="workshop-products-summary"><header><div><small>PRODUCT LOAD</small><h2>상품별 작업량</h2></div><p>package가 생성된 수량만 완료로 계산합니다.</p></header>{products.length ? <table><thead><tr><th>상품</th><th>총 주문수량</th><th>완료</th><th>남음</th></tr></thead><tbody>{products.map((product) => <tr key={product.productId}><td>{product.name}</td><td>{product.total}</td><td>{product.completed}</td><td><b>{product.remaining}</b></td></tr>)}</tbody></table> : <div className="workshop-empty">선택 날짜의 작업 상품이 없습니다.</div>}</section>}

      {tab === "completed" && <WorkSection title="준비완료" description="판매장에서 전달 또는 출고 처리할 수 있는 주문" orders={completed} empty="선택 날짜의 준비완료 주문이 없습니다." onSelect={setSelectedOrder} onAction={perform} busyOrderId={busyOrderId} />}
    </main>

    {selectedOrder && <WorkshopDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} onAction={perform} busy={busyOrderId === selectedOrder.id} />}
    {notice && <div className="ops-toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="알림 닫기">×</button></div>}
  </div>;
}

function WorkSection({ title, description, orders, empty, onSelect, onAction, busyOrderId, urgent = false }: { title: string; description: string; orders: WorkshopOrder[]; empty: string; onSelect: (order: WorkshopOrder) => void; onAction: (order: WorkshopOrder, action: WorkshopAction) => Promise<void>; busyOrderId: string; urgent?: boolean }) {
  return <section className={`workshop-section ${urgent ? "urgent-section" : ""}`}><header><div><small>{urgent ? "PRIORITY" : "WORK QUEUE"}</small><h2>{title} <b>{orders.length}</b>건</h2></div><p>{description}</p></header>{orders.length ? <div className="workshop-grid">{orders.map((order, index) => <WorkCard key={order.id} order={order} onSelect={onSelect} onAction={onAction} busy={busyOrderId === order.id} first={index === 0} urgent={urgent} />)}</div> : <div className="workshop-empty">{empty}</div>}</section>;
}

function WorkCard({ order, onSelect, onAction, busy, first = false, urgent = false }: { order: WorkshopOrder; onSelect: (order: WorkshopOrder) => void; onAction: (order: WorkshopOrder, action: WorkshopAction) => Promise<void>; busy: boolean; first?: boolean; urgent?: boolean }) {
  const action = order.status === "confirmed" ? order.workAcceptedAt ? "start" : "accept" : order.status === "in_progress" ? "complete" : null;
  const actionText = action === "accept" ? "작업 수락" : action === "start" ? "작업 시작" : action === "complete" ? "상품 준비완료" : order.status === "submitted" ? "판매장 확인 대기" : "준비완료";
  const progress = order.packageTotal > 0 ? `${order.packageCompleted} / ${order.packageTotal} 완료` : null;
  return <article className={`workshop-card ${urgent ? "urgent" : ""}`}>
    {first && <div className="first-work">가장 먼저 확인해주세요</div>}
    <header><div><small>{order.fulfillmentType === "pickup" ? `${workshopScheduleTime(order)} 방문` : `${order.shipDate} 발송`}</small><h3>{order.buyerName}</h3></div><span className={`workshop-state ${order.status}`}>{workshopStatusLabel(order)}</span></header>
    <div className="workshop-badges">{order.customerArrived && order.status !== "ready" && <b>고객도착</b>}{order.hasUnacknowledgedChange && <b>변경 확인 필요</b>}{order.workAcceptedAt && order.status === "confirmed" && <span>수락됨</span>}</div>
    <div className="workshop-card-items">{order.items.map((item) => <p key={item.id}><span>{item.name}</span><strong>× {item.quantity}</strong></p>)}</div>
    {progress && <div className="workshop-progress"><span>package 진행</span><b>{progress}</b></div>}
    <button className="workshop-card-detail" onClick={() => onSelect(order)}>주문 상세 보기</button>
    <button className={`workshop-action ${action ?? "done"}`} disabled={!action || busy} onClick={(event) => { event.stopPropagation(); if (action) void onAction(order, action); }}>{busy ? "처리 중…" : actionText}</button>
  </article>;
}

function WorkshopDetail({ order, onClose, onAction, busy }: { order: WorkshopOrder; onClose: () => void; onAction: (order: WorkshopOrder, action: WorkshopAction) => Promise<void>; busy: boolean }) {
  const action = order.status === "confirmed" ? order.workAcceptedAt ? "start" : "accept" : order.status === "in_progress" ? "complete" : null;
  return <div className="workshop-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="workshop-drawer" role="dialog" aria-modal="true" aria-label={`${order.orderNo} 작업 상세`}><header><div><small>{order.orderNo}</small><h2>{order.buyerName}</h2></div><button onClick={onClose} aria-label="작업 상세 닫기">×</button></header>
    <section className="workshop-detail-grid"><p><span>수령방법</span><b>{order.fulfillmentType === "pickup" ? "방문수령" : "택배발송"}</b></p><p><span>일정</span><b>{order.scheduleLabel}</b></p><p><span>작업상태</span><b>{workshopStatusLabel(order)}</b></p><p><span>고객상태</span><b>{order.customerArrived ? "도착" : "도착 전"}</b></p></section>
    <section className="workshop-detail-items"><h3>작업 상품</h3>{order.items.map((item) => <div key={item.id}><b>{item.name}</b><span>× {item.quantity}</span>{item.packageTotal > 0 ? <small>{item.packageCompleted} / {item.packageTotal} 완료</small> : <small>package 생성 전</small>}</div>)}</section>
    {order.note && <section className="workshop-detail-note"><h3>작업 요청사항</h3><p>{order.note}</p></section>}
    <section className="workshop-detail-history"><h3>작업·변경 이력</h3>{order.events.length ? <ol>{order.events.map((event) => <li key={event.id}><b>{eventLabel[event.type] ?? event.type}</b><time>{new Date(event.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</time>{event.reason && <small>{event.reason}</small>}</li>)}</ol> : <p>표시할 작업 이력이 없습니다.</p>}</section>
    {action && <button className={`workshop-action ${action}`} disabled={busy} onClick={() => void onAction(order, action)}>{busy ? "처리 중…" : action === "accept" ? "작업 수락" : action === "start" ? "작업 시작" : "상품 준비완료"}</button>}
  </aside></div>;
}
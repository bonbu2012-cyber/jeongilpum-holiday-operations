/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import type { OrderRecord } from "./types";
import { fetchOrders } from "../lib/orders-client";
import {
  filterOperationalOrders,
  isTerminalOrder,
  scheduleDate,
  scheduleTime,
  sortOperationalOrders,
  summarizeOperationalOrders,
  workStatusLabel,
  type AttentionFilter,
  type SalesFilter,
} from "../lib/sales-operations";
import { operationalDateFromSearch } from "../lib/operational-date";
import AppNav from "./AppNav";
import CustomerLedgerApp from "./CustomerLedgerApp";
import SalesOrderDetail, { type SchedulePayload, type StatusChangeOptions } from "./SalesOrderDetail";
import { useResource } from "../ui/use-resource";
import "../operations-flow.css";
import "../sales-flow.css";

const todayInSeoul = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
};
const moveDate = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
};
const dateHeading = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return year + "년 " + month + "월 " + day + "일 (" + weekday + ")";
};
const initialSalesDate = () => typeof window === "undefined"
  ? todayInSeoul()
  : operationalDateFromSearch(window.location.search) ?? todayInSeoul();

export default function SalesApp() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(initialSalesDate);
  const [filter, setFilter] = useState<SalesFilter>("all");
  const [attention, setAttention] = useState<AttentionFilter>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OrderRecord[] | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searching, setSearching] = useState(false);
  const [lastSync, setLastSync] = useState("");
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerCustomerId, setLedgerCustomerId] = useState<string | null>(null);
  const {
    loading,
    reload: loadDate,
  } = useResource<{ orders?: OrderRecord[] }>(
    `/api/orders?date=${encodeURIComponent(selectedDate)}`,
    2500,
    {
      onData: (orderResponse) => {
        const nextOrders = orderResponse.orders ?? [];
        setOrders(nextOrders);
        setSelectedOrder((current) => current ? nextOrders.find((order) => order.id === current.id) ?? current : null);
        setError("");
        setLastSync(new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit",
        }).format(new Date()));
      },
      onError: (resourceError) => setError(resourceError.message || "판매장 데이터를 불러오지 못했습니다."),
    },
  );
  const refreshing = loading || searching;

  const search = async () => {
    if (!query.trim()) return setSearchResults(null);
    setSearching(true);
    try {
      setSearchResults(await fetchOrders({ q: query.trim() }));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "주문을 검색하지 못했습니다.");
    } finally {
      setSearching(false);
    }
  };
  const refreshSearch = async () => {
    if (searchResults !== null && query.trim()) setSearchResults(await fetchOrders({ q: query.trim() }));
  };
  const refreshAll = async () => {
    await Promise.all([loadDate(), refreshSearch()]);
  };
  const updateStatus = async (order: OrderRecord, status: "confirmed" | "fulfilled" | "cancelled", options?: StatusChangeOptions) => {
    const response = await fetch("/api/orders/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, status, expectedVersion: order.version, ...options }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setNotice(data.error ?? "상태를 변경하지 못했습니다.");
      return false;
    }
    setNotice(status === "confirmed" ? "작업장에 주문을 전달했습니다." : status === "cancelled" ? "주문을 취소하고 이력을 남겼습니다." : order.fulfillmentType === "shipping" ? "출고 완료로 기록했습니다." : "전달 완료로 기록했습니다.");
    await refreshAll();
    if (status === "cancelled") setSelectedOrder(null);
    return true;
  };
  const markArrival = async (order: OrderRecord) => {
    const response = await fetch("/api/orders/arrival", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    });
    const data = await response.json() as { error?: string; alreadyArrived?: boolean };
    if (!response.ok) return setNotice(data.error ?? "고객 도착을 기록하지 못했습니다.");
    setNotice(data.alreadyArrived ? "이미 고객 도착이 기록된 주문입니다." : "고객 도착을 작업장에 알렸습니다.");
    await refreshAll();
  };
  const assignSchedule = async (order: OrderRecord, payload: SchedulePayload) => {
    const response = await fetch("/api/orders/fulfillment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, ...payload }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setNotice(data.error ?? "일정을 저장하지 못했습니다.");
      return false;
    }
    setNotice("기존 주문에 수령 일정이 지정되었습니다.");
    await refreshAll();
    return true;
  };
  const openLedger = (customerAccountId?: string | null) => {
    setLedgerCustomerId(customerAccountId ?? null);
    setLedgerOpen(true);
  };
  const logout = async () => {
    await fetch("/api/operator-session", { method: "DELETE" });
    location.reload();
  };

  const scheduledOrders = useMemo(() => orders.filter((order) =>
    order.fulfillmentId && order.status !== "cancelled" && scheduleDate(order) === selectedDate),
  [orders, selectedDate]);
  const legacyOrders = useMemo(() => orders.filter((order) => !order.fulfillmentId && order.status !== "cancelled"), [orders]);
  const now = new Date();
  const summary = summarizeOperationalOrders(scheduledOrders, now);
  const visibleOrders = sortOperationalOrders(filterOperationalOrders(scheduledOrders, filter, attention, now), now);
  const activeOrders = visibleOrders.filter((order) => !isTerminalOrder(order));
  const completedOrders = visibleOrders.filter((order) => isTerminalOrder(order));
  const filterOptions: { value: SalesFilter; label: string; count: number }[] = [
    { value: "all", label: "전체", count: summary.total },
    { value: "onsite", label: "현장", count: summary.onsite },
    { value: "pickup", label: "방문", count: summary.pickup },
    { value: "shipping", label: "택배", count: summary.shipping },
    { value: "incomplete", label: "미완료", count: summary.total - summary.fulfilled },
    { value: "ready", label: "준비완료", count: summary.ready },
  ];

  return <div className="ops-app sales-app">
    <header className="ops-header sales-header">
      <a href="/sales" className="ops-brand"><img className="operations-brand-logo" src="/jeongilpum-logo.png" alt="정일품 정육식당 로고"/><span>정일품 주문관리<small>판매장 운영</small></span></a>
      <div className="ops-alerts"><button onClick={() => void loadDate()} disabled={refreshing}>{refreshing ? "동기화 중…" : "지금 새로고침"}</button><button onClick={() => void logout()}>로그아웃</button></div>
    </header>
    <AppNav current="sales" />

    <main className="ops-main sales-main">
      <section className="sales-date-toolbar" aria-label="운영 날짜 선택">
        <button onClick={() => setSelectedDate(moveDate(selectedDate, -1))}>← 이전날</button>
        <div><small>{selectedDate === todayInSeoul() ? "오늘" : "선택 날짜"}</small><h1>{dateHeading(selectedDate)}</h1><span>최근 동기화 {lastSync || "준비 중"} · 약 3초 간격 자동 반영</span></div>
        <button onClick={() => setSelectedDate(moveDate(selectedDate, 1))}>다음날 →</button>
        <label><span>달력</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
      </section>

      {error && <div className="access-error sales-load-error" role="alert"><b>판매장 주문을 불러오지 못했습니다</b><span>{error}</span><button onClick={() => location.reload()}>화면 새로고침</button></div>}

      <section className="sales-summary" aria-label="선택 날짜 운영 요약">
        <div className="sales-summary-total"><small>{selectedDate === todayInSeoul() ? "오늘 주문" : "선택일 주문"}</small><b>{summary.total}</b></div>
        <dl>
          <div><dt>미준비</dt><dd>{summary.waiting}</dd></div><div><dt>작업중</dt><dd>{summary.inProgress}</dd></div>
          <div><dt>준비완료</dt><dd>{summary.ready}</dd></div><div><dt>판매/전달/출고완료</dt><dd>{summary.fulfilled}</dd></div>
          <div><dt>현장판매</dt><dd>{summary.onsite}</dd></div><div><dt>방문수령</dt><dd>{summary.pickup}</dd></div><div><dt>택배발송</dt><dd>{summary.shipping}</dd></div>
          <div><dt>고객도착</dt><dd>{summary.arrived}</dd></div><div><dt>변경확인</dt><dd>{summary.changes}</dd></div>
        </dl>
      </section>

      <section className="sales-attention" aria-label="긴급 확인">
        <button className={attention === "arrived" ? "active" : ""} onClick={() => setAttention(attention === "arrived" ? null : "arrived")}>고객도착 <b>{summary.arrived}</b></button>
        <button className={attention === "due-soon" ? "active" : ""} onClick={() => setAttention(attention === "due-soon" ? null : "due-soon")}>30분 이내 수령 미완료 <b>{summary.dueSoon}</b></button>
        <button className={attention === "changes" ? "active" : ""} onClick={() => setAttention(attention === "changes" ? null : "changes")}>주문변경 미확인 <b>{summary.changes}</b></button>
        {attention && <button className="clear-attention" onClick={() => setAttention(null)}>주의 필터 해제</button>}
      </section>

      <section className="sales-search-panel">
        <div className="sales-search"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void search()} placeholder="이름 · 전화번호 · 주문번호 · 받는분 · 기업명 검색" aria-label="전체 주문 통합 검색" /><button onClick={() => void search()}>전체 이력 검색</button></div>
        <button className="customer-ledger-open" onClick={() => openLedger()}>고객 결제·미수 장부</button>
        <button className="legacy-count" onClick={() => setShowLegacy((value) => !value)}>일정 미지정 주문 <b>{legacyOrders.length}</b>건</button>
      </section>

      {searchResults !== null && <section className="sales-search-results"><header><div><small>날짜와 무관한 전체 주문 이력</small><h2>검색 결과 {searchResults.length}건</h2></div><button onClick={() => setSearchResults(null)}>검색 결과 닫기</button></header><OrderTable orders={sortOperationalOrders(searchResults)} onSelect={setSelectedOrder} history /></section>}
      {showLegacy && <section className="sales-legacy-results"><header><div><small>LEGACY</small><h2>일정 미지정 주문 {legacyOrders.length}건</h2></div><p>기존 주문 원본 날짜는 추정하지 않습니다.</p></header><OrderTable orders={legacyOrders} onSelect={setSelectedOrder} /></section>}

      <section className="sales-order-section">
        <header className="sales-table-tools"><div className="sales-filters">{filterOptions.map((option) => <button key={option.value} className={filter === option.value ? "active" : ""} onClick={() => setFilter(option.value)}>{option.label} <b>{option.count}</b></button>)}</div><span>행을 누르면 주문 상세가 열립니다. 메인표에서는 수정할 수 없습니다.</span></header>
        <OrderTable orders={activeOrders} onSelect={setSelectedOrder} />
        {!activeOrders.length && <div className="sales-empty">조건에 맞는 미완료 주문이 없습니다.</div>}
        {completedOrders.length > 0 && <section className="sales-completed"><button onClick={() => setShowCompleted((value) => !value)}>판매/전달/출고 완료 {completedOrders.length}건 {showCompleted ? "접기 ↑" : "펼치기 ↓"}</button>{showCompleted && <OrderTable orders={completedOrders} onSelect={setSelectedOrder} />}</section>}
      </section>

    </main>

    {selectedOrder && <SalesOrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} onArrival={markArrival} onStatus={updateStatus} onOpenLedger={openLedger} assignSchedule={assignSchedule} />}
    {ledgerOpen && <CustomerLedgerApp initialCustomerId={ledgerCustomerId} onClose={() => { setLedgerOpen(false); setLedgerCustomerId(null); }} onChanged={() => void refreshAll()} />}
    {notice && <div className="ops-toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="알림 닫기">×</button></div>}
  </div>;
}

function OrderTable({ orders, onSelect, history = false }: { orders: OrderRecord[]; onSelect: (order: OrderRecord) => void; history?: boolean }) {
  return <div className="sales-table-scroll"><table className="sales-order-table">
    <thead><tr><th>시간</th><th>고객</th><th>상품</th><th>수량</th><th>구분</th><th>작업상태</th><th>결제</th><th>고객상태</th><th>변경</th></tr></thead>
    <tbody>{orders.map((order) => {
      const progress = order.packageTotal > 0 ? order.packageCompleted + " / " + order.packageTotal + " 완료" : null;
      return <tr key={order.id} className={[order.customerArrived && !isTerminalOrder(order) ? "arrived" : "", order.status === "cancelled" ? "cancelled" : ""].filter(Boolean).join(" ")} tabIndex={0} onClick={() => onSelect(order)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(order); }}>
        <td>{order.fulfillmentId ? scheduleTime(order) : "미지정"}</td>
        <td><b>{order.buyerName}</b><small>{order.orderNo}</small></td>
        <td>{order.items.map((item) => item.name).join(", ") || "-"}</td>
        <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
        <td>{order.fulfillmentId ? (order.fulfillmentType === "onsite" ? "현장" : order.fulfillmentType === "pickup" ? "방문" : "택배") : "기존"}</td>
        <td><span className={"sales-work-state " + order.status}>{history && order.status === "cancelled" ? "취소" : workStatusLabel(order)}</span>{progress && <small>{progress}</small>}</td>
        <td><PaymentStatus order={order} /></td>
        <td>{order.customerArrived ? <b className="arrived-label">도착</b> : "-"}</td>
        <td>{order.hasUnacknowledgedChange ? <b className="change-label">미확인</b> : "-"}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function PaymentStatus({ order }: { order: OrderRecord }) {
  const label = {
    credit: order.customerReceivable > 0 ? "외상 " + order.customerReceivable.toLocaleString("ko-KR") + "원" : "외상",
    partial: "부분 " + order.customerReceivable.toLocaleString("ko-KR") + "원",
    paid: "완료",
    advance: "선수 " + order.customerAdvance.toLocaleString("ko-KR") + "원",
  }[order.customerPaymentStatus];
  return <b className={"customer-payment-label " + order.customerPaymentStatus}>{label}</b>;
}

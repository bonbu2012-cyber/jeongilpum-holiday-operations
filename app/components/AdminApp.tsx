"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderRecord, OrderStatus } from "./types";
import { fetchOrders } from "../lib/orders-client";
import AppNav from "./AppNav";
import "../operations-flow.css";

type View = "home" | "search" | "pickup" | "shipping";
type SchedulePayload = {
  fulfillmentType: "pickup" | "shipping";
  pickupDate?: string;
  pickupTime?: string;
  shipDate?: string;
};

const statusLabel: Record<OrderStatus, string> = {
  submitted: "접수",
  confirmed: "작업 대기",
  in_progress: "작업 중",
  ready: "준비 완료",
  fulfilled: "전달 완료",
  cancelled: "취소",
};
const won = (value: number) => value.toLocaleString("ko-KR") + "원";
const todayInSeoul = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const pickupTimes = Array.from({ length: 27 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export default function AdminApp() {
  const [view, setView] = useState<View>("home");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayInSeoul);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState("");

  const currentQuery = useCallback(
    () => ({
      q: view === "search" ? query : "",
      date: view === "pickup" || view === "shipping" ? selectedDate : "",
    }),
    [query, selectedDate, view],
  );
  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setRefreshing(true);
      try {
        setOrders(await fetchOrders(currentQuery()));
        setError("");
        setLastSync(
          new Intl.DateTimeFormat("ko-KR", {
            timeZone: "Asia/Seoul",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date()),
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "주문을 불러오지 못했습니다.",
        );
      } finally {
        setRefreshing(false);
      }
    },
    [currentQuery],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    const timer = setInterval(() => void load({ silent: true }), 2500);
    const sync = () => void load({ silent: true });
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
    };
  }, [load]);

  const update = async (
    order: OrderRecord,
    status: "confirmed" | "fulfilled",
  ) => {
    const response = await fetch("/api/orders/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        status,
        expectedVersion: order.version,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error ?? "상태를 변경하지 못했습니다.");
      return;
    }
    setNotice(
      status === "confirmed"
        ? "주문을 확인하고 작업장에 전달했습니다."
        : "고객 전달을 완료했습니다.",
    );
    await load();
  };

  const assignSchedule = async (
    order: OrderRecord,
    payload: SchedulePayload,
  ) => {
    const response = await fetch("/api/orders/fulfillment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, ...payload }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error ?? "일정을 저장하지 못했습니다.");
      return false;
    }
    setNotice("기존 주문에 수령 일정이 지정되었습니다.");
    await load();
    return true;
  };

  const list = useMemo(
    () =>
      orders.filter((order) => {
        if (view === "pickup")
          return (
            order.status !== "cancelled" &&
            (!order.fulfillmentId ||
              (order.fulfillmentType === "pickup" &&
                order.status !== "fulfilled"))
          );
        if (view === "shipping")
          return (
            order.status !== "cancelled" &&
            (!order.fulfillmentId ||
              (order.fulfillmentType === "shipping" &&
                order.status !== "fulfilled"))
          );
        return true;
      }),
    [orders, view],
  );
  const submittedOrders = useMemo(
    () => orders.filter((order) => order.status === "submitted"),
    [orders],
  );
  const unscheduledOrders = useMemo(
    () => orders.filter((order) => !order.fulfillmentId && order.status !== "cancelled"),
    [orders],
  );
  const missingAddress = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.fulfillmentId &&
          order.status !== "cancelled" &&
          order.fulfillmentType === "shipping" &&
          (!order.roadAddress || !order.postalCode),
      ),
    [orders],
  );

  return (
    <div className="ops-app">
      <header className="ops-header">
        <a href="/admin" className="ops-brand">
          <b>正</b>
          <span>
            정일품 주문관리<small>판매장</small>
          </span>
        </a>
        <div className="ops-alerts">
          <button onClick={() => void load()} disabled={refreshing}>
            {refreshing ? "동기화 중…" : "새로고침"}
          </button>
          <a href="/signout-with-chatgpt?return_to=/">로그아웃</a>
        </div>
      </header>

      <AppNav current="admin" />
      <main className="ops-main">
        {view === "home" ? (
          <>
            <div className="ops-welcome">
              <small>실제 주문 데이터</small>
              <h1>무엇을 도와드릴까요?</h1>
              <p>
                최근 동기화 {lastSync || "준비 중"} · 최대 3초 간격 자동 반영
              </p>
            </div>
            <div className="task-buttons">
              <button onClick={() => setView("search")}>
                <span>⌕</span>
                <div>
                  <b>주문 찾기</b>
                  <small>이름·전화번호·주문번호로 찾기</small>
                </div>
                <i>→</i>
              </button>
              <a href="/kiosk">
                <span>＋</span>
                <div>
                  <b>주문 받기</b>
                  <small>판매장에서 새 주문 접수</small>
                </div>
                <i>→</i>
              </a>
              <button onClick={() => setView("pickup")}>
                <span>♧</span>
                <div>
                  <b>상품 찾아가기</b>
                  <small>날짜별 방문수령 주문 확인</small>
                </div>
                <i>→</i>
              </button>
              <button onClick={() => setView("shipping")}>
                <span>▣</span>
                <div>
                  <b>보낼 상품</b>
                  <small>발송일별 주소와 준비상태 확인</small>
                </div>
                <i>→</i>
              </button>
            </div>
            <section className="attention">
              <h2>실제 주문 확인사항</h2>
              {unscheduledOrders.length ? (
                <button onClick={() => setView("search")}>
                  <span className="critical">{unscheduledOrders.length}</span>
                  <div>
                    <b>일정 미지정 주문 {unscheduledOrders.length}건</b>
                    <small>기존 주문 원본은 유지되며 관리자가 직접 지정합니다.</small>
                  </div>
                  <i>→</i>
                </button>
              ) : null}
              {submittedOrders.length ? (
                <button onClick={() => setView("search")}>
                  <span className="warning">{submittedOrders.length}</span>
                  <div>
                    <b>확인 대기 주문 {submittedOrders.length}건</b>
                    <small>접수된 실제 주문입니다.</small>
                  </div>
                  <i>→</i>
                </button>
              ) : (
                <p className="ops-clear">현재 확인 대기 주문이 없습니다.</p>
              )}
              {missingAddress.length ? (
                <button onClick={() => setView("shipping")}>
                  <span className="critical">{missingAddress.length}</span>
                  <div>
                    <b>주소 확인 필요 {missingAddress.length}건</b>
                    <small>실제 배송 주문의 주소를 확인해주세요.</small>
                  </div>
                  <i>→</i>
                </button>
              ) : null}
            </section>
            <section className="recent-orders">
              <header>
                <div>
                  <small>LIVE ORDERS · D1</small>
                  <h2>
                    접수된 주문 <b>{submittedOrders.length}</b>
                  </h2>
                </div>
                <button onClick={() => void load()} disabled={refreshing}>
                  지금 새로고침
                </button>
              </header>
              <div className="admin-order-list">
                {submittedOrders.length ? (
                  submittedOrders
                    .slice(0, 5)
                    .map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        update={update}
                        assignSchedule={assignSchedule}
                        refresh={() => void load()}
                      />
                    ))
                ) : (
                  <div className="empty-orders">새로 접수된 주문이 없습니다.</div>
                )}
              </div>
            </section>
          </>
        ) : (
          <OrderWorkspace
            view={view}
            setView={setView}
            list={list}
            query={query}
            setQuery={setQuery}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            search={() => void load()}
            update={update}
            assignSchedule={assignSchedule}
            refresh={() => void load()}
            refreshing={refreshing}
          />
        )}
        {error && (
          <div className="access-error">
            <b>운영 화면에 연결할 수 없습니다</b>
            <span>{error}</span>
            <a href="/signin-with-chatgpt?return_to=/admin">운영자 로그인</a>
          </div>
        )}
        {notice && (
          <div className="ops-toast" role="status">
            {notice}
            <button onClick={() => setNotice("")} aria-label="알림 닫기">
              ×
            </button>
          </div>
        )}
      </main>
      <nav className="bottom-nav">
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><span>⌂</span>홈</button>
        <button className={view === "search" ? "active" : ""} onClick={() => setView("search")}><span>⌕</span>주문</button>
        <button className={view === "pickup" ? "active" : ""} onClick={() => setView("pickup")}><span>♧</span>방문수령</button>
        <button className={view === "shipping" ? "active" : ""} onClick={() => setView("shipping")}><span>▣</span>배송</button>
        <button onClick={() => void load()}><span>↻</span>새로고침</button>
      </nav>
    </div>
  );
}

function OrderCard({
  order,
  update,
  assignSchedule,
  refresh,
}: {
  order: OrderRecord;
  update: (order: OrderRecord, status: "confirmed" | "fulfilled") => void;
  assignSchedule: (order: OrderRecord, payload: SchedulePayload) => Promise<boolean>;
  refresh: () => void;
}) {
  return (
    <article className={`admin-order-card ${!order.fulfillmentId ? "legacy-order" : ""}`}>
      <header>
        <span>
          <small>{order.orderNo}</small>
          <b>{order.buyerName}</b>
        </span>
        <em className={order.fulfillmentId ? `state ${order.status}` : "state legacy"}>
          {order.fulfillmentId ? statusLabel[order.status] : "기존 주문"}
        </em>
      </header>
      <div className="order-card-body">
        <p><span>연락처</span><b>{order.buyerPhone}</b></p>
        <p><span>상품</span><b>{order.items.map((item) => `${item.name} × ${item.quantity}`).join(", ")}</b></p>
        <p><span>받는 방법</span><b>{order.fulfillmentId ? (order.fulfillmentType === "pickup" ? "방문수령" : "택배발송") : "관리자 지정 필요"}</b></p>
        <p><span>일정</span><b>{order.scheduleLabel}</b></p>
        <p><span>주문금액</span><b>{won(order.totalAmount)}</b></p>
        {order.fulfillmentType === "shipping" && (
          <>
            <p><span>우편번호</span><b>{order.postalCode || "기존 주문 정보 없음"}</b></p>
            <p><span>주소</span><b>{order.roadAddress || "주소 미입력"} {order.detailAddress}</b></p>
          </>
        )}
      </div>
      <PaymentPanel order={order} onSaved={refresh} />
      {!order.fulfillmentId ? (
        <ScheduleEditor order={order} assignSchedule={assignSchedule} />
      ) : (
        <footer>
          {order.status === "submitted" && <button className="task-primary" onClick={() => update(order, "confirmed")}>주문 확인 · 작업장 전달</button>}
          {order.status === "ready" && order.fulfillmentType === "pickup" && <button className="task-primary" onClick={() => update(order, "fulfilled")}>전달 완료</button>}
        </footer>
      )}
    </article>
  );
}

function PaymentPanel({ order, onSaved }: { order: OrderRecord; onSaved: () => void }) {
  const statusText = {
    credit: "외상",
    partial: "부분 결제",
    paid: "결제 완료",
    advance: "선수금",
  }[order.customerPaymentStatus];

  return <section className="payment-panel">
    <header><h3>고객 결제·미수</h3><em className={`payment-state ${order.customerPaymentStatus}`}>{statusText}</em></header>
    <div className="payment-summary">
      <p><span>고객 총 주문</span><b>{won(order.customerTotalOrdered)}</b></p>
      <p><span>고객 순입금</span><b>{won(order.customerNetReceived)}</b></p>
      <p><span>현재 미수금</span><b>{won(order.customerReceivable)}</b></p>
      <p><span>현재 선수금</span><b>{won(order.customerAdvance)}</b></p>
    </div>
    <p className="credit-note">결제 등록·정정과 고객 미수 관리는 판매장의 고객 장부에서 처리합니다.</p>
    <div className="payment-actions"><a className="task-primary" href="/sales" onClick={onSaved}>판매장 고객 장부 열기</a></div>
  </section>;
}

function ScheduleEditor({
  order,
  assignSchedule,
}: {
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
    const saved = await assignSchedule(
      order,
      fulfillmentType === "pickup"
        ? { fulfillmentType, pickupDate: date, pickupTime: time }
        : { fulfillmentType, shipDate: date },
    );
    setSaving(false);
    if (saved) setOpen(false);
  };

  if (!open)
    return (
      <footer className="legacy-actions">
        <p>기존 주문의 날짜를 추정하지 않습니다. 주문상세를 확인하고 직접 지정해주세요.</p>
        <button className="task-primary" onClick={() => setOpen(true)}>수령방법·일정 지정</button>
      </footer>
    );

  return (
    <footer className="legacy-schedule-editor">
      <h3>기존 주문 일정 지정</h3>
      <label>
        <span>수령방법</span>
        <select value={fulfillmentType} onChange={(event) => setFulfillmentType(event.target.value as "pickup" | "shipping")}>
          <option value="pickup">방문수령</option>
          <option value="shipping">택배발송</option>
        </select>
      </label>
      <label>
        <span>{fulfillmentType === "pickup" ? "방문 날짜" : "발송 날짜"}</span>
        <input type="date" min={todayInSeoul()} value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      {fulfillmentType === "pickup" && (
        <label>
          <span>방문 시간</span>
          <select value={time} onChange={(event) => setTime(event.target.value)}>
            {pickupTimes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      )}
      <div className="legacy-editor-buttons">
        <button onClick={() => setOpen(false)} disabled={saving}>취소</button>
        <button className="task-primary" onClick={() => void save()} disabled={saving || !date}>{saving ? "저장 중…" : "일정 저장"}</button>
      </div>
    </footer>
  );
}

function OrderWorkspace({
  view,
  setView,
  list,
  query,
  setQuery,
  selectedDate,
  setSelectedDate,
  search,
  update,
  assignSchedule,
  refresh,
  refreshing,
}: {
  view: Exclude<View, "home">;
  setView: (value: View) => void;
  list: OrderRecord[];
  query: string;
  setQuery: (value: string) => void;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  search: () => void;
  update: (order: OrderRecord, status: "confirmed" | "fulfilled") => void;
  assignSchedule: (order: OrderRecord, payload: SchedulePayload) => Promise<boolean>;
  refresh: () => void;
  refreshing: boolean;
}) {
  const title = view === "search" ? "주문 찾기" : view === "pickup" ? "상품 찾아가기" : "보낼 상품";
  const scheduled = view === "search" ? list : list.filter((order) => order.fulfillmentId);
  const unscheduled = list.filter((order) => !order.fulfillmentId);

  return (
    <section className="order-workspace">
      <button className="back-home" onClick={() => setView("home")}>← 홈으로</button>
      <div className="workspace-title">
        <small>현장 업무</small>
        <h1>{title}</h1>
        <p>{view === "pickup" ? "선택한 날짜의 방문 시간을 확인합니다." : view === "shipping" ? "선택한 발송일의 주소와 준비 상태를 확인합니다." : "고객 정보 또는 주문번호를 입력해주세요."}</p>
      </div>
      {view === "search" ? (
        <div className="order-search">
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="이름, 전화번호, 주문번호, 수령인" />
          <button onClick={search}>검색</button>
        </div>
      ) : (
        <div className="sales-date-filter">
          <label><span>조회 날짜</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
          <button onClick={refresh} disabled={refreshing}>{refreshing ? "조회 중…" : "새로고침"}</button>
        </div>
      )}
      <div className="admin-order-list">
        {scheduled.length ? scheduled.map((order) => <OrderCard key={order.id} order={order} update={update} assignSchedule={assignSchedule} refresh={refresh} />) : <div className="empty-orders">{view === "search" ? "검색된 주문이 없습니다." : "해당 날짜에 주문이 없습니다."}</div>}
      </div>
      {view !== "search" && (
        <section className="unscheduled-orders">
          <header>
            <div><small>LEGACY ORDERS</small><h2>일정 미지정 주문 <b>{unscheduled.length}</b></h2></div>
            <p>기존 주문 원본은 변경하지 않으며 관리자가 직접 지정합니다.</p>
          </header>
          <div className="admin-order-list">
            {unscheduled.length ? unscheduled.map((order) => <OrderCard key={order.id} order={order} update={update} assignSchedule={assignSchedule} refresh={refresh} />) : <div className="empty-orders">일정 미지정 주문이 없습니다.</div>}
          </div>
        </section>
      )}
    </section>
  );
}

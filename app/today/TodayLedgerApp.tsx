"use client";

import { useState, useCallback } from "react";
import type { TodayLedgerOrder } from "../api/today-ledger/route";
import { useResource } from "../ui";
import AppNav from "../components/AppNav";
import "./today-ledger.css";

type ViewTab = "all" | "shipping";

type LedgerApiResponse = {
  date: string;
  summary: {
    totalOrders: number;
    onsiteCount: number;
    shippingCount: number;
    unpaidCount: number;
  };
  onsiteOrders: TodayLedgerOrder[];
  shippingOrders: TodayLedgerOrder[];
};

function getTodayInSeoul(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(dateStr: string, days: number): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
}

export default function TodayLedgerApp() {
  const todayDateStr = getTodayInSeoul();
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const [activeTab, setActiveTab] = useState<ViewTab>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isToday = selectedDate === todayDateStr;

  // 선택된 날짜 파라미터 연동
  const apiUrl = selectedDate ? `/api/today-ledger?date=${selectedDate}` : "/api/today-ledger";
  const { data, error, loading, reload } = useResource<LedgerApiResponse>(
    apiUrl,
    5000,
  );

  const changeDateBy = (days: number) => {
    setSelectedDate((prev) => addDays(prev || todayDateStr, days));
  };

  const goToToday = () => {
    setSelectedDate(todayDateStr);
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  // 결제 상태 변경 핸들러 (미결제 -> 결제완료, 또는 결제완료 -> 미결제)
  const handlePaymentChange = useCallback(
    async (order: TodayLedgerOrder, targetStatus: "paid" | "unpaid") => {
      setUpdatingOrderId(order.orderId);
      setActionError(null);
      try {
        const paidAmount = targetStatus === "paid" ? order.totalAmount : 0;
        const res = await fetch("/api/orders/payment", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.orderId,
            paymentStatus: targetStatus,
            paidAmount,
            expectedVersion: order.orderVersion,
          }),
        });

        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error || `결제 정보 수정 실패 (${res.status})`);
        }

        // 성공 시 즉시 장부 새로고침
        await reload();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "결제 상태를 변경하지 못했습니다.";
        setActionError(msg);
        alert(msg);
      } finally {
        setUpdatingOrderId(null);
      }
    },
    [reload],
  );

  // 날짜 한국어 서식 (예: 2026년 9월 16일 (수))
  const formatKoreanDate = (dateStr: string) => {
    if (!dateStr) return "오늘";
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      return `${year}년 ${month}월 ${day}일 (${dayNames[date.getDay()]})`;
    } catch {
      return dateStr;
    }
  };

  const formatShortMonthDay = (dateStr: string) => {
    try {
      const [, month, day] = dateStr.split("-").map(Number);
      return `${month}/${day}`;
    } catch {
      return "";
    }
  };

  const onsiteOrders = data?.onsiteOrders || [];
  const shippingOrders = data?.shippingOrders || [];
  const displayDate = data?.date || selectedDate;

  return (
    <div className="ledger-root">
      <div className="ledger-container">
        {/* 1. 상단 헤더 */}
        <header className="ledger-header">
          <div className="ledger-header-top">
            <div className="ledger-title-group">
              <h1 className="ledger-title">
                {isToday ? "📋 정일품 오늘의 장부" : "📋 정일품 일자별 장부"}
              </h1>
              <span className="ledger-date-badge">
                {formatKoreanDate(displayDate)}
              </span>
            </div>
            <div className="ledger-header-actions">
              <span className="ledger-sync-indicator">
                {loading && !data ? "불러오는 중…" : "실시간 자동 갱신 중"}
              </span>
              <button
                type="button"
                className="ledger-refresh-btn"
                onClick={() => void reload()}
                disabled={loading}
              >
                {loading ? "새로고침 중…" : "🔄 새로고침"}
              </button>
            </div>
          </div>

          {/* 날짜별 검색 및 이동 툴바 */}
          <div className="ledger-date-toolbar" aria-label="장부 날짜 선택">
            <div className="ledger-date-nav-group">
              <button
                type="button"
                className="ledger-date-nav-btn"
                onClick={() => changeDateBy(-1)}
                title="하루 전 날짜로 이동"
              >
                ◀ 이전날
              </button>

              <div className="ledger-date-input-wrap">
                <span className="ledger-date-input-icon">📅</span>
                <input
                  id="ledger-target-date"
                  type="date"
                  className="ledger-date-input"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                    }
                  }}
                  aria-label="장부 조회 날짜"
                />
              </div>

              <button
                type="button"
                className="ledger-date-nav-btn"
                onClick={() => changeDateBy(1)}
                title="다음 날짜로 이동"
              >
                다음날 ▶
              </button>

              <button
                type="button"
                className={`ledger-today-btn ${isToday ? "active" : ""}`}
                onClick={goToToday}
                title="오늘 날짜로 바로 이동"
              >
                오늘 ({formatShortMonthDay(todayDateStr)})
              </button>
            </div>

            {/* 오늘이 아닌 날짜를 보고 있을 때 눈에 띄는 안내 배너 */}
            {!isToday && (
              <div className="ledger-date-notice">
                <span className="ledger-date-notice-text">
                  ⚠️ <strong>{formatKoreanDate(selectedDate)}</strong> 장부를 조회하고 있습니다.
                </span>
                <button
                  type="button"
                  className="ledger-date-return-btn"
                  onClick={goToToday}
                >
                  오늘 장부로 돌아가기
                </button>
              </div>
            )}
          </div>

          {/* 2. 상단 원터치 보기 전환 탭 (큰 글씨, 큰 버튼) */}
          <div className="ledger-view-tabs" role="tablist" aria-label="장부 보기 방식 선택">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              className={`ledger-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              📋 {isToday ? "오늘" : "선택일"} 전체 (방문 + 택배)
              <span className="ledger-tab-count">
                {data?.summary.totalOrders || 0}건
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "shipping"}
              className={`ledger-tab-btn ${activeTab === "shipping" ? "active" : ""}`}
              onClick={() => setActiveTab("shipping")}
            >
              📦 {isToday ? "오늘" : "선택일"} 택배만 모아보기
              <span className="ledger-tab-count">
                {data?.summary.shippingCount || 0}건
              </span>
            </button>
          </div>
        </header>

        {/* 액션 에러 알림 */}
        {actionError && (
          <div className="ledger-error-banner" role="alert">
            ⚠️ {actionError}
            <button
              type="button"
              className="ledger-error-banner-close"
              onClick={() => setActionError(null)}
            >
              닫기
            </button>
          </div>
        )}

        {/* 로딩 표시 */}
        {loading && !data && (
          <div className="ledger-loading-box">
            <p className="ledger-loading-text">장부를 불러오고 있습니다…</p>
          </div>
        )}

        {/* 에러 표시 */}
        {error && (
          <div className="ledger-error-box">
            <p className="ledger-error-text">⚠️ {error.message}</p>
            <button
              type="button"
              className="ledger-refresh-btn"
              onClick={() => void reload()}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 3. 장부 본문 리스트 */}
        {data && (
          <main>
            {/* A. [전체 보기 모드] 일 때의 매장 방문 수령 섹션 (시간대별) */}
            {activeTab === "all" && (
              <section aria-labelledby="onsite-heading">
                <div className="ledger-section-banner">
                  <h2 id="onsite-heading" className="ledger-section-title">
                    🏪 매장 방문 수령 (시간대순)
                  </h2>
                  <span className="ledger-section-count">
                    총 {onsiteOrders.length}건
                  </span>
                </div>

                {onsiteOrders.length === 0 ? (
                  <div className="ledger-empty-card">
                    <div className="ledger-empty-icon">🕒</div>
                    <p className="ledger-empty-text">
                      {isToday ? "오늘" : "선택하신 날짜에"} 예정된 매장 방문수령 주문이 없습니다.
                    </p>
                  </div>
                ) : (
                  <div className="ledger-card-list">
                    {onsiteOrders.map((order) => (
                      <OrderRowCard
                        key={order.orderId}
                        order={order}
                        isExpanded={expandedOrderId === order.orderId}
                        isUpdating={updatingOrderId === order.orderId}
                        onToggle={() => toggleExpand(order.orderId)}
                        onPaymentChange={handlePaymentChange}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* B. 택배 섹션 */}
            <section
              aria-labelledby="shipping-heading"
              style={{ marginTop: activeTab === "all" ? "32px" : "0px" }}
            >
              <div className="ledger-section-banner shipping-banner">
                <h2 id="shipping-heading" className="ledger-section-title">
                  📦 {isToday ? "오늘" : "선택일"} 택배 발송 {activeTab === "all" ? "(리스트 하단)" : ""}
                </h2>
                <span className="ledger-section-count">
                  총 {shippingOrders.length}건
                </span>
              </div>

              {shippingOrders.length === 0 ? (
                <div className="ledger-empty-card">
                  <div className="ledger-empty-icon">📦</div>
                  <p className="ledger-empty-text">
                    {isToday ? "오늘" : "선택하신 날짜에"} 발송할 택배 주문이 없습니다.
                  </p>
                </div>
              ) : (
                <div className="ledger-card-list">
                  {shippingOrders.map((order) => (
                    <OrderRowCard
                      key={order.orderId}
                      order={order}
                      isExpanded={expandedOrderId === order.orderId}
                      isUpdating={updatingOrderId === order.orderId}
                      onToggle={() => toggleExpand(order.orderId)}
                      onPaymentChange={handlePaymentChange}
                      alwaysShowAddress={activeTab === "shipping"}
                    />
                  ))}
                </div>
              )}
            </section>
          </main>
        )}
      </div>
      <AppNav current="today" />
    </div>
  );
}

// 1건의 주문을 5대 필수 항목 및 결제 변경 액션으로 렌더링하는 카드 컴포넌트
function OrderRowCard({
  order,
  isExpanded,
  isUpdating,
  onToggle,
  onPaymentChange,
  alwaysShowAddress = false,
}: {
  order: TodayLedgerOrder;
  isExpanded: boolean;
  isUpdating: boolean;
  onToggle: () => void;
  onPaymentChange: (order: TodayLedgerOrder, targetStatus: "paid" | "unpaid") => Promise<void>;
  alwaysShowAddress?: boolean;
}) {
  const [confirmingPay, setConfirmingPay] = useState(false);
  const [confirmingRevert, setConfirmingRevert] = useState(false);

  const isPaid = order.paymentStatus === "paid";
  const isPartial = order.paymentStatus === "partial";
  const statusClass = isPaid ? "paid" : isPartial ? "partial" : "unpaid";

  const paymentLabel = isPaid
    ? "결제완료"
    : isPartial
      ? `일부결제 (${order.balance.toLocaleString()}원 미수)`
      : "⚠️ 미결제";

  return (
    <div className={`ledger-row-card ${statusClass}`}>
      {/* 5대 핵심 항목을 클릭 가능한 네이티브 버튼으로 구성 (a11y 준수) */}
      <button
        type="button"
        className="ledger-row-main-btn"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${order.timeDisplay} ${order.buyerName} 주문 상세 열기/닫기`}
      >
        <div className="ledger-row-main">
          {/* 1. 수령시간 */}
          <div className="ledger-col-time">
            <span className="ledger-time-text">{order.timeDisplay}</span>
            {order.isShipping ? (
              <span className="ledger-delivery-tag">택배발송</span>
            ) : (
              order.deliveryMethod === "onsite_sale" && (
                <span className="ledger-delivery-tag">현장판매</span>
              )
            )}
          </div>

          {/* 2. 주문자 */}
          <div className="ledger-col-buyer">
            <div className="ledger-buyer-name">{order.buyerName}</div>
            <div className="ledger-buyer-phone">
              {order.buyerPhone || "연락처 없음"}
            </div>
            {order.isShipping && order.recipientName && order.recipientName !== order.buyerName && (
              <div className="ledger-recipient-hint">
                (받는분: {order.recipientName})
              </div>
            )}
          </div>

          {/* 3. 주문상품 */}
          <div className="ledger-col-items">
            <div className="ledger-items-summary">{order.itemsSummary}</div>
            <div className="ledger-order-no-hint">주문번호: {order.orderNo}</div>
            {alwaysShowAddress && order.recipientAddress && (
              <div style={{ marginTop: "6px" }}>
                <span
                  className="ledger-address-box"
                  style={{ display: "inline-block", fontSize: "16px", padding: "6px 12px" }}
                >
                  📍 {order.recipientAddress}
                </span>
              </div>
            )}
          </div>

          {/* 4. 총 금액 */}
          <div className="ledger-col-amount">
            <div className="ledger-amount-value">
              {order.totalAmount.toLocaleString()}원
            </div>
            {!isPaid && order.balance > 0 && (
              <div className="ledger-balance-hint">
                미수: {order.balance.toLocaleString()}원
              </div>
            )}
          </div>

          {/* 5. 결제여부 배지 (대형, 고대비) 및 결제 시점 */}
          <div className="ledger-col-payment">
            <span className={`ledger-pay-badge ${statusClass}`}>
              {paymentLabel}
            </span>
            {order.paidAtDisplay && (
              <span className="ledger-paid-time-hint">
                🕒 {order.paidAtDisplay} 결제
              </span>
            )}
          </div>
        </div>
      </button>

      {/* 터치 시 아래로 부드럽게 펼쳐지는 아코디언 상세 정보 및 수납 액션 */}
      {isExpanded && (
        <div className="ledger-row-details">
          {/* A. 수납/결제 변경 전용 액션 박스 (60대 실무자 맞춤형 대형 버튼) */}
          <div className="ledger-payment-action-card">
            {!isPaid ? (
              // 미결제 또는 일부결제 상태인 경우
              !confirmingPay ? (
                <div className="ledger-pay-prompt">
                  <div className="ledger-pay-prompt-text">
                    💳 손님이 수령 시 결제하셨나요?
                  </div>
                  <button
                    type="button"
                    className="ledger-btn-pay-complete"
                    onClick={() => setConfirmingPay(true)}
                    disabled={isUpdating}
                  >
                    💰 결제완료로 변경 (전액 수납 처리)
                  </button>
                </div>
              ) : (
                // 큼직한 인라인 확인 영역
                <div className="ledger-pay-confirm-box">
                  <div className="ledger-pay-confirm-msg">
                    ❓ <strong>{order.buyerName}</strong> 고객님의 주문 금액{" "}
                    <span className="ledger-pay-highlight">
                      {order.totalAmount.toLocaleString()}원
                    </span>
                    을 결제완료 처리하시겠습니까?
                    <div style={{ fontSize: "16px", color: "#15803d", marginTop: "6px", fontWeight: 600 }}>
                      ※ 처리 즉시 현재 시각으로 결제 완료 시점이 기록되며 사이트 전체에 실시간 연동됩니다.
                    </div>
                  </div>
                  <div className="ledger-pay-confirm-btns">
                    <button
                      type="button"
                      className="ledger-btn-confirm-yes"
                      onClick={async () => {
                        await onPaymentChange(order, "paid");
                        setConfirmingPay(false);
                      }}
                      disabled={isUpdating}
                    >
                      {isUpdating ? "처리 중…" : "✅ 네, 결제완료로 변경"}
                    </button>
                    <button
                      type="button"
                      className="ledger-btn-confirm-no"
                      onClick={() => setConfirmingPay(false)}
                      disabled={isUpdating}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )
            ) : (
              // 이미 결제완료 상태인 경우 (실수 정정용 되돌리기)
              !confirmingRevert ? (
                <div className="ledger-pay-done-row">
                  <div className="ledger-pay-done-info">
                    <span className="ledger-pay-done-msg">
                      ✅ 전액 결제 완료된 주문입니다. (수납액: {order.totalAmount.toLocaleString()}원)
                    </span>
                    {order.paidAtFull && (
                      <span className="ledger-paid-time-detail">
                        🕒 결제 완료 일시: {order.paidAtFull}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ledger-btn-pay-revert"
                    onClick={() => setConfirmingRevert(true)}
                    disabled={isUpdating}
                  >
                    ↩️ 미결제(미수)로 되돌리기
                  </button>
                </div>
              ) : (
                // 되돌리기 인라인 확인 영역
                <div className="ledger-pay-confirm-box revert">
                  <div className="ledger-pay-confirm-msg">
                    ❓ <strong>{order.buyerName}</strong> 고객님의 결제 상태를 다시{" "}
                    <strong style={{ color: "#dc2626" }}>미결제</strong>로 되돌리시겠습니까?
                  </div>
                  <div className="ledger-pay-confirm-btns">
                    <button
                      type="button"
                      className="ledger-btn-revert-yes"
                      onClick={async () => {
                        await onPaymentChange(order, "unpaid");
                        setConfirmingRevert(false);
                      }}
                      disabled={isUpdating}
                    >
                      {isUpdating ? "처리 중…" : "네, 미결제로 되돌리기"}
                    </button>
                    <button
                      type="button"
                      className="ledger-btn-confirm-no"
                      onClick={() => setConfirmingRevert(false)}
                      disabled={isUpdating}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          {order.customerNote && (
            <div className="ledger-customer-note-box">
              📢 고객 요청사항: {order.customerNote}
            </div>
          )}

          {order.adminNote && (
            <div className="ledger-detail-item">
              <span className="ledger-detail-label">관리자 메모:</span>
              <span className="ledger-detail-value">{order.adminNote}</span>
            </div>
          )}

          {order.isShipping && order.recipientAddress && (
            <div className="ledger-address-box">
              🚚 배송 주소: {order.recipientAddress} (수령인: {order.recipientName},{" "}
              {order.recipientPhone})
            </div>
          )}

          <div className="ledger-detail-item">
            <span className="ledger-detail-label">상품 세부내역:</span>
            <div className="ledger-detail-value">
              {order.items.map((item, idx) => (
                <div key={idx} style={{ marginBottom: "4px" }}>
                  • {item.name} × {item.quantity}개 ({item.lineTotal.toLocaleString()}원)
                  {item.customizationSummary && (
                    <span style={{ color: "#d97706", marginLeft: "8px" }}>
                      [{item.customizationSummary}]
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="ledger-detail-item">
            <span className="ledger-detail-label">수납 상태:</span>
            <span className="ledger-detail-value">
              총 {order.totalAmount.toLocaleString()}원 중 {order.paidAmount.toLocaleString()}원 입금됨
              {order.balance > 0 ? ` (미수 잔액: ${order.balance.toLocaleString()}원)` : " (완납)"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

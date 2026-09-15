"use client";

import { useState } from "react";
import type { TodayLedgerOrder } from "../api/today-ledger/route";
import { useResource } from "../ui";
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

export default function TodayLedgerApp() {
  const [activeTab, setActiveTab] = useState<ViewTab>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // 프로젝트 표준 useResource 훅 사용 (5초 주기 자동 갱신)
  const { data, error, loading, reload } = useResource<LedgerApiResponse>(
    "/api/today-ledger",
    5000,
  );

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

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

  const onsiteOrders = data?.onsiteOrders || [];
  const shippingOrders = data?.shippingOrders || [];

  return (
    <div className="ledger-root">
      <div className="ledger-container">
        {/* 1. 상단 헤더 */}
        <header className="ledger-header">
          <div className="ledger-header-top">
            <div className="ledger-title-group">
              <h1 className="ledger-title">📋 정일품 오늘의 장부</h1>
              <span className="ledger-date-badge">
                {data?.date ? formatKoreanDate(data.date) : "오늘"}
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

          {/* 2. 상단 원터치 보기 전환 탭 (큰 글씨, 큰 버튼) */}
          <div className="ledger-view-tabs" role="tablist" aria-label="장부 보기 방식 선택">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              className={`ledger-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              📋 오늘 전체 (방문 + 택배)
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
              📦 오늘 택배만 모아보기
              <span className="ledger-tab-count">
                {data?.summary.shippingCount || 0}건
              </span>
            </button>
          </div>
        </header>

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
                    <p className="ledger-empty-text">오늘 예정된 매장 방문수령 주문이 없습니다.</p>
                  </div>
                ) : (
                  <div className="ledger-card-list">
                    {onsiteOrders.map((order) => (
                      <OrderRowCard
                        key={order.orderId}
                        order={order}
                        isExpanded={expandedOrderId === order.orderId}
                        onToggle={() => toggleExpand(order.orderId)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* B. 택배 섹션 */}
            {/* - [전체 모드]인 경우: 방문 수령 아래에 명확한 구분과 함께 하단 배치 */}
            {/* - [택배만 모아보기 모드]인 경우: 전체 화면에 단독 집중 표시 */}
            <section
              aria-labelledby="shipping-heading"
              style={{ marginTop: activeTab === "all" ? "32px" : "0px" }}
            >
              <div className="ledger-section-banner shipping-banner">
                <h2 id="shipping-heading" className="ledger-section-title">
                  📦 오늘 택배 발송 {activeTab === "all" ? "(리스트 하단)" : ""}
                </h2>
                <span className="ledger-section-count">
                  총 {shippingOrders.length}건
                </span>
              </div>

              {shippingOrders.length === 0 ? (
                <div className="ledger-empty-card">
                  <div className="ledger-empty-icon">📦</div>
                  <p className="ledger-empty-text">오늘 발송할 택배 주문이 없습니다.</p>
                </div>
              ) : (
                <div className="ledger-card-list">
                  {shippingOrders.map((order) => (
                    <OrderRowCard
                      key={order.orderId}
                      order={order}
                      isExpanded={expandedOrderId === order.orderId}
                      onToggle={() => toggleExpand(order.orderId)}
                      alwaysShowAddress={activeTab === "shipping"}
                    />
                  ))}
                </div>
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

// 1건의 주문을 5대 필수 항목으로 큼직하게 렌더링하는 카드 컴포넌트
function OrderRowCard({
  order,
  isExpanded,
  onToggle,
  alwaysShowAddress = false,
}: {
  order: TodayLedgerOrder;
  isExpanded: boolean;
  onToggle: () => void;
  alwaysShowAddress?: boolean;
}) {
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
                <span className="ledger-address-box" style={{ display: "inline-block", fontSize: "16px", padding: "6px 12px" }}>
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

          {/* 5. 결제여부 배지 (대형, 고대비) */}
          <div className="ledger-col-payment">
            <span className={`ledger-pay-badge ${statusClass}`}>
              {paymentLabel}
            </span>
          </div>
        </div>
      </button>

      {/* 터치 시 아래로 부드럽게 펼쳐지는 아코디언 상세 정보 */}
      {isExpanded && (
        <div className="ledger-row-details">
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
              🚚 배송 주소: {order.recipientAddress} (수령인: {order.recipientName}, {order.recipientPhone})
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

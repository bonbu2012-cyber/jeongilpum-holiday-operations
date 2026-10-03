"use client";

import { useState, useEffect } from "react";
import { Modal, Button } from "../ui";
import "../sales/product-stats.css";

type ProductStat = {
  key: string;
  category: string;
  categoryOrder: number;
  displayName: string;
  unitPrice: number;
  totalQuantity: number;
  totalAmount: number;
  sharePercent: number;
  customDetails: string[];
};

type CategoryStat = {
  categoryName: string;
  categoryOrder: number;
  totalQuantity: number;
  totalAmount: number;
  products: ProductStat[];
};

type PaymentBreakdown = {
  paidOrders: number;
  paidAmount: number;
  unpaidOrders: number;
  unpaidAmount: number;
};

type DailyStat = {
  date: string;
  dayOfWeek: string;
  totalOrders: number;
  totalProductKinds: number;
  totalQuantity: number;
  totalAmount: number;
  paidOrders: number;
  paidAmount: number;
  unpaidOrders: number;
  unpaidAmount: number;
  categories: CategoryStat[];
  products: ProductStat[];
};

type StatsResponse = {
  startDate: string;
  endDate: string;
  dateType: "due" | "reception";
  isSingleDay: boolean;
  summary: {
    totalOrders: number;
    totalProductKinds: number;
    totalQuantity: number;
    totalAmount: number;
    paymentBreakdown: PaymentBreakdown;
  };
  categories: CategoryStat[];
  dailyList?: DailyStat[];
};

const won = (value: number) => value.toLocaleString("ko-KR") + "원";

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default function ProductSalesStatsModal({
  open,
  initialDate,
  onClose,
}: {
  open: boolean;
  initialDate?: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"day" | "period">("day");
  const [dateType, setDateType] = useState<"due" | "reception">("due");
  const [activeTab, setActiveTab] = useState<"overview" | "daily">("overview");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [startDate, setStartDate] = useState(() => initialDate || todayInSeoul());
  const [endDate, setEndDate] = useState(() => initialDate || todayInSeoul());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const [prevDateProp, setPrevDateProp] = useState(initialDate);
  if (initialDate !== prevDateProp) {
    setPrevDateProp(initialDate);
    if (initialDate) {
      setStartDate(initialDate);
      setEndDate(initialDate);
    }
  }

  // 통계 데이터 패치
  useEffect(() => {
    if (!open) return;
    let ignore = false;

    const targetEnd = mode === "day" ? startDate : endDate;
    const url = `/api/sales/product-stats?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(targetEnd)}&dateType=${dateType}`;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const errData = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(errData?.error || "통계 데이터를 불러오지 못했습니다.");
        }
        const json = await res.json() as StatsResponse;
        if (!ignore) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "통계를 불러오지 못했습니다.");
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      ignore = true;
    };
  }, [open, startDate, endDate, mode, dateType]);

  const handleModeChange = (newMode: "day" | "period") => {
    setMode(newMode);
    if (newMode === "day") {
      setEndDate(startDate);
    } else {
      // 기간별 선택 시 일자별 리스트 탭을 권장하거나 기본 선택 가능
      if (activeTab === "daily") {
        // 이미 daily 탭이면 유지
      }
    }
  };

  const setPreset = (type: "today" | "yesterday" | "week" | "month" | "holiday") => {
    const today = todayInSeoul();
    if (type === "today") {
      setMode("day");
      setStartDate(today);
      setEndDate(today);
    } else if (type === "yesterday") {
      setMode("day");
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterday = d.toISOString().slice(0, 10);
      setStartDate(yesterday);
      setEndDate(yesterday);
    } else if (type === "week") {
      setMode("period");
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const past = d.toISOString().slice(0, 10);
      setStartDate(past);
      setEndDate(today);
    } else if (type === "month") {
      setMode("period");
      const d = new Date();
      d.setDate(d.getDate() - 29);
      const past = d.toISOString().slice(0, 10);
      setStartDate(past);
      setEndDate(today);
    } else if (type === "holiday") {
      // 명절 성수기 2주 전후 조회
      setMode("period");
      const d = new Date();
      d.setDate(d.getDate() - 14);
      const past = d.toISOString().slice(0, 10);
      setStartDate(past);
      setEndDate(today);
    }
  };

  const toggleDateCollapse = (dateStr: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  const setAllDatesCollapse = (collapsed: boolean) => {
    if (!data?.dailyList) return;
    const next: Record<string, boolean> = {};
    for (const d of data.dailyList) {
      next[d.date] = collapsed;
    }
    setCollapsedDates(next);
  };

  // 엑셀(.xlsx) 다운로드 실행
  const downloadExcel = async () => {
    if (exporting) return;
    const targetEnd = mode === "day" ? startDate : endDate;
    const exportUrl = `/api/sales/product-stats/export?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(targetEnd)}&dateType=${dateType}`;

    setExporting(true);
    try {
      const res = await fetch(exportUrl);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(errJson?.error || "엑셀 다운로드에 실패했습니다.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const fileDateStr = startDate === targetEnd ? startDate : `${startDate}_${targetEnd}`;
      anchor.href = url;
      anchor.download = `정일품_판매통계_일자별리스트_${fileDateStr}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "엑셀 다운로드 중 오류가 발생했습니다.");
    } finally {
      setExporting(false);
    }
  };

  // 클립보드 텍스트 복사
  const copySummaryText = () => {
    if (!data) return;
    const dateLabel = mode === "day"
      ? `${startDate} (${dateType === "due" ? "수령·발송일" : "접수일"} 기준)`
      : `${startDate} ~ ${endDate} (${dateType === "due" ? "수령·발송일" : "접수일"} 기준)`;

    let text = `[정일품 판매 통계 - ${dateLabel}]\n`;
    text += `· 총 판매 수량: ${data.summary.totalQuantity.toLocaleString()}세트\n`;
    text += `· 총 판매 금액: ${won(data.summary.totalAmount)} (결제 여부 무관 합계)\n`;
    text += `· 총 주문 건수: ${data.summary.totalOrders.toLocaleString()}건 (${data.summary.totalProductKinds}개 품종)\n`;
    if (data.summary.paymentBreakdown) {
      text += `· 결제 현황: 결제완료 ${data.summary.paymentBreakdown.paidOrders}건 (${won(data.summary.paymentBreakdown.paidAmount)}) / 미결제 ${data.summary.paymentBreakdown.unpaidOrders}건 (${won(data.summary.paymentBreakdown.unpaidAmount)})\n`;
    }

    if (activeTab === "daily" && data.dailyList && data.dailyList.length > 0) {
      text += `\n■ 일자별 판매 현황 리스트\n`;
      for (const day of data.dailyList) {
        text += `\n▶ [${day.date} (${day.dayOfWeek || "요일미상"})] 총 ${day.totalOrders}건 주문 / ${day.totalQuantity}세트 / ${won(day.totalAmount)}\n`;
        for (const cat of day.categories) {
          for (const prod of cat.products) {
            text += `  - [${cat.categoryName}] ${prod.displayName} (${won(prod.unitPrice)}): ${prod.totalQuantity}개 (${won(prod.totalAmount)})\n`;
          }
        }
      }
    } else {
      text += `\n■ 품목별 판매 내역 (기간 전체 합계)\n`;
      for (const cat of data.categories) {
        text += `\n[${cat.categoryName}] 소계: ${cat.totalQuantity}세트 / ${won(cat.totalAmount)}\n`;
        for (const prod of cat.products) {
          text += `- ${prod.displayName} (${won(prod.unitPrice)}): ${prod.totalQuantity}개 (${won(prod.totalAmount)})\n`;
        }
      }
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }).catch(() => undefined);
  };

  if (!open) return null;

  const totalQuantity = data?.summary.totalQuantity || 0;
  const totalAmount = data?.summary.totalAmount || 0;
  const totalOrders = data?.summary.totalOrders || 0;
  const totalProductKinds = data?.summary.totalProductKinds || 0;
  const paymentBreakdown = data?.summary.paymentBreakdown;
  const dailyList = data?.dailyList || [];

  const dateDescription = mode === "day"
    ? `${startDate} 하루 ${dateType === "due" ? "수령·발송 예정일" : "주문 접수일"} 기준 실적`
    : `${startDate} ~ ${endDate} 기간 ${dateType === "due" ? "수령·발송 예정일" : "주문 접수일"} 기준 실적`;

  return (
    <Modal
      open={open}
      title="📊 판매 및 주문 통계"
      description={dateDescription}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            * 취소된 주문을 제외한 모든 유효 주문을 집계합니다 (결제 여부와 무관).
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="product-stats-excel-btn"
              onClick={downloadExcel}
              disabled={exporting || loading}
              title="현재 조건의 판매 통계 및 일자별 리스트를 엑셀 파일(.xlsx)로 저장합니다"
            >
              {exporting ? "⏳ 엑셀 생성 중…" : "📥 엑셀 다운로드 (.xlsx)"}
            </button>
            <Button variant="ghost" onClick={copySummaryText}>
              {copyFeedback ? "✅ 복사 완료!" : "📋 텍스트 복사"}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      }
    >
      <div className="product-stats-modal">
        {/* 상단 컨트롤 패널 */}
        <div className="product-stats-controls">
          <div className="product-stats-control-row">
            {/* 기준일 타입 선택 */}
            <div className="product-stats-datetype-group" role="group" aria-label="조회 기준">
              <span className="product-stats-label">집계 기준:</span>
              <button
                type="button"
                className={`product-stats-toggle-btn ${dateType === "due" ? "product-stats-toggle-btn--active" : ""}`}
                onClick={() => setDateType("due")}
                title="방문수령일 또는 택배발송일 기준 집계"
              >
                🚚 수령·발송일 기준
              </button>
              <button
                type="button"
                className={`product-stats-toggle-btn ${dateType === "reception" ? "product-stats-toggle-btn--active" : ""}`}
                onClick={() => setDateType("reception")}
                title="고객이 주문을 접수한 날짜 기준 집계"
              >
                📝 주문 접수일 기준
              </button>
            </div>

            {/* 일자별 / 기간별 모드 선택 */}
            <div className="product-stats-mode-tabs" role="tablist">
              <button
                type="button"
                className={`product-stats-mode-btn ${mode === "day" ? "product-stats-mode-btn--active" : ""}`}
                onClick={() => handleModeChange("day")}
              >
                📅 일자별 (하루)
              </button>
              <button
                type="button"
                className={`product-stats-mode-btn ${mode === "period" ? "product-stats-mode-btn--active" : ""}`}
                onClick={() => handleModeChange("period")}
              >
                📆 기간별 (범위)
              </button>
            </div>
          </div>

          {/* 날짜 선택 인풋 및 퀵 버튼 */}
          <div className="product-stats-date-inputs">
            {mode === "day" ? (
              <>
                <label htmlFor="stats-single-date" className="product-stats-label">조회 날짜:</label>
                <input
                  id="stats-single-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setEndDate(e.target.value);
                  }}
                />
                <button type="button" className="product-stats-quick-btn" onClick={() => setPreset("today")}>
                  오늘
                </button>
                <button type="button" className="product-stats-quick-btn" onClick={() => setPreset("yesterday")}>
                  어제
                </button>
              </>
            ) : (
              <>
                <label htmlFor="stats-range-start" className="product-stats-label">조회 기간:</label>
                <input
                  id="stats-range-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="product-stats-tilde">~</span>
                <input
                  id="stats-range-end"
                  type="date"
                  aria-label="종료 날짜"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <button type="button" className="product-stats-quick-btn" onClick={() => setPreset("today")}>
                  오늘만
                </button>
                <button type="button" className="product-stats-quick-btn" onClick={() => setPreset("week")}>
                  최근 7일
                </button>
                <button type="button" className="product-stats-quick-btn" onClick={() => setPreset("month")}>
                  최근 30일
                </button>
                <button type="button" className="product-stats-quick-btn" onClick={() => setPreset("holiday")}>
                  최근 2주 (명절 성수기)
                </button>
              </>
            )}

            {/* 엑셀 다운로드 원클릭 버튼 */}
            <div style={{ marginLeft: "auto" }}>
              <button
                type="button"
                className="product-stats-excel-btn"
                onClick={downloadExcel}
                disabled={exporting || loading}
                title="통계 및 상세 판매 리스트를 엑셀 파일로 내려받습니다"
              >
                {exporting ? "⏳ 엑셀 다운로드 중…" : "📥 엑셀 (.xlsx) 저장"}
              </button>
            </div>
          </div>
        </div>

        {/* 결제 여부 무관 안내 띠 */}
        <div className="product-stats-notice-bar">
          <span className="product-stats-notice-tag">전체 집계</span>
          <span>결제 여부(결제완료/미결제)와 관계없이 접수된 <b>모든 유효 주문</b>의 수량 및 총 금액이 반영됩니다.</span>
        </div>

        {/* 핵심 요약 배너 */}
        <div className="product-stats-summary-bar">
          <div className="product-stats-summary-chip product-stats-summary-chip--highlight">
            <small>총 판매 수량</small>
            <strong>{totalQuantity.toLocaleString()} <span className="unit">세트</span></strong>
          </div>
          <div className="product-stats-summary-chip product-stats-summary-chip--highlight">
            <small>총 판매 금액 (결제무관)</small>
            <strong>{won(totalAmount)}</strong>
          </div>
          <div className="product-stats-summary-chip">
            <small>총 주문 건수</small>
            <strong>{totalOrders.toLocaleString()} <span className="unit">건</span></strong>
          </div>
          <div className="product-stats-summary-chip">
            <small>판매된 품종</small>
            <strong>{totalProductKinds} <span className="unit">종류</span></strong>
          </div>
        </div>

        {/* 결제 현황 보조 칩 바 */}
        {paymentBreakdown && (paymentBreakdown.paidOrders > 0 || paymentBreakdown.unpaidOrders > 0) ? (
          <div className="product-stats-payment-breakdown">
            <div className="product-stats-pay-chip product-stats-pay-chip--paid">
              <span className="dot dot--paid"></span>
              <span className="pay-label">결제 완료:</span>
              <strong className="pay-val">{paymentBreakdown.paidOrders}건</strong>
              <span className="pay-amount">({won(paymentBreakdown.paidAmount)})</span>
            </div>
            <div className="product-stats-pay-chip product-stats-pay-chip--unpaid">
              <span className="dot dot--unpaid"></span>
              <span className="pay-label">미결제(입금대기 등):</span>
              <strong className="pay-val">{paymentBreakdown.unpaidOrders}건</strong>
              <span className="pay-amount">({won(paymentBreakdown.unpaidAmount)})</span>
            </div>
          </div>
        ) : null}

        {/* 메인 탭 네비게이션: [📦 상품별 종합 집계] vs [📅 일자별 판매 리스트] */}
        <div className="product-stats-main-tabs" role="tablist">
          <button
            type="button"
            className={`product-stats-main-tab-btn ${activeTab === "overview" ? "product-stats-main-tab-btn--active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📦 상품별 종합 집계
          </button>
          <button
            type="button"
            className={`product-stats-main-tab-btn ${activeTab === "daily" ? "product-stats-main-tab-btn--active" : ""}`}
            onClick={() => setActiveTab("daily")}
          >
            📅 일자별 판매 리스트 ({dailyList.length}개 일자)
          </button>
        </div>

        {/* 에러 및 로딩 */}
        {loading && <p style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>통계 집계 중…</p>}
        {error && <p className="sales-work-table__error" role="alert">{error}</p>}

        {/* 탭 1: 상품별 종합 집계 뷰 */}
        {!loading && data && activeTab === "overview" && (
          <>
            {/* 상단 서브 뷰 모드 토글 (카드 보기 vs 표 보기) */}
            {data.categories.length > 0 ? (
              <div className="product-stats-view-switcher">
                <span className="product-stats-section-title">
                  📦 상품별 판매 현황 <small>({data.summary.totalProductKinds}개 품목)</small>
                </span>
                <div className="product-stats-view-buttons">
                  <button
                    type="button"
                    className={`product-stats-view-btn ${viewMode === "cards" ? "product-stats-view-btn--active" : ""}`}
                    onClick={() => setViewMode("cards")}
                  >
                    🗂️ 카드 보기
                  </button>
                  <button
                    type="button"
                    className={`product-stats-view-btn ${viewMode === "table" ? "product-stats-view-btn--active" : ""}`}
                    onClick={() => setViewMode("table")}
                  >
                    📑 표(테이블) 보기
                  </button>
                </div>
              </div>
            ) : null}

            {/* 본문: 카테고리별 목록 */}
            <div className="product-stats-categories">
              {data.categories.length === 0 ? (
                <div className="product-stats-empty">
                  <span style={{ fontSize: "32px" }}>📦</span>
                  <p>선택하신 조건(기간/기준) 동안 판매된 상품이 없습니다.</p>
                </div>
              ) : viewMode === "table" ? (
                /* 테이블 뷰 */
                <div className="product-stats-table-wrapper">
                  <table className="product-stats-table">
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: "120px" }}>카테고리</th>
                        <th scope="col">상품명</th>
                        <th scope="col" style={{ width: "110px", textAlign: "right" }}>단가</th>
                        <th scope="col" style={{ width: "100px", textAlign: "right" }}>판매량</th>
                        <th scope="col" style={{ width: "80px", textAlign: "center" }}>비중</th>
                        <th scope="col" style={{ width: "140px", textAlign: "right" }}>총 판매금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.categories.map((cat) => (
                        cat.products.map((prod, idx) => (
                          <tr key={prod.key}>
                            {idx === 0 ? (
                              <td
                                rowSpan={cat.products.length}
                                className="product-stats-td-cat"
                              >
                                <div className="td-cat-name">{cat.categoryName}</div>
                                <small className="td-cat-sub">{cat.totalQuantity}세트</small>
                              </td>
                            ) : null}
                            <td className="product-stats-td-name">
                              <strong>{prod.displayName}</strong>
                              {prod.customDetails && prod.customDetails.length > 0 ? (
                                <div className="product-stats-table-custom-details">
                                  {prod.customDetails.map((d, i) => (
                                    <span key={i} className="custom-detail-chip">구성 {i + 1}: {d}</span>
                                  ))}
                                </div>
                              ) : null}
                            </td>
                            <td className="product-stats-td-price">{won(prod.unitPrice)}</td>
                            <td className="product-stats-td-qty">
                              <strong>{prod.totalQuantity}</strong>개
                            </td>
                            <td className="product-stats-td-share">
                              <span className="share-badge">{prod.sharePercent}%</span>
                            </td>
                            <td className="product-stats-td-total">
                              <strong>{won(prod.totalAmount)}</strong>
                            </td>
                          </tr>
                        ))
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th colSpan={3} style={{ textAlign: "center" }}>전체 합계</th>
                        <th style={{ textAlign: "right" }}>{totalQuantity.toLocaleString()}세트</th>
                        <th style={{ textAlign: "center" }}>100%</th>
                        <th style={{ textAlign: "right" }}>{won(totalAmount)}</th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                /* 카드 뷰 */
                data.categories.map((cat) => (
                  <section key={cat.categoryName} className="product-stats-cat-section">
                    <div className="product-stats-cat-header">
                      <div className="product-stats-cat-title">
                        <span>{cat.categoryName}</span>
                        <span className="product-stats-cat-badge">{cat.totalQuantity}세트</span>
                      </div>
                      <span className="product-stats-cat-subtotal">소계 {won(cat.totalAmount)}</span>
                    </div>

                    <div className="product-stats-grid">
                      {cat.products.map((prod) => (
                        <article key={prod.key} className="product-stats-item-card">
                          <div className="product-stats-item-header">
                            <span className="product-stats-item-name">{prod.displayName}</span>
                            <span className="product-stats-item-price">{won(prod.unitPrice)}</span>
                          </div>

                          <div className="product-stats-item-body">
                            <div className="product-stats-item-qty-wrap">
                              <span className="product-stats-item-qty">{prod.totalQuantity}세트</span>
                              <span className="product-stats-item-share">점유율 {prod.sharePercent}%</span>
                            </div>
                            <span className="product-stats-item-total">{won(prod.totalAmount)}</span>
                          </div>

                          {prod.customDetails && prod.customDetails.length > 0 && (
                            <div className="product-stats-custom-list">
                              {prod.customDetails.map((detail, idx) => (
                                <div key={idx} className="product-stats-custom-item">
                                  <b>구성 {idx + 1}:</b> {detail}
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </>
        )}

        {/* 탭 2: 📅 일자별 판매 리스트 뷰 */}
        {!loading && data && activeTab === "daily" && (
          <div className="product-stats-daily-container">
            {/* 일자별 상단 툴바 */}
            <div className="product-stats-daily-toolbar">
              <div className="product-stats-daily-toolbar__info">
                <span className="product-stats-daily-title">
                  📅 기간 내 일자별 판매 리스트
                </span>
                <span className="product-stats-daily-count">
                  총 <strong>{dailyList.length}</strong>개 일자 ({startDate} ~ {mode === "day" ? startDate : endDate})
                </span>
              </div>
              <div className="product-stats-daily-toolbar__actions">
                <button
                  type="button"
                  className="product-stats-sub-btn"
                  onClick={() => setAllDatesCollapse(false)}
                >
                  모두 펼치기
                </button>
                <button
                  type="button"
                  className="product-stats-sub-btn"
                  onClick={() => setAllDatesCollapse(true)}
                >
                  모두 접기
                </button>
              </div>
            </div>

            {dailyList.length === 0 ? (
              <div className="product-stats-empty">
                <span style={{ fontSize: "32px" }}>📅</span>
                <p>선택하신 기간 동안 접수되거나 출고된 일자별 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="product-stats-daily-cards">
                {dailyList.map((day) => {
                  const isCollapsed = Boolean(collapsedDates[day.date]);
                  return (
                    <section key={day.date} className="product-stats-daily-card">
                      {/* 일자 헤더 */}
                      <div
                        className="product-stats-daily-header"
                        onClick={() => toggleDateCollapse(day.date)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            toggleDateCollapse(day.date);
                          }
                        }}
                      >
                        <div className="product-stats-daily-header__left">
                          <span className="product-stats-daily-badge">
                            📅 {day.date} {day.dayOfWeek ? `(${day.dayOfWeek})` : ""}
                          </span>
                          <span className="product-stats-daily-header-summary">
                            주문 <strong>{day.totalOrders}건</strong> · 판매 <strong>{day.totalQuantity}세트</strong>
                          </span>
                        </div>

                        <div className="product-stats-daily-header__right">
                          <span className="product-stats-daily-header-amount">
                            {won(day.totalAmount)}
                          </span>
                          {day.paidOrders > 0 || day.unpaidOrders > 0 ? (
                            <span className="product-stats-daily-pay-tag">
                              완료 {day.paidOrders} / 미결제 {day.unpaidOrders}
                            </span>
                          ) : null}
                          <span className="product-stats-daily-collapse-icon">
                            {isCollapsed ? "▼ 펼치기" : "▲ 접기"}
                          </span>
                        </div>
                      </div>

                      {/* 일자 상세 품목 테이블 */}
                      {!isCollapsed && (
                        <div className="product-stats-daily-table-wrap">
                          <table className="product-stats-table">
                            <thead>
                              <tr>
                                <th scope="col" style={{ width: "110px" }}>카테고리</th>
                                <th scope="col">상품명</th>
                                <th scope="col" style={{ width: "110px", textAlign: "right" }}>단가</th>
                                <th scope="col" style={{ width: "90px", textAlign: "right" }}>판매량</th>
                                <th scope="col" style={{ width: "70px", textAlign: "center" }}>비중</th>
                                <th scope="col" style={{ width: "130px", textAlign: "right" }}>판매금액</th>
                              </tr>
                            </thead>
                            <tbody>
                              {day.categories.map((cat) => (
                                cat.products.map((prod, idx) => (
                                  <tr key={prod.key}>
                                    {idx === 0 ? (
                                      <td
                                        rowSpan={cat.products.length}
                                        className="product-stats-td-cat"
                                      >
                                        <div className="td-cat-name">{cat.categoryName}</div>
                                      </td>
                                    ) : null}
                                    <td className="product-stats-td-name">
                                      <strong>{prod.displayName}</strong>
                                      {prod.customDetails && prod.customDetails.length > 0 ? (
                                        <div className="product-stats-table-custom-details">
                                          {prod.customDetails.map((d, i) => (
                                            <span key={i} className="custom-detail-chip">구성 {i + 1}: {d}</span>
                                          ))}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td className="product-stats-td-price">{won(prod.unitPrice)}</td>
                                    <td className="product-stats-td-qty">
                                      <strong>{prod.totalQuantity}</strong>개
                                    </td>
                                    <td className="product-stats-td-share">
                                      <span className="share-badge">{prod.sharePercent}%</span>
                                    </td>
                                    <td className="product-stats-td-total">
                                      <strong>{won(prod.totalAmount)}</strong>
                                    </td>
                                  </tr>
                                ))
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="product-stats-daily-tfoot-row">
                                <th colSpan={3} style={{ textAlign: "center" }}>
                                  {day.date} ({day.dayOfWeek}) 소계 (주문 {day.totalOrders}건)
                                </th>
                                <th style={{ textAlign: "right" }}>{day.totalQuantity.toLocaleString()}세트</th>
                                <th style={{ textAlign: "center" }}>100%</th>
                                <th style={{ textAlign: "right" }}>{won(day.totalAmount)}</th>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </section>
                  );
                })}

                {/* 기간 전체 종합 합계 배너 */}
                <div className="product-stats-daily-grand-bar">
                  <div className="grand-bar-left">
                    <span className="grand-bar-title">기간 전체 누적 합계</span>
                    <span className="grand-bar-sub">총 {dailyList.length}일간 · 주문 {totalOrders.toLocaleString()}건</span>
                  </div>
                  <div className="grand-bar-right">
                    <span className="grand-bar-qty">총 <strong>{totalQuantity.toLocaleString()}</strong>세트</span>
                    <span className="grand-bar-amount">{won(totalAmount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

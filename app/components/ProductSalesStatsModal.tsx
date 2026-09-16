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
  customDetails: string[];
};

type CategoryStat = {
  categoryName: string;
  categoryOrder: number;
  totalQuantity: number;
  totalAmount: number;
  products: ProductStat[];
};

type StatsResponse = {
  startDate: string;
  endDate: string;
  isSingleDay: boolean;
  summary: {
    totalOrders: number;
    totalProductKinds: number;
    totalQuantity: number;
    totalAmount: number;
  };
  categories: CategoryStat[];
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
  const [startDate, setStartDate] = useState(() => initialDate || todayInSeoul());
  const [endDate, setEndDate] = useState(() => initialDate || todayInSeoul());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<StatsResponse | null>(null);

  // 통계 데이터 패치
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    const targetEnd = mode === "day" ? startDate : endDate;
    const url = `/api/sales/product-stats?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(targetEnd)}`;

    const run = async () => {
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
  }, [open, startDate, endDate, mode]);

  const handleModeChange = (newMode: "day" | "period") => {
    setMode(newMode);
    if (newMode === "day") {
      setEndDate(startDate);
    }
  };

  const setPreset = (type: "today" | "week" | "month") => {
    const today = todayInSeoul();
    if (type === "today") {
      setMode("day");
      setStartDate(today);
      setEndDate(today);
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
    }
  };

  if (!open) return null;

  const totalQuantity = data?.summary.totalQuantity || 0;
  const totalAmount = data?.summary.totalAmount || 0;
  const totalOrders = data?.summary.totalOrders || 0;
  const totalProductKinds = data?.summary.totalProductKinds || 0;

  return (
    <Modal
      open={open}
      title="📊 상품별 판매 통계"
      description={
        mode === "day"
          ? `${startDate} 하루 수령/발송 기준 판매 실적`
          : `${startDate} ~ ${endDate} 기간 수령/발송 기준 판매 실적`
      }
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>
            * 수령/발송 예정일 기준 집계 (취소 주문 제외)
          </span>
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <div className="product-stats-modal">
        {/* 컨트롤 헤더 */}
        <div className="product-stats-controls">
          <div className="product-stats-mode-tabs">
            <button
              type="button"
              className={`product-stats-mode-btn ${mode === "day" ? "product-stats-mode-btn--active" : ""}`}
              onClick={() => handleModeChange("day")}
            >
              📅 일자별 (하루 기준)
            </button>
            <button
              type="button"
              className={`product-stats-mode-btn ${mode === "period" ? "product-stats-mode-btn--active" : ""}`}
              onClick={() => handleModeChange("period")}
            >
              📆 기간별 (범위 기준)
            </button>
          </div>

          <div className="product-stats-date-inputs">
            {mode === "day" ? (
              <>
                <label htmlFor="stats-single-date" style={{ fontSize: "13px", fontWeight: 700 }}>조회 날짜:</label>
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
              </>
            ) : (
              <>
                <label htmlFor="stats-range-start" style={{ fontSize: "13px", fontWeight: 700 }}>조회 기간:</label>
                <input
                  id="stats-range-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span>~</span>
                <input
                  id="stats-range-end"
                  type="date"
                  aria-label="종료 날짜"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <button type="button" className="product-stats-quick-btn" onClick={() => setPreset("week")}>
                  최근 7일
                </button>
                <button type="button" className="product-stats-quick-btn" onClick={() => setPreset("month")}>
                  최근 30일
                </button>
              </>
            )}
          </div>
        </div>

        {/* 요약 배너 */}
        <div className="product-stats-summary-bar">
          <div className="product-stats-summary-chip product-stats-summary-chip--highlight">
            <small>총 판매 수량</small>
            <strong>{totalQuantity.toLocaleString()}세트</strong>
          </div>
          <div className="product-stats-summary-chip product-stats-summary-chip--highlight">
            <small>총 판매 금액</small>
            <strong>{won(totalAmount)}</strong>
          </div>
          <div className="product-stats-summary-chip">
            <small>총 주문 건수</small>
            <strong>{totalOrders.toLocaleString()}건</strong>
          </div>
          <div className="product-stats-summary-chip">
            <small>판매된 품종</small>
            <strong>{totalProductKinds}종류</strong>
          </div>
        </div>

        {/* 에러 및 로딩 */}
        {loading && <p style={{ textAlign: "center", padding: "20px", color: "var(--muted)" }}>통계 집계 중…</p>}
        {error && <p className="sales-work-table__error" role="alert">{error}</p>}

        {/* 카테고리별 목록 */}
        {!loading && data && (
          <div className="product-stats-categories">
            {data.categories.length === 0 ? (
              <div className="product-stats-empty">
                <span style={{ fontSize: "28px" }}>📦</span>
                <p>선택하신 일자/기간 동안 판매된 상품이 없습니다.</p>
              </div>
            ) : (
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
                          <span className="product-stats-item-qty">{prod.totalQuantity}개</span>
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
        )}
      </div>
    </Modal>
  );
}

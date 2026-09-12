"use client";

import { CheckCircle2, CheckSquare, Clock, Package, Printer, Truck, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  calculateSetCutRequirements,
  prepareInspectionItems,
  type InspectionItem,
  type WorkItemLike,
} from "../lib/workshop-packing-slip";
import { Button } from "../ui";

interface WorkshopPackingSlipModalProps {
  open: boolean;
  date: string;
  items: WorkItemLike[];
  onClose: () => void;
  onCompleteItem?: (item: WorkItemLike) => Promise<void>;
}

export default function WorkshopPackingSlipModal({
  open,
  date,
  items,
  onClose,
  onCompleteItem,
}: WorkshopPackingSlipModalProps) {
  const [filterType, setFilterType] = useState<"all" | "onsite" | "shipping" | "direct_delivery">("all");
  const [completingId, setCompletingId] = useState<string | null>(null);

  const inspectionItems = useMemo(() => prepareInspectionItems(items), [items]);
  const cutCalc = useMemo(() => calculateSetCutRequirements(items), [items]);

  const filteredItems = useMemo(() => {
    if (filterType === "all") return inspectionItems;
    return inspectionItems.filter((item) => item.classification === filterType);
  }, [inspectionItems, filterType]);

  const counts = useMemo(() => {
    return {
      all: inspectionItems.length,
      onsite: inspectionItems.filter((item) => item.classification === "onsite").length,
      shipping: inspectionItems.filter((item) => item.classification === "shipping").length,
      directDelivery: inspectionItems.filter((item) => item.classification === "direct_delivery").length,
    };
  }, [inspectionItems]);

  if (!open) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleComplete = async (item: InspectionItem) => {
    if (!onCompleteItem) return;
    setCompletingId(item.id);
    try {
      await onCompleteItem(item);
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="packing-slip-backdrop" role="dialog" aria-modal="true" aria-label="출고 검수표 인쇄">
      <div className="packing-slip-window">
        {/* 화면용 상단 컨트롤 헤더 (인쇄 시 숨김) */}
        <header className="packing-slip-toolbar no-print">
          <div className="packing-slip-toolbar-left">
            <h2>출고 검수표 (출고 작업지시서)</h2>
            <span className="packing-slip-badge-date">기준일: {date}</span>
          </div>
          <div className="packing-slip-toolbar-actions">
            <Button
              variant="secondary"
              leadingIcon={<Printer size={18} />}
              onClick={handlePrint}
              ariaLabel="A4 검수표 인쇄"
            >
              A4 인쇄 (SAMSUNG)
            </Button>
            <Button variant="ghost" leadingIcon={<X size={18} />} onClick={onClose} ariaLabel="검수표 닫기">
              닫기
            </Button>
          </div>
        </header>

        {/* 인쇄 및 화면 공통 검수표 내용 영역 */}
        <div className="packing-slip-printable-document">
          {/* 인쇄용 문서 헤더 */}
          <div className="slip-doc-header">
            <div className="slip-brand">
              <h1>정일품 출고 검수표 (출고 작업지시서)</h1>
              <p className="slip-subtitle">
                작업 기준일: <strong>{date}</strong> · 당일 출고 상품 검수 및 부위별 소요량
              </p>
            </div>
            <div className="slip-meta">
              <span>출력일시: {new Date().toLocaleString("ko-KR")}</span>
              <span className="slip-check-box-guide">검수자 서명: ____________ (인)</span>
            </div>
          </div>

          {/* 1. 상품별 수량 및 부위별 팩 수 자동 계산표 */}
          <section className="slip-summary-section">
            <div className="slip-section-title">
              <h3>1. 오늘 출고 상품 및 부위별 필요 팩 수 자동 계산</h3>
              <span className="slip-pill-total">
                총 {cutCalc.totalAllPacks}팩 소요 (진공 {cutCalc.totalVacuumPacks}팩 / 오미트 {cutCalc.totalOmeatPacks}팩)
              </span>
            </div>

            {/* 상품별 수량 목록 */}
            <div className="slip-product-badges-row">
              <div className="slip-product-group">
                <span className="slip-group-label">진공세트:</span>
                {cutCalc.vacuumProducts.length ? (
                  cutCalc.vacuumProducts.map((p) => (
                    <span key={p.name} className="slip-prod-tag">
                      {p.name} <strong>{p.quantity}개</strong>
                    </span>
                  ))
                ) : (
                  <span className="slip-muted">없음</span>
                )}
              </div>

              <div className="slip-product-group">
                <span className="slip-group-label">오미트세트:</span>
                {cutCalc.omeatProducts.length ? (
                  cutCalc.omeatProducts.map((p) => (
                    <span key={p.name} className="slip-prod-tag omeat">
                      {p.name} <strong>{p.quantity}개</strong>
                    </span>
                  ))
                ) : (
                  <span className="slip-muted">없음</span>
                )}
              </div>

              {cutCalc.otherProducts.length > 0 && (
                <div className="slip-product-group">
                  <span className="slip-group-label">기타 상품:</span>
                  {cutCalc.otherProducts.map((p) => (
                    <span key={p.name} className="slip-prod-tag other">
                      {p.name} <strong>{p.quantity}개</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 부위별 필요 팩 수 테이블 */}
            <table className="slip-cuts-table">
              <thead>
                <tr>
                  <th scope="col">부위명</th>
                  <th scope="col">진공세트 팩수 (봉황/팔영 등)</th>
                  <th scope="col">오미트 세트 팩수</th>
                  {cutCalc.otherProducts.length > 0 && <th scope="col">기타 팩수</th>}
                  <th scope="col" className="highlight-col">
                    부위별 총 필요 팩수
                  </th>
                  <th scope="col" className="print-only">
                    준비 확인
                  </th>
                </tr>
              </thead>
              <tbody>
                {cutCalc.cuts.map((cut) => (
                  <tr key={cut.cutName}>
                    <td className="cut-name-cell">
                      <strong>{cut.cutName}</strong>
                    </td>
                    <td>{cut.vacuumPacks ? `${cut.vacuumPacks}팩` : "-"}</td>
                    <td>{cut.omeatPacks ? `${cut.omeatPacks}팩` : "-"}</td>
                    {cutCalc.otherProducts.length > 0 && (
                      <td>{cut.otherPacks ? `${cut.otherPacks}팩` : "-"}</td>
                    )}
                    <td className="highlight-col">
                      <strong>{cut.totalPacks}팩</strong>
                    </td>
                    <td className="print-only check-col">
                      <span className="paper-check-box">☐</span>
                    </td>
                  </tr>
                ))}
                {cutCalc.cuts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      당일 예약된 세트 구성 상품이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
              {cutCalc.cuts.length > 0 && (
                <tfoot>
                  <tr>
                    <td>
                      <strong>합계</strong>
                    </td>
                    <td>
                      <strong>{cutCalc.totalVacuumPacks}팩</strong>
                    </td>
                    <td>
                      <strong>{cutCalc.totalOmeatPacks}팩</strong>
                    </td>
                    {cutCalc.otherProducts.length > 0 && <td>-</td>}
                    <td className="highlight-col">
                      <strong>{cutCalc.totalAllPacks}팩</strong>
                    </td>
                    <td className="print-only check-col">✓</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </section>

          {/* 2. 시간대별 / 수령유형별 출고 검수 목록 */}
          <section className="slip-orders-section">
            <div className="slip-section-title">
              <h3>2. 시간대별 출고 검수 목록</h3>
              {/* 화면용 필터 탭 (인쇄 시 숨김) */}
              <div className="slip-filters no-print">
                <button
                  className={`slip-filter-btn ${filterType === "all" ? "active" : ""}`}
                  onClick={() => setFilterType("all")}
                >
                  전체 ({counts.all})
                </button>
                <button
                  className={`slip-filter-btn ${filterType === "onsite" ? "active" : ""}`}
                  onClick={() => setFilterType("onsite")}
                >
                  현장수령 ({counts.onsite})
                </button>
                <button
                  className={`slip-filter-btn ${filterType === "shipping" ? "active" : ""}`}
                  onClick={() => setFilterType("shipping")}
                >
                  택배발송 ({counts.shipping})
                </button>
                <button
                  className={`slip-filter-btn ${filterType === "direct_delivery" ? "active" : ""}`}
                  onClick={() => setFilterType("direct_delivery")}
                >
                  직접배달 ({counts.directDelivery})
                </button>
              </div>
            </div>

            <table className="slip-orders-table">
              <thead>
                <tr>
                  <th scope="col" className="check-box-th">
                    검수
                  </th>
                  <th scope="col">예약시간 / 구분</th>
                  <th scope="col">주문자(수령인)</th>
                  <th scope="col">상품 및 수량</th>
                  <th scope="col">배송지 / 전달처</th>
                  <th scope="col">결제상태</th>
                  <th scope="col">요청사항 / 메모</th>
                  <th scope="col" className="no-print">
                    상태 / 완료처리
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isReadyOrDone = item.workStatus === "ready" || item.workStatus === "completed";
                  return (
                    <tr key={item.id} className={isReadyOrDone ? "row-done" : ""}>
                      {/* 검수 볼펜 체크용 사각형 */}
                      <td className="check-box-td">
                        <span className="paper-check-box" title="출고 전 검수 체크">
                          {isReadyOrDone ? "☑" : "☐"}
                        </span>
                      </td>

                      {/* 시간 / 구분 배지 */}
                      <td className="time-td">
                        <div className="slip-time-badge-box">
                          {item.classification === "onsite" ? (
                            <>
                              <span className="slip-badge-time">
                                <Clock size={12} /> {item.dueTime}
                              </span>
                              <span className="slip-badge-type onsite">현장수령</span>
                            </>
                          ) : item.classification === "shipping" ? (
                            <>
                              <span className="slip-badge-type shipping">
                                <Truck size={12} /> 택배발송
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="slip-badge-type delivery">
                                <Package size={12} /> 직접배달
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* 주문자/수령인 */}
                      <td className="customer-td">
                        <strong>{item.buyerName}</strong>
                        {item.buyerPhone && <span className="slip-phone">{item.buyerPhone}</span>}
                        {item.recipientName && item.recipientName !== item.buyerName && (
                          <span className="slip-sub-recipient">
                            수령인: {item.recipientName} ({item.recipientPhone})
                          </span>
                        )}
                      </td>

                      {/* 상품 및 수량 */}
                      <td className="product-td">
                        <strong className="slip-prod-name">{item.productName}</strong>
                        <span className="slip-qty-tag">{item.quantity}개</span>
                      </td>

                      {/* 배송지 (택배/배달인 경우) */}
                      <td className="address-td">
                        {item.fullAddress ? (
                          <span className="slip-address-text">{item.fullAddress}</span>
                        ) : (
                          <span className="slip-muted">현장 방문 수령</span>
                        )}
                      </td>

                      {/* 결제 상태 */}
                      <td className="payment-td">
                        <span className={`slip-pay-badge ${item.paymentBadge.isPaid ? "paid" : "unpaid"}`}>
                          {item.paymentBadge.label}
                        </span>
                      </td>

                      {/* 요청사항 / 메모 */}
                      <td className="note-td">
                        {item.note || item.customerNote ? (
                          <span className="slip-note-text">{item.note || item.customerNote}</span>
                        ) : (
                          <span className="slip-muted">-</span>
                        )}
                      </td>

                      {/* 화면용 완료처리 액션 버튼 (인쇄 시 숨김) */}
                      <td className="action-td no-print">
                        {onCompleteItem && (
                          <button
                            className={`slip-quick-complete-btn ${isReadyOrDone ? "completed" : ""}`}
                            disabled={completingId === item.id || isReadyOrDone}
                            onClick={() => void handleComplete(item)}
                            title={isReadyOrDone ? "이미 완료된 작업입니다" : "검수 완료 후 작업완료로 변경"}
                          >
                            <CheckCircle2 size={14} />
                            {isReadyOrDone ? "완료됨" : completingId === item.id ? "처리중" : "작업완료"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      해당 조건의 출고 작업이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* 인쇄용 하단 안내 */}
          <footer className="slip-doc-footer print-only">
            <p>※ 출고 전 상품 구성 팩수와 라벨 부착 여부를 반드시 대조 검수 후 출고하십시오. (정일품 명절운영시스템)</p>
          </footer>
        </div>
      </div>
    </div>
  );
}

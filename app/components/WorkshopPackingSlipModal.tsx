"use client";

import { CheckCircle2, Clock, Package, Printer, Truck, X } from "lucide-react";
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
              variant="primary"
              leadingIcon={<Printer size={18} />}
              onClick={handlePrint}
            >
              A4 인쇄 (SAMSUNG)
            </Button>
            <Button variant="ghost" leadingIcon={<X size={18} />} onClick={onClose}>
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
          {/* 1. 상품별 수량 및 부위별 팩 수 자동 계산표 */}
          <section className="slip-summary-section">
            <div className="slip-section-title">
              <div className="slip-section-title-left">
                <h3>1. 오늘 출고 스킨팩 부위별 생산 지시서</h3>
                <span className="slip-weight-notice-badge">
                  봉황·팔영(162202) / 오미트 시그니처·프레스티지(241702) 전용 스킨팩
                </span>
              </div>
              <div className="slip-pill-totals-group">
                <span className="slip-pill-total container-162202">
                  162202 용기 (봉황·팔영): {cutCalc.skinPacks162202.reduce((s, i) => s + i.packs, 0)}팩
                </span>
                <span className="slip-pill-total container-241702">
                  241702 용기 (오미트): {cutCalc.skinPacks241702.reduce((s, i) => s + i.packs, 0)}팩
                </span>
                <span className="slip-pill-total container-total">
                  총 스킨팩 합계: {cutCalc.skinPacks162202.reduce((s, i) => s + i.packs, 0) + cutCalc.skinPacks241702.reduce((s, i) => s + i.packs, 0)}팩
                </span>
              </div>
            </div>

            {/* 중량 규격별 2단 독립 생산 계획 그리드 */}
            <div className="slip-cuts-split-grid">
              {/* [카드 1] 162202 용기 스킨팩 준비 (봉황·팔영 세트) */}
              <div className="slip-plan-card vacuum-card">
                <div className="slip-plan-card-header">
                  <div className="slip-plan-title-box">
                    <span className="slip-container-badge b-162202">162202 용기</span>
                    <h4>봉황·팔영 진공 스킨팩</h4>
                  </div>
                  <span className="slip-weight-guide highlight-blue">
                    일반 180g / 차돌 280g
                  </span>
                </div>

                {/* 해당 세트 상품 목록 */}
                <div className="slip-plan-products">
                  <span className="slip-plan-sub-label">소요 세트:</span>
                  {cutCalc.vacuumProducts.length > 0 ? (
                    cutCalc.vacuumProducts.map((p) => (
                      <span key={p.name} className="slip-prod-badge vacuum">
                        <strong>{p.name}</strong> {p.quantity}개
                        <em className="slip-prod-spec">({p.weightSpec})</em>
                      </span>
                    ))
                  ) : (
                    <span className="slip-muted-text">오늘 봉황/팔영 예약 없음</span>
                  )}
                </div>

                {/* 162202 용기 전용 부위별 팩수 테이블 */}
                <table className="slip-plan-table vacuum-table">
                  <thead>
                    <tr>
                      <th scope="col">부위명</th>
                      <th scope="col" className="weight-th">
                        실측 중량
                      </th>
                      <th scope="col" className="container-th">
                        용기
                      </th>
                      <th scope="col" className="highlight-col vacuum">
                        필요 팩수
                      </th>
                      <th scope="col" className="check-th">
                        확인
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cutCalc.skinPacks162202.map((item) => (
                      <tr key={`${item.cutName}_${item.weight}`}>
                        <td className="cut-name-cell">
                          <strong>{item.cutName}</strong>
                          {item.note && <span className="cut-item-note">({item.note})</span>}
                        </td>
                        <td className={`weight-cell ${item.weight === "280g" ? "special-weight" : ""}`}>
                          <strong>{item.weight}</strong>
                        </td>
                        <td className="container-cell">
                          <span className="tiny-container-tag">{item.container}</span>
                        </td>
                        <td className="highlight-col vacuum">
                          <strong>{item.packs}팩</strong>
                        </td>
                        <td className="check-col">
                          <span className="paper-check-box">☐</span>
                        </td>
                      </tr>
                    ))}
                    {cutCalc.skinPacks162202.length === 0 && (
                      <tr>
                        <td colSpan={5} className="empty-cell">
                          오늘 162202 용기 스킨팩 대상 세트(봉황·팔영)가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {cutCalc.skinPacks162202.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3}>
                          <strong>162202 용기 합계</strong>
                        </td>
                        <td className="highlight-col vacuum">
                          <strong>{cutCalc.skinPacks162202.reduce((s, i) => s + i.packs, 0)}팩</strong>
                        </td>
                        <td className="check-col">✓</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* [카드 2] 241702 용기 오미트팩 준비 (시그니처·프레스티지) */}
              <div className="slip-plan-card omeat-card">
                <div className="slip-plan-card-header">
                  <div className="slip-plan-title-box">
                    <span className="slip-container-badge b-241702">241702 용기</span>
                    <h4>오미트(O&apos;meat) 전용팩</h4>
                  </div>
                  <span className="slip-weight-guide highlight-purple">
                    시그니처 200g(차돌300g) / 프레스티지 230g
                  </span>
                </div>

                {/* 해당 세트 상품 목록 */}
                <div className="slip-plan-products">
                  <span className="slip-plan-sub-label">소요 세트:</span>
                  {cutCalc.omeatProducts.length > 0 ? (
                    cutCalc.omeatProducts.map((p) => (
                      <span key={p.name} className="slip-prod-badge omeat">
                        <strong>{p.name}</strong> {p.quantity}개
                        <em className="slip-prod-spec">({p.weightSpec})</em>
                      </span>
                    ))
                  ) : (
                    <span className="slip-muted-text">오늘 오미트 예약 없음</span>
                  )}
                </div>

                {/* 241702 용기 전용 부위별 팩수 테이블 */}
                <table className="slip-plan-table omeat-table">
                  <thead>
                    <tr>
                      <th scope="col">부위명</th>
                      <th scope="col" className="weight-th">
                        실측 중량
                      </th>
                      <th scope="col" className="container-th">
                        용기
                      </th>
                      <th scope="col" className="highlight-col omeat">
                        필요 팩수
                      </th>
                      <th scope="col" className="check-th">
                        확인
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cutCalc.skinPacks241702.map((item) => (
                      <tr key={`${item.cutName}_${item.weight}`}>
                        <td className="cut-name-cell">
                          <strong>{item.cutName}</strong>
                          {item.note && <span className="cut-item-note">({item.note})</span>}
                        </td>
                        <td className={`weight-cell ${item.weight === "300g" ? "special-weight" : ""}`}>
                          <strong>{item.weight}</strong>
                        </td>
                        <td className="container-cell">
                          <span className="tiny-container-tag">{item.container}</span>
                        </td>
                        <td className="highlight-col omeat">
                          <strong>{item.packs}팩</strong>
                        </td>
                        <td className="check-col">
                          <span className="paper-check-box">☐</span>
                        </td>
                      </tr>
                    ))}
                    {cutCalc.skinPacks241702.length === 0 && (
                      <tr>
                        <td colSpan={5} className="empty-cell">
                          오늘 241702 용기 오미트 세트가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {cutCalc.skinPacks241702.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3}>
                          <strong>241702 용기 합계</strong>
                        </td>
                        <td className="highlight-col omeat">
                          <strong>{cutCalc.skinPacks241702.reduce((s, i) => s + i.packs, 0)}팩</strong>
                        </td>
                        <td className="check-col">✓</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
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

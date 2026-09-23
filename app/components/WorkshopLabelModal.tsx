"use client";

import { CheckCircle2, Copy, Printer, Tag, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  generatePackingLabels,
  type PackingSlipLabel,
  type WorkItemLike,
} from "../lib/workshop-packing-slip";
import { Button } from "../ui";

interface WorkshopLabelModalProps {
  open: boolean;
  items: WorkItemLike[];
  date: string;
  autoPrint?: boolean;
  onClose: () => void;
  onPrinted?: (workItemIds: string[]) => void;
}

function formatPhone(phone?: string | null): string {
  if (!phone) return "";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

function formatCleanNote(note?: string | null): string {
  if (!note) return "";
  // 중복 접두어(메모: 메모:, 요청/메모: 메모: 등) 정돈
  const clean = note
    .replace(/^(메모:\s*)+/gi, "메모: ")
    .replace(/^(요청\/메모:\s*)+/gi, "요청: ")
    .trim();

  // ' / '로 결합된 내용 중 본문 내용이 동일하게 중복된 경우 정리
  const parts = clean.split(/\s*\/\s*/);
  if (parts.length > 1) {
    const seen = new Set<string>();
    const uniqueParts: string[] = [];
    for (const p of parts) {
      const core = p.replace(/^(메모|맞춤|요청|고객|특이사항):\s*/gi, "").trim();
      if (core && !seen.has(core)) {
        seen.add(core);
        uniqueParts.push(p);
      }
    }
    return uniqueParts.join(" / ");
  }
  return clean;
}

export default function WorkshopLabelModal({
  open,
  items,
  date,
  autoPrint = false,
  onClose,
  onPrinted,
}: WorkshopLabelModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [labelSize, setLabelSize] = useState<"80x100" | "50x50">("80x100");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [filterMode, setFilterMode] = useState<"all" | "unprinted">("all");
  const [printedOverrides, setPrintedOverrides] = useState<Record<string, number>>({});
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const allLabels = useMemo(() => {
    return generatePackingLabels(items, date).map((l) => {
      const overrideCount = printedOverrides[l.workItemId];
      if (overrideCount !== undefined) {
        return {
          ...l,
          labelPrintCount: overrideCount,
          isAlreadyPrinted: overrideCount > 0,
        };
      }
      return l;
    });
  }, [items, date, printedOverrides]);

  const unprintedCount = useMemo(() => {
    return allLabels.filter((l) => !l.isAlreadyPrinted).length;
  }, [allLabels]);

  const printedCount = allLabels.length - unprintedCount;

  const labels = useMemo(() => {
    if (filterMode === "unprinted") {
      return allLabels.filter((l) => !l.isAlreadyPrinted);
    }
    return allLabels;
  }, [allLabels, filterMode]);

  // 라벨 HTML 및 인쇄 전용 iframe 빌드 함수
  const triggerPrint = useCallback(async () => {
    if (!labels.length) return;

    // 1. 감사 이벤트 저장 비동기 호출
    const uniqueWorkItemIds = [...new Set(labels.map((l) => l.workItemId))];
    try {
      await fetch("/api/work-items/labels/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workItemIds: uniqueWorkItemIds, labelSize }),
      });
      setPrintedOverrides((prev) => {
        const next = { ...prev };
        for (const id of uniqueWorkItemIds) {
          next[id] = (next[id] ?? 0) + 1;
        }
        return next;
      });
      onPrinted?.(uniqueWorkItemIds);
    } catch (err) {
      console.error("라벨 인쇄 감사 이벤트 저장 실패:", err);
    }

    let iframe = iframeRef.current;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
      iframeRef.current = iframe;
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const is50x50 = labelSize === "50x50";
    const isPortrait = orientation === "portrait";

    const pageSize = is50x50
      ? "50mm 50mm"
      : isPortrait
      ? "80mm 100mm"
      : "100mm 80mm";

    const cardWidth = is50x50 ? "50mm" : isPortrait ? "80mm" : "100mm";
    const cardHeight = is50x50 ? "46mm" : isPortrait ? "84mm" : "68mm";
    const cardPadding = is50x50
      ? "1.8mm 2.2mm 1.5mm"
      : isPortrait
      ? "2.5mm 3.8mm 2mm"
      : "2mm 3.8mm 1.5mm";

    // 규격별 반응형 폰트 크기
    const fProduct = is50x50 ? "13pt" : "22pt";
    const fQty = is50x50 ? "11.5pt" : "20pt";
    const fBuyer = is50x50 ? "11.5pt" : "18pt";
    const fBuyerLbl = is50x50 ? "8.5pt" : "11pt";
    const fPayBadge = is50x50 ? "8pt" : "10.5pt";
    const fMeta = is50x50 ? "8pt" : "10.5pt";
    const fMethodTag = is50x50 ? "8.5pt" : "11.5pt";
    const fPhone = is50x50 ? "9.5pt" : "15.5pt";
    const fPhoneLbl = is50x50 ? "8pt" : "11pt";
    const fOrderNo = is50x50 ? "7.5pt" : "10pt";
    const fNote = is50x50 ? "7.5pt" : "10pt";
    const fRecipient = is50x50 ? "9.5pt" : "13.5pt";
    const fAddress = is50x50 ? "7.5pt" : "10pt";
    const fSender = is50x50 ? "7pt" : "9pt";
    const fFooter = is50x50 ? "6.5pt" : "8pt";

    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>상품정보 라벨 인쇄</title>
  <style>
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: ${cardWidth};
      height: auto;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-slip-card {
      width: ${cardWidth};
      height: ${cardHeight};
      max-height: ${cardHeight};
      overflow: hidden;
      box-sizing: border-box;
      padding: ${cardPadding};
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: none;
    }
    .label-slip-card:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    @media print {
      body {
        margin: 0 !important;
        padding: 0 !important;
      }
      .label-slip-card:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
    }

    /* 1단: 상품명 및 수량 순번 */
    .label-product-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #000;
      padding-bottom: 0.8mm;
      margin-bottom: 1.2mm;
      gap: 2mm;
    }
    .label-product-name {
      font-size: ${fProduct};
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -0.5px;
      word-break: keep-all;
      flex: 1;
      color: #000;
    }
    .label-qty-badge {
      font-size: ${fQty};
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -0.3px;
      white-space: nowrap;
      color: #000;
    }

    /* 2단: 주문자명 및 결제상태 */
    .label-buyer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2mm;
      line-height: 1.15;
    }
    .label-buyer-wrap {
      display: flex;
      align-items: baseline;
      gap: 1.5mm;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .label-buyer-lbl {
      font-size: ${fBuyerLbl};
      font-weight: 800;
      color: #111;
      white-space: nowrap;
    }
    .label-buyer-name {
      font-size: ${fBuyer};
      font-weight: 900;
      letter-spacing: -0.4px;
      color: #000;
      word-break: break-all;
    }
    .label-pay-badge {
      font-size: ${fPayBadge};
      font-weight: 900;
      padding: 0.5mm 1.8mm;
      border-radius: 2px;
      white-space: nowrap;
    }
    .label-pay-badge.unpaid {
      background: #000;
      color: #fff;
      border: 1.5px solid #000;
    }
    .label-pay-badge.paid {
      border: 1.5px solid #000;
      color: #000;
    }

    /* 3단: 날짜 및 수령방법 메타 라인 */
    .label-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${fMeta};
      font-weight: 800;
      padding: 0.8mm 0;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      margin-bottom: 1.5mm;
      line-height: 1.15;
    }
    .label-method-tag {
      font-size: ${fMethodTag};
      font-weight: 900;
      border: 1.2px solid #000;
      padding: 0.3mm 1.8mm;
      border-radius: 2.5px;
    }

    /* 4단: 본문 (현장수령 vs 택배) */
    .label-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1.5mm;
      overflow: hidden;
    }
    .label-onsite-box {
      display: flex;
      flex-direction: column;
      gap: 1.8mm;
      padding: 0.8mm 0;
    }
    .label-phone-line {
      font-size: ${fPhone};
      font-weight: 900;
      color: #000;
      display: flex;
      align-items: baseline;
      gap: 1.5mm;
    }
    .label-phone-lbl {
      font-size: ${fPhoneLbl};
      font-weight: 800;
      color: #222;
    }
    .label-order-no {
      font-size: ${fOrderNo};
      font-weight: 700;
      color: #333;
    }
    .label-note-box {
      font-size: ${fNote};
      font-weight: 800;
      border: 1.2px solid #000;
      border-radius: 2.5px;
      padding: 1.4mm 2mm;
      background: #f2f2f2;
      line-height: 1.3;
      word-break: break-all;
    }
    .shipping-section {
      background: #f5f5f5;
      border: 1.2px solid #000;
      border-radius: 2.5px;
      padding: 1.5mm 2mm;
      font-size: ${fAddress};
      line-height: 1.25;
      display: flex;
      flex-direction: column;
      gap: 1.2mm;
    }
    .shipping-row {
      display: flex;
      gap: 1.2mm;
    }
    .shipping-label {
      font-weight: 900;
      white-space: nowrap;
      color: #000;
      font-size: ${fAddress};
    }
    .shipping-val {
      font-weight: 700;
      word-break: break-all;
      font-size: ${fAddress};
    }
    .shipping-val.recipient {
      font-size: ${fRecipient};
      font-weight: 900;
    }

    /* 5단: 하단 풋터 */
    .label-footer {
      border-top: 0.8px solid #333;
      padding-top: 1mm;
      margin-top: 1mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${fFooter};
      font-weight: 700;
      color: #333;
      line-height: 1;
    }
  </style>
</head>
<body>
  ${labels
    .map(
      (label) => `
    <div class="label-slip-card" style="position: relative;">
      ${
        label.isAlreadyPrinted
          ? `<div style="position: absolute; right: 2.2mm; top: 1.6mm; font-size: 7.5pt; font-weight: 900; border: 1.2px solid #000; padding: 0.2mm 1.2mm; background: #fff; border-radius: 2px;">[재발행 ${label.labelPrintCount + 1}회차]</div>`
          : ""
      }
      <div class="label-product-row">
        <div class="label-product-name">${label.productName}</div>
        <div class="label-qty-badge">${label.quantityBadge}</div>
      </div>

      <div class="label-buyer-row">
        <div class="label-buyer-wrap">
          <span class="label-buyer-lbl">주문자:</span>
          <span class="label-buyer-name">${label.buyerName}</span>
        </div>
        <span class="label-pay-badge ${label.isPaid ? "paid" : "unpaid"}">
          ${label.paymentStatusLabel}
        </span>
      </div>

      <div class="label-meta-row">
        <span>${label.date}</span>
        <span class="label-method-tag">${label.classificationLabel}${label.pickupTime ? ` (${label.pickupTime})` : ""}</span>
      </div>

      <div class="label-body">
        ${
          label.classification === "shipping"
            ? `
          <div class="shipping-section">
            <div class="shipping-row">
              <span class="shipping-label">받는 분:</span>
              <span class="shipping-val recipient">${label.recipientName} ${label.recipientPhone ? `(${formatPhone(label.recipientPhone)})` : ""}</span>
            </div>
            <div class="shipping-row">
              <span class="shipping-label">배송지:</span>
              <span class="shipping-val">${label.fullAddress || "주소 미입력"}</span>
            </div>
            <div class="shipping-row" style="font-size: ${fSender}; color: #444;">
              <span class="shipping-label" style="font-size: ${fSender}; color: #444;">보내는 분:</span>
              <span class="shipping-val">${label.buyerName} ${label.buyerPhone ? `(${formatPhone(label.buyerPhone)})` : ""}</span>
            </div>
            ${
              label.note
                ? `<div class="label-note-box" style="margin-top: 0.8mm;">${formatCleanNote(label.note)}</div>`
                : ""
            }
          </div>
        `
            : `
          <div class="label-onsite-box">
            <div class="label-phone-line">
              <span class="label-phone-lbl">연락처:</span>
              <strong>${formatPhone(label.buyerPhone) || "연락처 미등록"}</strong>
            </div>
            <div class="label-order-no">주문번호: ${label.orderNo}</div>
            ${
              label.note
                ? `<div class="label-note-box">${formatCleanNote(label.note)}</div>`
                : ""
            }
          </div>
        `
        }
      </div>

      <div class="label-footer">
        <span>정일품 한우선물세트</span>
        <span>${label.orderNo}</span>
      </div>
    </div>
  `
    )
    .join("")}
</body>
</html>
`;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // iframe 렌더링 완료 후 인쇄 호출
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  }, [labels, orientation, labelSize, onPrinted]);

  // autoPrint가 켜져 있으면 모달 오픈 시 자동 1회 인쇄 트리거
  useEffect(() => {
    if (open && autoPrint && labels.length > 0) {
      const timer = setTimeout(() => {
        void triggerPrint();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [open, autoPrint, labels.length, triggerPrint]);

  if (!open) return null;

  const copyLabelText = (label: PackingSlipLabel) => {
    const text = `${label.buyerName} - ${label.productName} ${label.quantityBadge} / ${label.date} / ${label.classificationLabel} / ${label.paymentStatusLabel}`;
    void navigator.clipboard.writeText(text);
    setCopiedId(label.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="label-modal-backdrop" role="dialog" aria-modal="true" aria-label="상품정보 라벨 출력">
      <div className="label-modal-window">
        {/* 상단 1단: 모달 타이틀 및 주요 액션 버튼 */}
        <header className="label-modal-toolbar">
          <div className="label-modal-header-left">
            <div className="label-icon-badge">
              <Tag size={18} />
            </div>
            <div className="label-title-block">
              <div className="label-title-line">
                <h2>상품정보 라벨 출력</h2>
                <span className="label-spec-pill">
                  {labelSize === "50x50"
                    ? "50×50mm (소형)"
                    : orientation === "portrait"
                    ? "80×100mm (세로형)"
                    : "100×80mm (가로형)"}
                </span>
              </div>
              <p>
                BEEPRT BY-48 감열 프린터 · 총 <strong>{labels.length}장</strong> 출력 예정 (미출력 {unprintedCount}장 / 기출력 {printedCount}장)
              </p>
            </div>
          </div>
          <div className="label-primary-actions">
            <Button
              variant="primary"
              leadingIcon={<Printer size={16} />}
              onClick={() => void triggerPrint()}
              className="label-print-btn"
            >
              라벨 인쇄 ({labels.length}장)
            </Button>
            <Button variant="ghost" leadingIcon={<X size={16} />} onClick={onClose}>
              닫기
            </Button>
          </div>
        </header>

        {/* 상단 2단: 용지 규격 및 출력 방향, 출력 대상 선택 컨트롤 바 */}
        <div className="label-modal-controls-bar">
          <div className="label-control-group">
            <span className="label-control-title">용지 규격</span>
            <div className="label-size-toggle" role="group" aria-label="라벨 용지 규격">
              <button
                type="button"
                className={`size-btn ${labelSize === "80x100" ? "active" : ""}`}
                onClick={() => setLabelSize("80x100")}
              >
                80×100mm (대형)
              </button>
              <button
                type="button"
                className={`size-btn ${labelSize === "50x50" ? "active" : ""}`}
                onClick={() => setLabelSize("50x50")}
              >
                50×50mm (소형)
              </button>
            </div>
          </div>

          {labelSize === "80x100" && (
            <div className="label-control-group">
              <span className="label-control-title">출력 방향</span>
              <div className="label-orientation-toggle" role="group" aria-label="라벨 출력 방향">
                <button
                  type="button"
                  className={`orientation-btn ${orientation === "portrait" ? "active" : ""}`}
                  onClick={() => setOrientation("portrait")}
                >
                  세로형 (80×100)
                </button>
                <button
                  type="button"
                  className={`orientation-btn ${orientation === "landscape" ? "active" : ""}`}
                  onClick={() => setOrientation("landscape")}
                >
                  가로형 (100×80)
                </button>
              </div>
            </div>
          )}

          {/* 출력 대상 필터 (중복 출력 방지 원클릭 토글) */}
          <div className="label-control-group">
            <span className="label-control-title">출력 대상</span>
            <div className="label-filter-toggle" role="group" aria-label="출력 대상 선택">
              <button
                type="button"
                className={`filter-btn ${filterMode === "all" ? "active" : ""}`}
                onClick={() => setFilterMode("all")}
              >
                전체 라벨 ({allLabels.length}장)
              </button>
              <button
                type="button"
                className={`filter-btn ${filterMode === "unprinted" ? "active" : ""}`}
                onClick={() => setFilterMode("unprinted")}
                disabled={unprintedCount === 0}
                title={unprintedCount === 0 ? "미출력된 라벨이 없습니다." : "이미 출력된 라벨을 제외하고 인쇄"}
              >
                미출력만 인쇄 ({unprintedCount}장)
              </button>
            </div>
          </div>

          <div className="label-control-hint">
            💡 {labelSize === "80x100" ? "프린터에서 'BY-482BT 80x100 라벨' 선택" : "프린터에서 'BY-482BT 50x50 라벨' 선택"}
          </div>
        </div>

        {/* 라벨 프리뷰 그리드 */}
        <div className="label-preview-container">
          {printedCount > 0 && filterMode === "all" && (
            <div className="label-warning-banner">
              <span>⚠️ 선택된 라벨 중 <strong>{printedCount}장</strong>은 이미 인쇄된 이력이 있습니다. 중복 출력을 방지하려면 상단 <strong>[미출력만 인쇄]</strong>를 선택하세요.</span>
              {unprintedCount > 0 && (
                <button
                  type="button"
                  className="filter-btn active"
                  onClick={() => setFilterMode("unprinted")}
                  style={{ marginLeft: "10px", padding: "4px 10px", fontSize: "0.78rem" }}
                >
                  미출력만 보기
                </button>
              )}
            </div>
          )}

          <div className="label-preview-guide">
            <span style={{ fontWeight: 800, color: "#0369a1", fontSize: "0.86rem" }}>
              💡 [용지 규격 선택 & 타 앱/택배송장 충돌 걱정 없는 인쇄 안내]
            </span>
            <span style={{ color: "#0f172a", fontSize: "0.82rem", lineHeight: 1.5, paddingLeft: "4px" }}>
              1. <strong>용지 크기 원클릭 전환:</strong> 현재 프린터에 장착된 라벨롤에 맞춰 상단 <strong>[80×100mm (대형)]</strong> 또는 <strong>[50×50mm (소형)]</strong>을 선택하세요.<br />
              2. <strong>중복 출력 방지:</strong> 이미 인쇄된 라벨은 상단 배지 및 카드로 확인 가능하며, <strong>[미출력만 인쇄]</strong>를 누르면 첫 인쇄 건만 선별 인쇄됩니다.<br />
              3. <strong>여백(Margins):</strong> 반드시 <strong>&apos;없음(None)&apos;</strong> 선택, <strong>머리글/바닥글:</strong> <strong>해제</strong> (빈 여백이나 2장 분할 없이 1장에 딱 맞게 인쇄됩니다).
            </span>
          </div>

          <div className="label-cards-grid">
            {labels.map((label) => (
              <article
                key={label.id}
                className={`label-card-preview size-${labelSize} ${orientation} ${label.isAlreadyPrinted ? "is-reprint" : "is-first-print"}`}
                title={`${label.productName} ${label.quantityBadge} - ${label.isAlreadyPrinted ? `기출력 ${label.labelPrintCount}회` : "미출력"}`}
              >
                {/* 0단: 출력 상태 안내 스트립 */}
                <div className={`preview-status-strip ${label.isAlreadyPrinted ? "printed" : "unprinted"}`}>
                  {label.isAlreadyPrinted ? (
                    <span>⚠️ 이미 출력됨 ({label.labelPrintCount}회 인쇄됨)</span>
                  ) : (
                    <span>✨ 첫 출력 (미인쇄)</span>
                  )}
                  {label.isAlreadyPrinted && label.labelPrintedAt && (
                    <span style={{ fontSize: "0.68rem", opacity: 0.85 }}>
                      최근: {label.labelPrintedAt.slice(5, 16).replace("T", " ")}
                    </span>
                  )}
                </div>

                {/* 1단: 상품명 및 수량 순번 (대형 강조) */}
                <div className="preview-product-row">
                  <span className="preview-product-name">{label.productName}</span>
                  <span className="preview-qty-badge">{label.quantityBadge}</span>
                </div>

                {/* 2단: 주문자명 및 결제상태 (대형 강조) */}
                <div className="preview-buyer-row">
                  <div className="preview-buyer-wrap">
                    <span className="preview-buyer-lbl">주문자:</span>
                    <strong className="preview-buyer-name">{label.buyerName}</strong>
                  </div>
                  <span className={`preview-pay-badge ${label.isPaid ? "paid" : "unpaid"}`}>
                    {label.paymentStatusLabel}
                  </span>
                </div>

                {/* 3단: 날짜 및 수령방법 */}
                <div className="preview-meta-row">
                  <span className="preview-date">{label.date}</span>
                  <span className="preview-method-tag">
                    {label.classificationLabel}{label.pickupTime ? ` (${label.pickupTime})` : ""}
                  </span>
                </div>

                {/* 4단: 본문 상세 (현장수령 vs 택배) */}
                <div className="preview-label-body">
                  {label.classification === "shipping" ? (
                    <div className="preview-shipping-box">
                      <div className="preview-shipping-row">
                        <span className="preview-shipping-lbl">받는 분:</span>
                        <strong className="preview-recipient-val">
                          {label.recipientName} {label.recipientPhone ? `(${formatPhone(label.recipientPhone)})` : ""}
                        </strong>
                      </div>
                      <div className="preview-shipping-row">
                        <span className="preview-shipping-lbl">배송지:</span>
                        <span className="preview-addr-val">{label.fullAddress || "주소 미입력"}</span>
                      </div>
                      <div className="preview-shipping-row muted">
                        <span className="preview-shipping-lbl">보낸 분:</span>
                        <span>{label.buyerName} {label.buyerPhone ? `(${formatPhone(label.buyerPhone)})` : ""}</span>
                      </div>
                      {label.note ? (
                        <div className="preview-note-box">
                          {formatCleanNote(label.note)}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="preview-onsite-box">
                      <div className="preview-phone-row">
                        <span className="preview-phone-lbl">연락처:</span>
                        <strong className="preview-phone-val">{formatPhone(label.buyerPhone) || "연락처 미등록"}</strong>
                      </div>
                      <div className="preview-order-no">
                        주문번호: <strong>{label.orderNo}</strong>
                      </div>
                      {label.note ? (
                        <div className="preview-note-box">
                          {formatCleanNote(label.note)}
                        </div>
                      ) : (
                        <div className="preview-note-placeholder">
                          ※ 세트 제작 완료 후 포장 부착용 라벨
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5단: 하단 푸터 */}
                <div className="preview-label-footer">
                  <span className="preview-brand">정일품 한우선물세트</span>
                  <span className="preview-order-suffix">{label.orderNo}</span>
                  <button
                    className="preview-copy-btn"
                    onClick={() => copyLabelText(label)}
                    title="라벨 텍스트 복사"
                  >
                    {copiedId === label.id ? <CheckCircle2 size={12} color="#16a34a" /> : <Copy size={12} />}
                  </button>
                </div>
              </article>
            ))}

            {labels.length === 0 && (
              <div className="label-empty-notice">
                <p>
                  {filterMode === "unprinted"
                    ? "선택된 주문 중 미출력된 라벨이 없습니다. (모든 라벨이 이미 출력되었습니다.)"
                    : "출력할 상품 라벨이 없습니다."}
                </p>
                {filterMode === "unprinted" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFilterMode("all")}
                    style={{ marginTop: "12px" }}
                  >
                    전체 라벨 다시 보기
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

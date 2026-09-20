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
  return note
    .replace(/^(메모:\s*)+/gi, "메모: ")
    .replace(/^(요청\/메모:\s*)+/gi, "요청: ")
    .trim();
}

export default function WorkshopLabelModal({
  open,
  items,
  date,
  autoPrint = false,
  onClose,
}: WorkshopLabelModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const labels = useMemo(() => {
    return generatePackingLabels(items, date);
  }, [items, date]);

  // 라벨 HTML 및 인쇄 전용 iframe 빌드 함수
  const triggerPrint = useCallback(() => {
    if (!labels.length) return;

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

    const isPortrait = orientation === "portrait";
    const pageSize = isPortrait ? "80mm 100mm" : "100mm 80mm";
    const cardWidth = isPortrait ? "80mm" : "100mm";
    // 100mm 롤 라벨에서 상하 물리 갭(2~3mm) 및 프린터 하드웨어 마진(4~8mm) 감안:
    // 카드 높이를 84mm로 지정해야 '여백: 없음' 시 2장으로 절대 넘어가지 않고 1장에 상단부터 꽉 차게 출력됨
    const cardHeight = isPortrait ? "84mm" : "68mm";
    const cardPadding = isPortrait ? "2.5mm 3.8mm 2mm" : "2mm 3.8mm 1.5mm";

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

    /* 1단: 상품명 및 수량 순번 (대형 볼드) */
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
      font-size: 22pt;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -0.5px;
      word-break: keep-all;
      flex: 1;
      color: #000;
    }
    .label-qty-badge {
      font-size: 20pt;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -0.3px;
      white-space: nowrap;
      color: #000;
    }

    /* 2단: 주문자명 및 결제상태 (대형 볼드) */
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
      font-size: 11pt;
      font-weight: 800;
      color: #111;
      white-space: nowrap;
    }
    .label-buyer-name {
      font-size: 18pt;
      font-weight: 900;
      letter-spacing: -0.4px;
      color: #000;
      word-break: break-all;
    }
    .label-pay-badge {
      font-size: 10.5pt;
      font-weight: 900;
      padding: 0.6mm 2mm;
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
      font-size: 10.5pt;
      font-weight: 800;
      padding: 0.8mm 0;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      margin-bottom: 1.5mm;
      line-height: 1.15;
    }
    .label-method-tag {
      font-size: 11.5pt;
      font-weight: 900;
      border: 1.2px solid #000;
      padding: 0.3mm 1.8mm;
      border-radius: 2.5px;
    }

    /* 4단: 본문 (현장수령 vs 택배) - 꽉 찬 레이아웃 */
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
      font-size: 15.5pt;
      font-weight: 900;
      color: #000;
      display: flex;
      align-items: baseline;
      gap: 1.5mm;
    }
    .label-phone-lbl {
      font-size: 11pt;
      font-weight: 800;
      color: #222;
    }
    .label-order-no {
      font-size: 10pt;
      font-weight: 700;
      color: #333;
    }
    .label-note-box {
      font-size: 10pt;
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
      font-size: 10pt;
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
      font-size: 10pt;
    }
    .shipping-val {
      font-weight: 700;
      word-break: break-all;
      font-size: 10pt;
    }
    .shipping-val.recipient {
      font-size: 13.5pt;
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
      font-size: 8pt;
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
    <div class="label-slip-card">
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
            <div class="shipping-row" style="font-size: 9pt; color: #444;">
              <span class="shipping-label" style="font-size: 9pt; color: #444;">보내는 분:</span>
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
  }, [labels, orientation]);

  // autoPrint가 켜져 있으면 모달 오픈 시 자동 1회 인쇄 트리거
  useEffect(() => {
    if (open && autoPrint && labels.length > 0) {
      const timer = setTimeout(() => {
        triggerPrint();
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
        {/* 상단 툴바 */}
        <header className="label-modal-toolbar">
          <div className="label-modal-header-left">
            <div className="label-icon-badge">
              <Tag size={18} />
            </div>
            <div>
              <h2>{orientation === "portrait" ? "80×100mm (세로)" : "100×80mm (가로)"} 상품정보 라벨 출력</h2>
              <p>
                BEEPRT BY-48 감열 프린터 · 총 <strong>{labels.length}장</strong> 출력 예정 (1장 쏙 맞춤 규격)
              </p>
            </div>
          </div>
          <div className="label-modal-actions">
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
            <Button
              variant="primary"
              leadingIcon={<Printer size={16} />}
              onClick={triggerPrint}
            >
              라벨 인쇄 ({labels.length}장)
            </Button>
            <Button variant="ghost" leadingIcon={<X size={16} />} onClick={onClose}>
              닫기
            </Button>
          </div>
        </header>

        {/* 라벨 프리뷰 그리드 */}
        <div className="label-preview-container">
          <div className="label-preview-guide">
            <span style={{ fontWeight: 800, color: "#0369a1", fontSize: "0.86rem" }}>
              💡 [1장 출력 & 상단 여백 제거 필수 설정]
            </span>
            <span style={{ color: "#0f172a", fontSize: "0.82rem", lineHeight: 1.5, paddingLeft: "4px" }}>
              1. <strong>여백(Margins):</strong> 반드시 <strong>&apos;없음(None)&apos;</strong> 선택 (카드 규격을 84mm 안전 높이로 최적화하여 2장 분할 및 상단 빈 여백 없이 1장 안에 정확히 출력됩니다)<br />
              2. <strong>머리글 및 바닥글:</strong> <strong>체크 해제</strong> (URL/날짜 출력 시 2장으로 분할되는 원인)<br />
              3. <strong>방향 전환:</strong> 롤 라벨 공급 방향에 따라 상단 <strong>[세로형 (80×100)]</strong> 또는 <strong>[가로형 (100×80)]</strong> 선택
            </span>
          </div>

          <div className="label-cards-grid">
            {labels.map((label) => (
              <article key={label.id} className={`label-card-preview ${orientation}`} title={`${label.productName} ${label.quantityBadge}`}>
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
              <div className="label-empty-box">
                <p>출력할 상품 라벨이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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

export default function WorkshopLabelModal({
  open,
  items,
  date,
  autoPrint = false,
  onClose,
}: WorkshopLabelModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>상품정보 라벨 인쇄</title>
  <style>
    @page {
      size: 80mm 100mm;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 80mm;
      height: 100mm;
      margin: 0;
      padding: 0;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-slip-card {
      width: 80mm;
      height: 100mm;
      max-height: 100mm;
      overflow: hidden;
      padding: 3.5mm 4.5mm 3mm;
      page-break-after: always;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: none;
    }
    .label-slip-card:last-child {
      page-break-after: auto !important;
    }

    /* 1단: 상품명 및 수량 순번 (초대형 헤더) */
    .label-product-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.2px solid #000;
      padding-bottom: 1.2mm;
      margin-bottom: 1.4mm;
      gap: 2mm;
    }
    .label-product-name {
      font-size: 22pt;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: -0.6px;
      word-break: keep-all;
      flex: 1;
      color: #000;
    }
    .label-qty-badge {
      font-size: 20pt;
      font-weight: 900;
      line-height: 1.15;
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
      line-height: 1.2;
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
      color: #222;
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
      font-size: 11pt;
      font-weight: 900;
      padding: 0.8mm 2mm;
      border-radius: 2.5px;
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
      font-size: 11pt;
      font-weight: 800;
      padding: 1mm 0;
      border-top: 1.2px dashed #000;
      border-bottom: 1.2px dashed #000;
      margin-bottom: 1.6mm;
      line-height: 1.2;
    }
    .label-method-tag {
      font-size: 11.5pt;
      font-weight: 900;
      border: 1.5px solid #000;
      padding: 0.5mm 2mm;
      border-radius: 3px;
    }

    /* 4단: 본문 (현장수령 vs 택배) */
    .label-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 1.6mm;
      font-size: 11pt;
      line-height: 1.3;
      overflow: hidden;
    }
    .label-phone-line {
      font-size: 14pt;
      font-weight: 900;
      color: #000;
    }
    .label-note-box {
      font-size: 10.5pt;
      font-weight: 700;
      border: 1px solid #333;
      border-radius: 3px;
      padding: 1.2mm 2mm;
      background: #f0f0f0;
      line-height: 1.35;
      word-break: break-all;
    }
    .shipping-section {
      background: #f5f5f5;
      border: 1.2px solid #000;
      border-radius: 3px;
      padding: 1.8mm 2.2mm;
      font-size: 10.5pt;
      line-height: 1.3;
      display: flex;
      flex-direction: column;
      gap: 1.4mm;
    }
    .shipping-row {
      display: flex;
      gap: 1.2mm;
    }
    .shipping-label {
      font-weight: 900;
      white-space: nowrap;
      color: #000;
      font-size: 11pt;
    }
    .shipping-val {
      font-weight: 700;
      word-break: break-all;
    }
    .shipping-val.recipient {
      font-size: 13.5pt;
      font-weight: 900;
    }

    /* 5단: 하단 풋터 */
    .label-footer {
      border-top: 1px solid #666;
      padding-top: 1mm;
      margin-top: 1mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5pt;
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
            <div class="shipping-row" style="font-size: 9.5pt; color: #444;">
              <span class="shipping-label" style="font-size: 9.5pt; color: #444;">보내는 분:</span>
              <span class="shipping-val">${label.buyerName} ${label.buyerPhone ? `(${formatPhone(label.buyerPhone)})` : ""}</span>
            </div>
            ${
              label.note
                ? `<div class="label-note-box" style="margin-top: 0.8mm;"><strong>요청/메모:</strong> ${label.note}</div>`
                : ""
            }
          </div>
        `
            : `
          <div style="padding: 0.8mm 0; display: flex; flex-direction: column; gap: 1.2mm;">
            <div class="label-phone-line">
              <span style="font-size: 11pt; font-weight: 800; color: #333;">연락처:</span>
              <strong>${formatPhone(label.buyerPhone) || "연락처 미등록"}</strong>
            </div>
            <div style="font-size: 10.5pt; color: #444;">주문번호: ${label.orderNo}</div>
            ${
              label.note
                ? `<div class="label-note-box"><strong>요청/메모:</strong> ${label.note}</div>`
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
  }, [labels]);

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
              <h2>80×100mm 상품정보 라벨 출력</h2>
              <p>
                BEEPRT BY-48 감열 프린터 · 총 <strong>{labels.length}장</strong> 출력 예정 (빈 용지 방지 규격)
              </p>
            </div>
          </div>
          <div className="label-modal-actions">
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
            <span>※ 출력 시 프린터를 <strong>BEEPRT BY-48</strong>로 선택하세요. (용지: 80mm × 100mm)</span>
            <span>완성된 패키지에 부착하여 상품 식별 및 택배 송장 매칭용으로 사용합니다.</span>
          </div>

          <div className="label-cards-grid">
            {labels.map((label) => (
              <article key={label.id} className="label-card-preview" title={`${label.productName} ${label.quantityBadge}`}>
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
                          <strong>요청/메모:</strong> {label.note}
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
                        주문번호: {label.orderNo}
                      </div>
                      {label.note ? (
                        <div className="preview-note-box">
                          <strong>메모:</strong> {label.note}
                        </div>
                      ) : null}
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

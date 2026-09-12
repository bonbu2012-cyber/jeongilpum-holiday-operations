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
      size: 50mm 50mm;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 50mm;
      height: 50mm;
      margin: 0;
      padding: 0;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-slip-card {
      width: 50mm;
      height: 50mm;
      max-height: 50mm;
      overflow: hidden;
      padding: 2.2mm 2.5mm;
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
    .label-header {
      border-bottom: 1.5px solid #000;
      padding-bottom: 1mm;
      margin-bottom: 1mm;
    }
    .label-title {
      font-size: 10.5pt;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.3px;
      word-break: break-all;
    }
    .label-qty-badge {
      font-size: 10pt;
      font-weight: 800;
      display: inline-block;
      margin-left: 1mm;
    }
    .label-meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      font-weight: 600;
      margin-top: 0.8mm;
      line-height: 1.1;
    }
    .label-method-tag {
      font-size: 7.8pt;
      font-weight: 800;
      padding: 0.2mm 1mm;
      border: 1px solid #000;
      border-radius: 2px;
    }
    .label-pay-tag {
      font-size: 7.8pt;
      font-weight: 800;
    }
    .label-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.8mm;
      font-size: 7.5pt;
      line-height: 1.2;
      overflow: hidden;
    }
    .shipping-section {
      background: #f4f4f4;
      border: 0.8px solid #000;
      border-radius: 2px;
      padding: 1mm;
      font-size: 7pt;
      line-height: 1.15;
    }
    .shipping-row {
      display: flex;
      gap: 1mm;
    }
    .shipping-label {
      font-weight: 800;
      white-space: nowrap;
      color: #000;
    }
    .shipping-val {
      font-weight: 600;
      word-break: break-all;
    }
    .label-footer {
      border-top: 0.8px dashed #666;
      padding-top: 0.8mm;
      margin-top: 0.8mm;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #333;
    }
  </style>
</head>
<body>
  ${labels
    .map(
      (label) => `
    <div class="label-slip-card">
      <div class="label-header">
        <div class="label-title">
          ${label.buyerName} - ${label.productName}
          <span class="label-qty-badge">${label.quantityBadge}</span>
        </div>
        <div class="label-meta-row">
          <span>${label.date}</span>
          <span class="label-method-tag">${label.classificationLabel}${label.pickupTime ? ` (${label.pickupTime})` : ""}</span>
          <span class="label-pay-tag">[${label.paymentStatusLabel}]</span>
        </div>
      </div>

      <div class="label-body">
        ${
          label.classification === "shipping"
            ? `
          <div class="shipping-section">
            <div class="shipping-row">
              <span class="shipping-label">보내는 분:</span>
              <span class="shipping-val">${label.buyerName} ${label.buyerPhone ? `(${label.buyerPhone})` : ""}</span>
            </div>
            <div class="shipping-row">
              <span class="shipping-label">받는 분:</span>
              <span class="shipping-val">${label.recipientName} ${label.recipientPhone ? `(${label.recipientPhone})` : ""}</span>
            </div>
            <div class="shipping-row">
              <span class="shipping-label">배송주소:</span>
              <span class="shipping-val">${label.fullAddress || "주소 미입력"}</span>
            </div>
          </div>
        `
            : `
          <div style="padding: 0.5mm 0;">
            <div><strong>주문자:</strong> ${label.buyerName} (${label.buyerPhone || "연락처 미등록"})</div>
            <div><strong>주문번호:</strong> ${label.orderNo}</div>
            ${label.note ? `<div style="font-size: 7pt; color: #222;"><strong>메모:</strong> ${label.note}</div>` : ""}
          </div>
        `
        }
      </div>

      <div class="label-footer">
        <span>정일품 한우선물세트</span>
        <span>${label.orderNo.slice(-6)}</span>
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
              <h2>50×50mm 상품정보 라벨 출력</h2>
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
            <span>※ 출력 시 프린터를 <strong>BEEPRT BY-48</strong>로 선택하세요. (용지: 50mm × 50mm)</span>
            <span>완성된 패키지에 부착하여 상품 식별 및 택배 송장 매칭용으로 사용합니다.</span>
          </div>

          <div className="label-cards-grid">
            {labels.map((label) => (
              <article key={label.id} className="label-card-preview" title={`${label.productName} ${label.quantityBadge}`}>
                <div className="preview-label-header">
                  <div className="preview-title">
                    <strong>{label.buyerName}</strong> - {label.productName}
                    <span className="preview-qty">{label.quantityBadge}</span>
                  </div>
                  <div className="preview-meta-line">
                    <span className="preview-date">{label.date}</span>
                    <span className="preview-type-badge">{label.classificationLabel}{label.pickupTime ? ` (${label.pickupTime})` : ""}</span>
                    <span className={`preview-pay-badge ${label.isPaid ? "paid" : "unpaid"}`}>
                      {label.paymentStatusLabel}
                    </span>
                  </div>
                </div>

                <div className="preview-label-body">
                  {label.classification === "shipping" ? (
                    <div className="preview-shipping-box">
                      <p>
                        <strong>보내는 분:</strong> {label.buyerName} {label.buyerPhone ? `(${label.buyerPhone})` : ""}
                      </p>
                      <p>
                        <strong>받는 분:</strong> {label.recipientName} {label.recipientPhone ? `(${label.recipientPhone})` : ""}
                      </p>
                      <p className="preview-addr">
                        <strong>배송지:</strong> {label.fullAddress || "주소 미입력"}
                      </p>
                    </div>
                  ) : (
                    <div className="preview-onsite-box">
                      <p>
                        <strong>주문자:</strong> {label.buyerName} ({label.buyerPhone || "연락처 미등록"})
                      </p>
                      <p>
                        <strong>주문번호:</strong> {label.orderNo}
                      </p>
                      {label.note ? <p className="preview-note"><strong>메모:</strong> {label.note}</p> : null}
                    </div>
                  )}
                </div>

                <div className="preview-label-footer">
                  <span className="preview-brand">정일품 한우선물세트</span>
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

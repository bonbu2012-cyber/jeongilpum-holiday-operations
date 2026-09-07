"use client";

import { useState } from "react";
import "../privacy-notice.css";

export default function PrivacyNoticeStep({ type, next }: { type: "pickup" | "shipping"; next: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const shipping = type === "shipping";

  return (
    <div className="flow-card narrow privacy-consent-card">
      <div className="flow-heading">
        <small>개인정보 처리 안내</small>
        <h1>정보를 안전하게 처리할게요</h1>
        <p>{shipping ? "주문자와 받는 분의 정보를 입력하기 전에 아래 내용을 확인해주세요." : "주문자 정보를 입력하기 전에 아래 내용을 확인해주세요."}</p>
      </div>

      <div className="privacy-purpose-card">
        <span aria-hidden="true">✓</span>
        <div>
          <b>{shipping ? "주문 확인과 배송을 위해 처리합니다" : "주문 확인과 방문수령 안내를 위해 처리합니다"}</b>
          <p>주문에 필요한 정보와 이용 목적을 알기 쉽게 안내합니다.</p>
        </div>
      </div>

      <dl className="privacy-summary-list">
        <div>
          <dt>처리 정보</dt>
          <dd>{shipping ? <>주문자 성명·전화번호<br />받는 분 성명·전화번호·배송 주소</> : "주문자 성명·전화번호"}</dd>
        </div>
        <div>
          <dt>이용 목적</dt>
          <dd>{shipping ? "주문 확인, 택배 배송, 배송 관련 문의 처리" : "주문 확인, 방문수령 일정 안내, 주문 관련 문의 처리"}</dd>
        </div>
        <div>
          <dt>보관 기간</dt>
          <dd>주문 처리 및 관계 법령에서 정한 기간</dd>
        </div>
        {shipping ? <div>
          <dt>배송 전달</dt>
          <dd>배송에 필요한 정보만 담당 택배사에 전달</dd>
        </div> : null}
      </dl>

      <button
        type="button"
        className="privacy-details-toggle"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        <span>자세한 처리 내용 보기</span>
        <b aria-hidden="true">{detailsOpen ? "−" : "+"}</b>
      </button>

      {detailsOpen ? (
        <div className="privacy-details-panel">
          <p>입력한 정보는 {shipping ? "주문 확인과 배송" : "주문 확인과 방문수령 안내"}를 위해 처리합니다.</p>
          {shipping ? <p>택배사에는 받는 분의 성명·연락처·주소만 전달합니다.</p> : null}
          <p>보관 기간이 끝난 정보는 안전한 방법으로 파기합니다.</p>
          <p>정보의 열람·정정·삭제·처리정지는 매장에 요청할 수 있습니다.</p>
        </div>
      ) : null}

      <label className={confirmed ? "privacy-confirm checked" : "privacy-confirm"}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span aria-hidden="true">✓</span>
        <b>개인정보 처리 안내를 확인했습니다.</b>
        <em>필수</em>
      </label>

      <p className="privacy-confirm-help">확인 후 주문자 정보 입력 단계로 이동할 수 있습니다.</p>

      <button type="button" className="main-cta privacy-continue" disabled={!confirmed} onClick={next}>
        주문자 정보 입력 <span>→</span>
      </button>
    </div>
  );
}










"use client";

import { useState } from "react";

type Draft = {
  customerName: string;
  customerPhone: string;
  giftType: string;
  quantity: string;
  budgetRange: string;
  fulfillmentPreference: string;
  preferredSchedule: string;
  note: string;
};

const initialDraft: Draft = {
  customerName: "",
  customerPhone: "",
  giftType: "",
  quantity: "1",
  budgetRange: "",
  fulfillmentPreference: "",
  preferredSchedule: "",
  note: "",
};

export default function CustomOrderApp() {
  const [draft, setDraft] = useState(initialDraft);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestNo, setRequestNo] = useState("");

  const set = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const phoneValid = draft.customerPhone.replace(/D/g, "").length >= 10;
  const valid = Boolean(
    draft.customerName.trim() &&
    phoneValid &&
    draft.giftType &&
    Number.parseInt(draft.quantity, 10) > 0 &&
    draft.budgetRange &&
    draft.fulfillmentPreference
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || submitting) {
      setError("필수 항목을 확인해주세요. 연락처는 숫자 10자리 이상 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/custom-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          quantity: Number.parseInt(draft.quantity, 10),
          idempotencyKey,
        }),
      });
      const data = await response.json() as { request?: { requestNo: string }; error?: string };
      if (!response.ok || !data.request) throw new Error(data.error || "맞춤주문을 접수하지 못했습니다.");
      setRequestNo(data.request.requestNo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "맞춤주문을 접수하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setDraft(initialDraft);
    setIdempotencyKey(crypto.randomUUID());
    setRequestNo("");
    setError("");
  };

  if (requestNo) {
    return <main className="custom-order-page">
      <header className="custom-top"><a href="/kiosk">← 상품 주문으로</a><span>正 정일품</span></header>
      <section className="custom-complete">
        <div>✓</div><small>CUSTOM ORDER RECEIVED</small>
        <h1>맞춤주문 상담이 접수되었습니다</h1>
        <p>판매장에서 요청 내용을 확인한 뒤 입력하신 연락처로 안내드리겠습니다.</p>
        <dl><dt>접수번호</dt><dd>{requestNo}</dd></dl>
        <button onClick={reset}>새 맞춤주문 접수</button>
        <a href="/kiosk">선물세트 화면으로 돌아가기</a>
      </section>
    </main>;
  }

  return <main className="custom-order-page">
    <header className="custom-top"><a href="/kiosk">← 상품 주문으로</a><span>正 정일품</span></header>
    <section className="custom-hero">
      <small>CUSTOM ORDER</small>
      <h1>원하시는 선물을<br/>함께 구성해드립니다</h1>
      <p>회사·단체 선물, 다량 주문, 혼합 구성처럼 정해진 세트로 해결하기 어려운 주문을 남겨주세요.</p>
    </section>
    <form className="custom-form" onSubmit={submit}>
      <section>
        <h2><span>1</span> 어떤 선물을 찾으시나요?</h2>
        <div className="choice-grid">
          {["소고기 선물세트","LA갈비","사골·보신세트","구성 상담 필요"].map((item) =>
            <button type="button" key={item} className={draft.giftType===item?"selected":""} onClick={()=>set("giftType",item)}>{item}</button>
          )}
        </div>
      </section>
      <section>
        <h2><span>2</span> 수량과 예산을 알려주세요</h2>
        <div className="custom-fields two">
          <label><span>예상 수량</span><input type="number" min="1" inputMode="numeric" value={draft.quantity} onChange={(e)=>set("quantity",e.target.value)}/></label>
          <label><span>세트당 예산</span><select value={draft.budgetRange} onChange={(e)=>set("budgetRange",e.target.value)}><option value="">선택해주세요</option><option>10만원 이하</option><option>10–20만원</option><option>20–30만원</option><option>30만원 이상</option><option>상담 후 결정</option></select></label>
        </div>
      </section>
      <section>
        <h2><span>3</span> 어떻게 받으실 예정인가요?</h2>
        <div className="choice-grid three">
          {["방문수령","택배발송","방문+택배 혼합"].map((item) =>
            <button type="button" key={item} className={draft.fulfillmentPreference===item?"selected":""} onClick={()=>set("fulfillmentPreference",item)}>{item}</button>
          )}
        </div>
        <label className="custom-wide"><span>희망 일정 (선택)</span><input value={draft.preferredSchedule} onChange={(e)=>set("preferredSchedule",e.target.value)} placeholder="예: 9월 22일 오전까지"/></label>
      </section>
      <section>
        <h2><span>4</span> 연락받으실 정보를 알려주세요</h2>
        <div className="custom-fields two">
          <label><span>주문자명 또는 회사명</span><input value={draft.customerName} onChange={(e)=>set("customerName",e.target.value)} placeholder="개인 이름 또는 회사명"/></label>
          <label><span>연락처</span><input type="tel" inputMode="numeric" value={draft.customerPhone} onChange={(e)=>set("customerPhone",e.target.value)} placeholder="010-0000-0000"/></label>
        </div>
        <label className="custom-wide"><span>구성·포장·배송 요청사항 (선택)</span><textarea value={draft.note} onChange={(e)=>set("note",e.target.value)} placeholder="원하시는 구성과 포장, 배송지 수 등 필요한 내용을 자유롭게 남겨주세요."/></label>
      </section>
      {error&&<div className="custom-error" role="alert">{error}</div>}
      <button className="custom-submit" disabled={submitting}>{submitting?"접수하고 있습니다…":"맞춤주문 상담 접수"}<span>→</span></button>
      <p className="custom-safe">중복 접수되지 않도록 안전하게 확인합니다.</p>
    </form>
  </main>;
}
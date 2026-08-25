"use client";

import { useEffect, useState } from "react";

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

type Step = "form" | "review" | "done";
type DraftErrors = Partial<Record<keyof Draft, string>>;
const draftStorageKey = "jeongilpum-custom-order-draft";

function validateDraft(draft: Draft): DraftErrors {
  const errors: DraftErrors = {};
  const quantity = Number.parseInt(draft.quantity, 10);
  if (!draft.giftType) errors.giftType = "원하시는 선물 종류를 선택해주세요.";
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) errors.quantity = "수량은 1개 이상 9,999개 이하로 입력해주세요.";
  if (!draft.budgetRange) errors.budgetRange = "세트당 예산을 선택해주세요.";
  if (!draft.fulfillmentPreference) errors.fulfillmentPreference = "받으실 방법을 선택해주세요.";
  if (!draft.customerName.trim()) errors.customerName = "주문자명 또는 회사명을 입력해주세요.";
  if (draft.customerPhone.replace(/\D/g, "").length < 10) errors.customerPhone = "연락처 숫자를 10자리 이상 입력해주세요.";
  return errors;
}

export default function CustomOrderApp() {
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState<Step>("form");
  const [hydrated, setHydrated] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<DraftErrors>({});
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestNo, setRequestNo] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = sessionStorage.getItem(draftStorageKey);
      if (saved) {
        try {
          setDraft({ ...initialDraft, ...(JSON.parse(saved) as Partial<Draft>) });
        } catch {
          sessionStorage.removeItem(draftStorageKey);
        }
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (hydrated && step !== "done") sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [draft, hydrated, step]);

  useEffect(() => {
    if (hydrated) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [hydrated, step]);

  const set = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setError("");
  };

  const review = (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateDraft(draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("입력하지 않은 필수 항목을 아래에서 확인해주세요.");
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true'], .field-error")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setError("");
    setStep("review");
  };

  const submit = async () => {
    const errors = validateDraft(draft);
    if (Object.keys(errors).length || submitting) {
      setFieldErrors(errors);
      setError("입력하지 않은 필수 항목을 아래에서 확인해주세요.");
      setStep("form");
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
      sessionStorage.removeItem(draftStorageKey);
      setStep("done");
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
    setFieldErrors({});
    sessionStorage.removeItem(draftStorageKey);
    setStep("form");
  };

  if (step === "done" && requestNo) {
    return <main className="custom-order-page">
      <header className="custom-top"><a href="/kiosk">← 상품 주문으로</a><span>正 정일품</span></header>
      <section className="custom-complete">
        <div>✓</div><small>CUSTOM ORDER RECEIVED</small>
        <h1>맞춤주문 상담이 접수되었습니다</h1>
        <p>판매장에서 요청 내용을 확인한 뒤 입력하신 연락처로 안내드리겠습니다.</p>
        <dl><dt>접수번호</dt><dd>{requestNo}</dd></dl>
        <button type="button" onClick={reset}>새 맞춤주문 접수</button>
        <a href="/kiosk">선물세트 화면으로 돌아가기</a>
      </section>
    </main>;
  }

  if (step === "review") {
    return <main className="custom-order-page">
      <header className="custom-top"><button type="button" onClick={()=>setStep("form")}>← 입력 내용 수정</button><span>正 정일품</span></header>
      <section className="custom-hero">
        <small>CUSTOM ORDER · REVIEW</small>
        <h1>맞춤주문 내용을<br/>마지막으로 확인해주세요</h1>
        <p>아래 내용으로 상담 요청을 접수합니다. 수정이 필요하면 이전으로 돌아갈 수 있습니다.</p>
      </section>
      <section className="custom-form custom-review">
        <section>
          <h2><span>✓</span> 맞춤주문 최종확인</h2>
          <div className="review-list">
            <section><h3>선물 구성</h3><p><span>선물 종류</span><b>{draft.giftType}</b></p><p><span>예상 수량</span><b>{draft.quantity}세트</b></p><p><span>세트당 예산</span><b>{draft.budgetRange}</b></p></section>
            <section><h3>수령·연락 정보</h3><p><span>받는 방법</span><b>{draft.fulfillmentPreference}</b></p><p><span>희망 일정</span><b>{draft.preferredSchedule || "상담 후 결정"}</b></p><p><span>주문자</span><b>{draft.customerName}</b></p><p><span>연락처</span><b>{draft.customerPhone}</b></p></section>
            {draft.note && <section className="custom-review-note"><h3>요청사항</h3><p><b>{draft.note}</b></p></section>}
          </div>
        </section>
        {error&&<div className="custom-error" role="alert">{error}</div>}
        <div className="custom-review-actions">
          <button type="button" onClick={()=>setStep("form")} disabled={submitting}>← 이전</button>
          <button type="button" className="custom-submit" onClick={()=>void submit()} disabled={submitting}>{submitting?"접수하고 있습니다…":"이 내용으로 맞춤주문 접수"}<span>→</span></button>
        </div>
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
    <form className="custom-form" onSubmit={review} noValidate>
      <section>
        <h2><span>1</span> 어떤 선물을 찾으시나요?</h2>
        <div className="choice-grid">
          {["소고기 선물세트","LA갈비","사골·보신세트","구성 상담 필요"].map((item) =>
            <button type="button" key={item} className={draft.giftType===item?"selected":""} onClick={()=>set("giftType",item)}>{item}</button>
          )}
        </div>
        {fieldErrors.giftType&&<span className="field-error" role="alert">{fieldErrors.giftType}</span>}
      </section>
      <section>
        <h2><span>2</span> 수량과 예산을 알려주세요</h2>
        <div className="custom-fields two">
          <label><span>예상 수량</span><input type="number" min="1" max="9999" inputMode="numeric" aria-invalid={Boolean(fieldErrors.quantity)} value={draft.quantity} onChange={(e)=>set("quantity",e.target.value)}/>{fieldErrors.quantity&&<small className="field-error">{fieldErrors.quantity}</small>}</label>
          <label><span>세트당 예산</span><select aria-invalid={Boolean(fieldErrors.budgetRange)} value={draft.budgetRange} onChange={(e)=>set("budgetRange",e.target.value)}><option value="">선택해주세요</option><option>10만원 이하</option><option>10–20만원</option><option>20–30만원</option><option>30만원 이상</option><option>상담 후 결정</option></select>{fieldErrors.budgetRange&&<small className="field-error">{fieldErrors.budgetRange}</small>}</label>
        </div>
      </section>
      <section>
        <h2><span>3</span> 어떻게 받으실 예정인가요?</h2>
        <div className="choice-grid three">
          {["방문수령","택배발송","방문+택배 혼합"].map((item) =>
            <button type="button" key={item} className={draft.fulfillmentPreference===item?"selected":""} onClick={()=>set("fulfillmentPreference",item)}>{item}</button>
          )}
        </div>
        {fieldErrors.fulfillmentPreference&&<span className="field-error" role="alert">{fieldErrors.fulfillmentPreference}</span>}
        <label className="custom-wide"><span>희망 일정 (선택)</span><input value={draft.preferredSchedule} onChange={(e)=>set("preferredSchedule",e.target.value)} placeholder="예: 9월 22일 오전까지"/></label>
      </section>
      <section>
        <h2><span>4</span> 연락받으실 정보를 알려주세요</h2>
        <div className="custom-fields two">
          <label><span>주문자명 또는 회사명</span><input aria-invalid={Boolean(fieldErrors.customerName)} value={draft.customerName} onChange={(e)=>set("customerName",e.target.value)} placeholder="개인 이름 또는 회사명"/>{fieldErrors.customerName&&<small className="field-error">{fieldErrors.customerName}</small>}</label>
          <label><span>연락처</span><input type="tel" inputMode="numeric" aria-invalid={Boolean(fieldErrors.customerPhone)} value={draft.customerPhone} onChange={(e)=>set("customerPhone",e.target.value)} placeholder="010-0000-0000"/>{fieldErrors.customerPhone&&<small className="field-error">{fieldErrors.customerPhone}</small>}</label>
        </div>
        <label className="custom-wide"><span>구성·포장·배송 요청사항 (선택)</span><textarea value={draft.note} onChange={(e)=>set("note",e.target.value)} placeholder="원하시는 구성과 포장, 배송지 수 등 필요한 내용을 자유롭게 남겨주세요."/></label>
      </section>
      {error&&<div className="custom-error" role="alert">{error}</div>}
      <button type="submit" className="custom-submit">입력 완료 · 최종 확인<span>→</span></button>
      <p className="custom-safe">중복 접수되지 않도록 안전하게 확인합니다.</p>
    </form>
  </main>;
}

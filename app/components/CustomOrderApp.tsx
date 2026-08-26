"use client";

import { useEffect, useState } from "react";
import type { CustomOrderDraftItem, OrderDraft } from "./types";

const categories = ["진공세트", "프리미엄", "O'meat", "LA갈비", "뼈세트"] as const;
const budgetOptions = [
  { label: "20만원대", amount: 200_000 },
  { label: "25만원대", amount: 250_000 },
  { label: "30만원대", amount: 300_000 },
  { label: "40만원대", amount: 400_000 },
  { label: "50만원 이상", amount: 500_000 },
] as const;

type Draft = {
  category: CustomOrderDraftItem["category"] | "";
  budgetOption: string;
  directAmount: string;
  desiredComposition: string;
  preferredCut: string;
  fatPreference: string;
  packagingRequest: string;
  otherRequest: string;
};

const initialDraft: Draft = {
  category: "",
  budgetOption: "",
  directAmount: "",
  desiredComposition: "",
  preferredCut: "",
  fatPreference: "",
  packagingRequest: "",
  otherRequest: "",
};

const customStorageKey = "jeongilpum-custom-order-draft";
const kioskStorageKey = "jeongilpum-kiosk-draft";

function selectedAmount(draft: Draft) {
  if (draft.budgetOption === "금액 직접 입력") {
    return Number.parseInt(draft.directAmount.replace(/\D/g, ""), 10) || 0;
  }
  return budgetOptions.find((option) => option.label === draft.budgetOption)?.amount ?? 0;
}

export default function CustomOrderApp() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<{ category?: string; budget?: string }>({});

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = sessionStorage.getItem(customStorageKey);
      if (saved) {
        try {
          setDraft({ ...initialDraft, ...(JSON.parse(saved) as Partial<Draft>) });
        } catch {
          sessionStorage.removeItem(customStorageKey);
        }
      } else {
        const kioskSaved = sessionStorage.getItem(kioskStorageKey);
        if (kioskSaved) {
          try {
            const customItem = (JSON.parse(kioskSaved) as Partial<OrderDraft>).customItem;
            if (customItem) {
              setDraft({
                category: customItem.category,
                budgetOption: customItem.budgetOption,
                directAmount: customItem.budgetOption === "금액 직접 입력" ? String(customItem.budgetAmount) : "",
                desiredComposition: customItem.desiredComposition,
                preferredCut: customItem.preferredCut,
                fatPreference: customItem.fatPreference,
                packagingRequest: customItem.packagingRequest,
                otherRequest: customItem.otherRequest,
              });
            }
          } catch {
            // The kiosk route will repair an invalid main draft.
          }
        }
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (hydrated) sessionStorage.setItem(customStorageKey, JSON.stringify(draft));
  }, [draft, hydrated]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === "category") setErrors((current) => ({ ...current, category: undefined }));
    if (key === "budgetOption" || key === "directAmount") {
      setErrors((current) => ({ ...current, budget: undefined }));
    }
  };

  const complete = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = selectedAmount(draft);
    const nextErrors: typeof errors = {};
    if (!draft.category) nextErrors.category = "카테고리를 선택해주세요.";
    if (!draft.budgetOption) nextErrors.budget = "예산을 선택해주세요.";
    else if (amount < 200_000) nextErrors.budget = "맞춤주문은 20만원부터 가능합니다.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !draft.category) return;

    let orderDraft: Partial<OrderDraft> = {};
    const saved = sessionStorage.getItem(kioskStorageKey);
    if (saved) {
      try {
        orderDraft = JSON.parse(saved) as Partial<OrderDraft>;
      } catch {
        orderDraft = {};
      }
    }
    orderDraft.customItem = {
      category: draft.category,
      budgetOption: draft.budgetOption,
      budgetAmount: amount,
      desiredComposition: draft.desiredComposition.trim(),
      preferredCut: draft.preferredCut.trim(),
      fatPreference: draft.fatPreference.trim(),
      packagingRequest: draft.packagingRequest.trim(),
      otherRequest: draft.otherRequest.trim(),
    };
    orderDraft.idempotencyKey = crypto.randomUUID();
    sessionStorage.setItem(kioskStorageKey, JSON.stringify(orderDraft));
    sessionStorage.setItem(customStorageKey, JSON.stringify(draft));
    window.location.assign("/kiosk?resume=cart");
  };

  return (
    <main className="custom-order-page">
      <header className="custom-top">
        <a href="/kiosk">← 상품 주문으로</a>
        <span>正 정일품</span>
      </header>
      <section className="custom-hero">
        <small>CUSTOM ORDER</small>
        <h1>맞춤 주문</h1>
        <p>어떤 종류로 준비해드릴까요?</p>
      </section>
      <form className="custom-form" onSubmit={complete} noValidate>
        <section>
          <h2><span>1</span> 카테고리</h2>
          <div className="choice-grid">
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                className={draft.category === category ? "selected" : ""}
                onClick={() => set("category", category)}
              >
                {category}
              </button>
            ))}
          </div>
          {errors.category && <span className="field-error" role="alert">{errors.category}</span>}
        </section>

        <section>
          <h2><span>2</span> 예산</h2>
          <div className="choice-grid three">
            {budgetOptions.map((option) => (
              <button
                type="button"
                key={option.label}
                className={draft.budgetOption === option.label ? "selected" : ""}
                onClick={() => set("budgetOption", option.label)}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              className={draft.budgetOption === "금액 직접 입력" ? "selected" : ""}
              onClick={() => set("budgetOption", "금액 직접 입력")}
            >
              금액 직접 입력
            </button>
          </div>
          {draft.budgetOption === "금액 직접 입력" && (
            <label className="custom-wide">
              <span>직접 입력 금액</span>
              <input
                type="number"
                min="200000"
                step="10000"
                inputMode="numeric"
                value={draft.directAmount}
                aria-invalid={Boolean(errors.budget)}
                onChange={(event) => set("directAmount", event.target.value)}
                placeholder="200000"
              />
            </label>
          )}
          {errors.budget && <span className="field-error" role="alert">{errors.budget}</span>}
        </section>

        <section>
          <h2><span>3</span> 요청사항 <small>(선택)</small></h2>
          <div className="custom-fields two">
            <label><span>원하는 구성</span><input value={draft.desiredComposition} onChange={(event) => set("desiredComposition", event.target.value)} /></label>
            <label><span>선호 부위</span><input value={draft.preferredCut} onChange={(event) => set("preferredCut", event.target.value)} /></label>
            <label><span>지방 정도</span><input value={draft.fatPreference} onChange={(event) => set("fatPreference", event.target.value)} /></label>
            <label><span>포장/구성 요청</span><input value={draft.packagingRequest} onChange={(event) => set("packagingRequest", event.target.value)} /></label>
          </div>
          <label className="custom-wide">
            <span>기타 요청사항</span>
            <textarea value={draft.otherRequest} onChange={(event) => set("otherRequest", event.target.value)} />
          </label>
        </section>

        <p className="custom-safe">요청하신 내용을 확인한 후 직원이 최종 구성을 확정합니다.</p>
        <button type="submit" className="custom-submit">
          완료 <span>→</span>
        </button>
      </form>
    </main>
  );
}

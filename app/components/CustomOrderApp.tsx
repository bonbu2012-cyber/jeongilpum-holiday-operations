"use client";

import { useEffect, useState } from "react";
import { FormattedInput } from "../ui";
import { parseIntegerInput } from "../lib/input-format";
import type { OrderDraft } from "./types";
import { MoneyReadout } from "./MoneyInput";

type Draft = {
  productName: string;
  amount: string;
  request: string;
};

const initialDraft: Draft = {
  productName: "",
  amount: "",
  request: "",
};

const customStorageKey = "jeongilpum-custom-order-draft";
const kioskStorageKey = "jeongilpum-kiosk-draft";

type StoredCustomOrder = {
  productName?: unknown;
  amount?: unknown;
  request?: unknown;
  budgetOption?: unknown;
  budgetAmount?: unknown;
  directAmount?: unknown;
};

function normalizeDraft(value: unknown): Draft {
  if (!value || typeof value !== "object") return initialDraft;
  const item = value as StoredCustomOrder;
  const legacyOption = typeof item.budgetOption === "string" ? item.budgetOption : "";
  const legacyPreset = legacyOption.match(/^(\d+)만원/)?.[1];
  const legacyAmount = Number(item.directAmount ?? 0) || (legacyPreset ? Number(legacyPreset) * 10_000 : 0);
  const amount = Number(item.amount ?? item.budgetAmount ?? legacyAmount);
  return {
    productName: typeof item.productName === "string" ? item.productName : legacyOption || item.budgetAmount ? "맞춤주문" : "",
    amount: Number.isFinite(amount) && amount > 0 ? String(amount) : "",
    request: typeof item.request === "string" ? item.request : "",
  };
}

export default function CustomOrderApp() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<{ productName?: string; amount?: string }>({});

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = sessionStorage.getItem(customStorageKey);
      if (saved) {
        try {
          setDraft(normalizeDraft(JSON.parse(saved)));
        } catch {
          sessionStorage.removeItem(customStorageKey);
        }
      } else {
        const kioskSaved = sessionStorage.getItem(kioskStorageKey);
        if (kioskSaved) {
          try {
            const customItem = (JSON.parse(kioskSaved) as { customItem?: unknown }).customItem;
            if (customItem) {
              setDraft(normalizeDraft(customItem));
            }
          } catch {
            setDraft(initialDraft);
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
    if (key === "productName" || key === "amount") setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const complete = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseIntegerInput(draft.amount) ?? 0;
    const nextErrors: typeof errors = {};
    if (!draft.productName.trim()) nextErrors.productName = "품명을 입력해주세요.";
    if (!Number.isInteger(amount) || amount <= 0) nextErrors.amount = "금액을 1원 이상 입력해주세요.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

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
      productName: draft.productName.trim(),
      amount,
      request: draft.request.trim(),
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
        <p>품명과 금액, 필요한 요청사항을 직접 입력해주세요.</p>
      </section>
      <form className="custom-form" onSubmit={complete} noValidate>
        <section>
          <h2><span>1</span> 품명</h2>
          <label className="custom-wide" htmlFor="custom-order-product-name">
            <span>품명</span>
            <input
              id="custom-order-product-name"
              value={draft.productName}
              aria-invalid={Boolean(errors.productName)}
              onChange={(event) => set("productName", event.target.value)}
              placeholder="예: 한우 맞춤 선물세트"
            />
          </label>
          {errors.productName && <span className="field-error" role="alert">{errors.productName}</span>}
        </section>

        <section>
          <h2><span>2</span> 금액</h2>
          <label className="custom-wide" htmlFor="custom-order-amount">
            <span>금액</span>
            <FormattedInput
              id="custom-order-amount"
              format="number"
              value={draft.amount}
              aria-invalid={Boolean(errors.amount)}
              onValueChange={(value) => set("amount", value)}
              placeholder="금액을 입력해주세요"
            />
            <MoneyReadout value={draft.amount} />
          </label>
          {errors.amount && <span className="field-error" role="alert">{errors.amount}</span>}
        </section>

        <section>
          <h2><span>3</span> 요청사항 <small>(선택)</small></h2>
          <label className="custom-wide">
            <span>요청사항</span>
            <textarea
              value={draft.request}
              onChange={(event) => set("request", event.target.value)}
              placeholder="구성, 부위, 포장 등 필요한 내용을 입력해주세요"
            />
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

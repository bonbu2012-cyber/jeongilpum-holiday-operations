"use client";

import { useEffect, useState } from "react";
import { formatKoreanPhoneInput, isPastPickupTime, parseIntegerInput } from "../lib/input-format";
import type { OrderDraft, OrderRecord, SeasonSchedule } from "./types";
import { MoneyInput } from "./MoneyInput";
import "../kiosk-flow.css";

type PostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  autoJibunAddress: string;
  bname: string;
  buildingName: string;
  apartment: string;
};

type KakaoWindow = Window & {
  kakao?: {
    Postcode: new (options: {
      oncomplete: (data: PostcodeData) => void;
      onclose?: () => void;
    }) => { open: () => void };
  };
};

function loadPostcode(onComplete: (data: PostcodeData) => void, onError: () => void) {
  const kakaoWindow = window as KakaoWindow;
  const start = () => {
    if (!kakaoWindow.kakao?.Postcode) {
      onError();
      return;
    }
    new kakaoWindow.kakao.Postcode({ oncomplete: onComplete }).open();
  };
  if (kakaoWindow.kakao?.Postcode) {
    start();
    return;
  }
  const existing = document.getElementById("kakao-postcode-script") as HTMLScriptElement | null;
  if (existing) {
    existing.addEventListener("load", start, { once: true });
    existing.addEventListener("error", onError, { once: true });
    return;
  }
  const script = document.createElement("script");
  script.id = "kakao-postcode-script";
  script.src = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
  script.async = true;
  script.addEventListener("load", start, { once: true });
  script.addEventListener("error", onError, { once: true });
  document.head.appendChild(script);
}

const customStorageKey = "jeongilpum-custom-order-draft";
const kioskStorageKey = "jeongilpum-kiosk-draft";

const pickupTimes = Array.from({ length: 27 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function parseIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function koreanDate(value: string) {
  if (!value) return "";
  const date = parseIso(value);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 (${weekdays[date.getUTCDay()]})`;
}

function Calendar({
  value,
  minDate,
  maxDate,
  onSelect,
}: {
  value: string;
  minDate: string;
  maxDate: string;
  onSelect: (value: string) => void;
}) {
  const [browsingMonth, setBrowsingMonth] = useState<string | null>(null);
  const today = todayInSeoul();
  const month = browsingMonth ?? (value || minDate || today).slice(0, 7);

  if (!minDate || !maxDate || minDate > maxDate) {
    return <div className="schedule-unavailable">현재 선택 가능한 예약 날짜가 없습니다.</div>;
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leading = first.getUTCDay();
  const cells = [...Array.from({ length: leading }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];

  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  const next = new Date(Date.UTC(year, monthNumber, 1));
  const previousMonth = isoFromDate(previous).slice(0, 7);
  const nextMonth = isoFromDate(next).slice(0, 7);
  const minMonth = minDate.slice(0, 7);
  const maxMonth = maxDate.slice(0, 7);

  return (
    <section className="schedule-calendar" aria-label="예약 날짜 달력">
      <header>
        <button
          type="button"
          onClick={() => setBrowsingMonth(previousMonth)}
          disabled={month <= minMonth}
          aria-label="이전 달"
        >
          ←
        </button>
        <b>{year}년 {monthNumber}월</b>
        <button
          type="button"
          onClick={() => setBrowsingMonth(nextMonth)}
          disabled={month >= maxMonth}
          aria-label="다음 달"
        >
          →
        </button>
      </header>
      <div className="calendar-weekdays">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} />;
          const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const disabled = date < minDate || date > maxDate;
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              className={[
                date === today ? "today" : "",
                value === date ? "selected" : "",
                disabled ? "closed" : "",
              ].filter(Boolean).join(" ")}
              aria-pressed={value === date}
              onClick={() => {
                setBrowsingMonth(null);
                onSelect(date);
              }}
            >
              <span>{day}</span>
              {date === today && <small>오늘</small>}
              {value === date && <small>✓ 선택</small>}
              {disabled && date >= minDate && date <= maxDate ? <small>예약마감</small> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

type StoredCustomOrder = {
  productName?: unknown;
  amount?: unknown;
  request?: unknown;
  budgetOption?: unknown;
  budgetAmount?: unknown;
  directAmount?: unknown;
};

function normalizeDraft(value: unknown) {
  if (!value || typeof value !== "object") return { productName: "", amount: "", request: "" };
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

function getInitialDraft() {
  if (typeof window === "undefined") return { productName: "", amount: "", request: "" };
  try {
    const saved = sessionStorage.getItem(customStorageKey);
    if (saved) return normalizeDraft(JSON.parse(saved));
    const kioskSaved = sessionStorage.getItem(kioskStorageKey);
    if (kioskSaved) {
      const customItem = (JSON.parse(kioskSaved) as { customItem?: unknown }).customItem;
      if (customItem) return normalizeDraft(customItem);
    }
  } catch {
    // ignore
  }
  return { productName: "", amount: "", request: "" };
}

export default function CustomOrderApp() {
  const [initial] = useState(getInitialDraft);
  const [productName, setProductName] = useState(initial.productName);
  const [amount, setAmount] = useState(initial.amount);
  const [request, setRequest] = useState(initial.request);

  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "shipping">("pickup");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [shipDate, setShipDate] = useState("");

  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [roadAddr, setRoadAddr] = useState("");
  const [roadAddrReference, setRoadAddrReference] = useState("");
  const [jibunAddr, setJibunAddr] = useState("");
  const [detailAddr, setDetailAddr] = useState("");
  const [addressMode, setAddressMode] = useState<"search" | "manual">("search");
  const [postcodeError, setPostcodeError] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "bank_transfer" | "later">("card");

  const [season, setSeason] = useState<SeasonSchedule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completed, setCompleted] = useState<OrderRecord | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ activeSeason?: SeasonSchedule | null }>)
      .then((data) => {
        if (data.activeSeason) {
          setSeason(data.activeSeason);
          const today = todayInSeoul();
          const minDate = data.activeSeason.salesStartDate > today ? data.activeSeason.salesStartDate : today;
          setPickupDate((prev) => prev || minDate);
          setShipDate((prev) => prev || minDate);
        }
      })
      .catch(() => undefined);
  }, []);

  const today = todayInSeoul();
  const minScheduleDate = season ? (season.salesStartDate > today ? season.salesStartDate : today) : today;
  const maxScheduleDate = season?.salesEndDate ?? "";

  const parsedAmount = parseIntegerInput(amount) ?? 0;

  const searchAddress = () => {
    setPostcodeError("");
    loadPostcode(
      (data) => {
        const references: string[] = [];
        if (data.bname && /[동로가]$/.test(data.bname)) references.push(data.bname);
        if (data.buildingName && data.apartment === "Y") references.push(data.buildingName);
        setAddressMode("search");
        setPostalCode(data.zonecode);
        setRoadAddr(data.roadAddress || data.jibunAddress);
        setRoadAddrReference(references.join(", "));
        setJibunAddr(data.jibunAddress || data.autoJibunAddress || "");
        setPostcodeError("");
      },
      () => setPostcodeError("주소검색을 불러오지 못했습니다. '주소 직접 입력'을 이용해주세요."),
    );
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!productName.trim()) nextErrors.productName = "품명을 입력해주세요.";
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) nextErrors.amount = "금액을 1원 이상 입력해주세요.";
    if (!buyerName.trim()) nextErrors.buyerName = "주문자 성함 또는 회사명을 입력해주세요.";
    if (buyerPhone.replace(/\D/g, "").length < 10) nextErrors.buyerPhone = "연락처를 숫자 10자리 이상 입력해주세요.";

    if (fulfillmentType === "pickup") {
      if (!pickupDate) nextErrors.pickupDate = "방문 날짜를 선택해주세요.";
      if (!pickupTime) nextErrors.pickupTime = "방문 시간을 선택해주세요.";
      else if (isPastPickupTime(pickupDate, pickupTime, now)) nextErrors.pickupTime = "선택한 시간이 이미 지났습니다.";
    } else {
      if (!shipDate) nextErrors.shipDate = "발송일을 선택해주세요.";
      if (!recipientName.trim()) nextErrors.recipientName = "받는 분 성함을 입력해주세요.";
      if (recipientPhone.replace(/\D/g, "").length < 10) nextErrors.recipientPhone = "받는 분 연락처를 10자리 이상 입력해주세요.";
      if (postalCode.replace(/\D/g, "").length !== 5) nextErrors.postalCode = "우편번호 5자리를 확인해주세요.";
      if (!roadAddr.trim()) nextErrors.roadAddr = "기본 주소를 입력해주세요.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleOneStopSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!validateForm()) {
      setSubmitError("입력하신 항목에 누락되거나 잘못된 내용이 있습니다. 확인 후 다시 시도해주세요.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const isPaid = paymentMethod !== "later";
    const paymentStatus = isPaid ? "paid" : "unpaid";
    const paidAmount = isPaid ? parsedAmount : 0;

    const payload = {
      idempotencyKey: crypto.randomUUID(),
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.replace(/\D/g, ""),
      fulfillmentType,
      paymentMethod,
      paymentStatus,
      paidAmount,
      pickupDate: fulfillmentType === "pickup" ? pickupDate : undefined,
      pickupTime: fulfillmentType === "pickup" ? pickupTime : undefined,
      shipDate: fulfillmentType === "shipping" ? shipDate : undefined,
      recipientName: fulfillmentType === "shipping" ? recipientName.trim() : undefined,
      recipientPhone: fulfillmentType === "shipping" ? recipientPhone.replace(/\D/g, "") : undefined,
      postalCode: fulfillmentType === "shipping" ? postalCode : undefined,
      roadAddr: fulfillmentType === "shipping" ? roadAddr : undefined,
      roadAddrReference: fulfillmentType === "shipping" ? roadAddrReference : undefined,
      jibunAddr: fulfillmentType === "shipping" ? jibunAddr : undefined,
      detailAddr: fulfillmentType === "shipping" ? detailAddr : undefined,
      note: request.trim(),
      items: [],
      customItem: {
        productName: productName.trim(),
        amount: parsedAmount,
        request: request.trim(),
      },
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { order?: OrderRecord; error?: string };
      if (!response.ok || !data.order) {
        throw new Error(data.error || "주문을 접수하지 못했습니다.");
      }
      setCompleted(data.order);
      sessionStorage.removeItem(customStorageKey);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "주문 접수 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveToCart = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!productName.trim() || parsedAmount <= 0) {
      setErrors({
        productName: !productName.trim() ? "품명을 입력해주세요." : "",
        amount: parsedAmount <= 0 ? "금액을 1원 이상 입력해주세요." : "",
      });
      return;
    }

    let orderDraft: Partial<OrderDraft> = {};
    const saved = sessionStorage.getItem(kioskStorageKey);
    if (saved) {
      try {
        orderDraft = JSON.parse(saved) as Partial<OrderDraft>;
      } catch {
        orderDraft = {};
      }
    }
    const draft = { productName, amount, request };
    orderDraft.customItem = {
      productName: draft.productName.trim(),
      amount: parsedAmount,
      request: draft.request.trim(),
    };
    orderDraft.idempotencyKey = crypto.randomUUID();
    sessionStorage.setItem(kioskStorageKey, JSON.stringify(orderDraft));
    sessionStorage.setItem(customStorageKey, JSON.stringify(draft));
    window.location.assign("/kiosk?resume=cart");
  };

  if (completed) {
    const isPaid = paymentMethod !== "later";
    return (
      <main className="custom-order-page">
        <header className="custom-top">
          <a href="/kiosk">← 키오스크 홈으로</a>
          <span>正 정일품 정육식당</span>
        </header>
        <section className="custom-complete">
          <div>✓</div>
          <small>CUSTOM ORDER COMPLETE</small>
          <h1>맞춤 주문이 정상 접수되었습니다</h1>
          <p>
            주문 내역이 작업장 및 판매장 운영 시스템에 즉시 등록되었습니다.<br />
            정일품이 정성을 다해 준비하겠습니다.
          </p>
          <dl style={{ flexDirection: "column", gap: "10px", margin: "24px 0", textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: "13px" }}>주문번호</span>
              <b style={{ fontSize: "16px", color: "var(--wine)" }}>{completed.orderNo}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: "13px" }}>품명 / 금액</span>
              <b>{productName} · {parsedAmount.toLocaleString("ko-KR")}원</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: "13px" }}>수령 방식 및 일정</span>
              <b>{completed.scheduleLabel || (fulfillmentType === "pickup" ? `${koreanDate(pickupDate)} ${pickupTime} 방문` : `${koreanDate(shipDate)} 택배발송`)}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: "13px" }}>결제 상태</span>
              <b style={{ color: isPaid ? "#1e7e34" : "#d97706" }}>
                {isPaid ? `결제완료 (${parsedAmount.toLocaleString("ko-KR")}원 전액 수납)` : "미결제 (수령 시 결제)"}
              </b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: "13px" }}>주문자 정보</span>
              <span>{buyerName} ({formatKoreanPhoneInput(buyerPhone)})</span>
            </div>
            {request && (
              <div style={{ marginTop: "6px", paddingTop: "8px", borderTop: "1px dashed #d5cdbf" }}>
                <span style={{ color: "var(--muted)", fontSize: "12px", display: "block" }}>요청사항</span>
                <span style={{ fontSize: "13px" }}>{request}</span>
              </div>
            )}
          </dl>
          <button
            type="button"
            onClick={() => {
              setCompleted(null);
              setProductName("");
              setAmount("");
              setRequest("");
            }}
          >
            새 맞춤주문 접수하기
          </button>
          <a href="/kiosk" style={{ display: "block", marginTop: "14px", fontWeight: "700" }}>
            ← 일반 상품 키오스크로 돌아가기
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="custom-order-page">
      <header className="custom-top">
        <a href="/kiosk">← 상품 목록으로</a>
        <span style={{ fontWeight: 800, fontSize: "17px", color: "var(--wine)" }}>正 정일품 정육식당</span>
      </header>

      <section className="custom-hero">
        <small>ONE-STOP CUSTOM ORDER</small>
        <h1>맞춤 주문 접수</h1>
        <p>
          원하시는 품명과 금액, 수령 일정 및 주문자 정보를 입력하시면 바로 예약이 접수됩니다.<br />
          결제수단을 선택하시면 수령일과 관계없이 즉시 결제완료 상태로 등록됩니다.
        </p>
      </section>

      <form className="custom-form" onSubmit={handleOneStopSubmit} noValidate>
        {/* 1. 품명 */}
        <section>
          <h2><span>1</span> 품명</h2>
          <label className="custom-wide" htmlFor="custom-order-product-name">
            <span>품명 <b style={{ color: "var(--wine)" }}>*</b></span>
            <input
              id="custom-order-product-name"
              value={productName}
              aria-invalid={Boolean(errors.productName)}
              onChange={(event) => {
                setProductName(event.target.value);
                if (errors.productName) setErrors((prev) => ({ ...prev, productName: "" }));
              }}
              placeholder="예: 한우 맞춤 선물세트, 특수부위 모듬 등"
            />
          </label>
          {errors.productName && <span className="field-error" role="alert" style={{ color: "#b9362e", fontSize: "12px" }}>{errors.productName}</span>}
        </section>

        {/* 2. 금액 */}
        <section>
          <h2><span>2</span> 금액</h2>
          <MoneyInput
            id="custom-order-amount"
            className="custom-wide"
            label={<span>주문 금액 <b style={{ color: "var(--wine)" }}>*</b></span>}
            value={amount}
            error={errors.amount}
            onValueChange={(value) => {
              setAmount(value);
              if (errors.amount) setErrors((prev) => ({ ...prev, amount: "" }));
            }}
            placeholder="금액을 입력해주세요 (예: 150,000)"
          />
        </section>

        {/* 3. 요청사항 */}
        <section>
          <h2><span>3</span> 요청사항 <small style={{ color: "var(--muted)", fontWeight: "normal", fontSize: "14px" }}>(선택)</small></h2>
          <label className="custom-wide">
            <span>요청사항</span>
            <textarea
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              placeholder="원하시는 부위 구성(등심, 안심, 갈비 등), 진공/보자기 포장 등 필요한 내용을 자유롭게 입력해주세요."
            />
          </label>
        </section>

        {/* 4. 수령 방식 선택 */}
        <section>
          <h2><span>4</span> 수령 방식 선택</h2>
          <div className="choice-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <button
              type="button"
              className={fulfillmentType === "pickup" ? "selected" : ""}
              onClick={() => setFulfillmentType("pickup")}
              style={{
                padding: "16px",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                height: "auto",
                minHeight: "72px",
              }}
            >
              <b style={{ fontSize: "17px" }}>방문수령</b>
              <small style={{ color: "var(--muted)", fontWeight: "normal" }}>매장에서 직접 픽업</small>
            </button>
            <button
              type="button"
              className={fulfillmentType === "shipping" ? "selected" : ""}
              onClick={() => setFulfillmentType("shipping")}
              style={{
                padding: "16px",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                height: "auto",
                minHeight: "72px",
              }}
            >
              <b style={{ fontSize: "17px" }}>택배발송</b>
              <small style={{ color: "var(--muted)", fontWeight: "normal" }}>원하는 주소로 배송</small>
            </button>
          </div>
        </section>

        {/* 5. 희망 일정 선택 */}
        <section>
          <h2>
            <span>5</span> {fulfillmentType === "pickup" ? "방문 날짜 및 시간 선택" : "택배 발송일 선택"}
          </h2>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 14px" }}>
            {fulfillmentType === "pickup"
              ? "매장에 방문하여 상품을 수령하실 날짜와 시간을 선택해주세요."
              : "선택하신 날짜에 맞춰 정일품에서 신선하게 포장하여 택배 발송합니다."}
          </p>

          <Calendar
            value={fulfillmentType === "pickup" ? pickupDate : shipDate}
            minDate={minScheduleDate}
            maxDate={maxScheduleDate}
            onSelect={(selectedDate) => {
              if (fulfillmentType === "pickup") {
                setPickupDate(selectedDate);
                if (errors.pickupDate) setErrors((prev) => ({ ...prev, pickupDate: "" }));
              } else {
                setShipDate(selectedDate);
                if (errors.shipDate) setErrors((prev) => ({ ...prev, shipDate: "" }));
              }
            }}
          />

          {fulfillmentType === "pickup" && (
            <div style={{ marginTop: "18px" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px" }}>
                방문 시간대 선택 <b style={{ color: "var(--wine)" }}>*</b>
              </div>
              <div className="pickup-time-grid">
                {pickupTimes.map((time) => {
                  const past = isPastPickupTime(pickupDate, time, now);
                  const isSelected = pickupTime === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      disabled={past}
                      className={`time-chip ${isSelected ? "selected" : ""} ${past ? "disabled" : ""}`}
                      onClick={() => {
                        setPickupTime(time);
                        if (errors.pickupTime) setErrors((prev) => ({ ...prev, pickupTime: "" }));
                      }}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
              {errors.pickupTime && (
                <div style={{ color: "#b9362e", fontSize: "12px", marginTop: "6px" }}>{errors.pickupTime}</div>
              )}
            </div>
          )}

          {fulfillmentType === "pickup" && errors.pickupDate && (
            <div style={{ color: "#b9362e", fontSize: "12px", marginTop: "6px" }}>{errors.pickupDate}</div>
          )}
          {fulfillmentType === "shipping" && errors.shipDate && (
            <div style={{ color: "#b9362e", fontSize: "12px", marginTop: "6px" }}>{errors.shipDate}</div>
          )}

          <div className="selected-schedule-banner">
            <span>선택된 일정:</span>
            <b>
              {fulfillmentType === "pickup"
                ? `${koreanDate(pickupDate)} ${pickupTime ? `· ${pickupTime}` : "(시간 미선택)"}`
                : `${koreanDate(shipDate)} 발송 예정`}
            </b>
          </div>
        </section>

        {/* 6. 주문자 및 배송 정보 */}
        <section>
          <h2><span>6</span> 주문자 정보 {fulfillmentType === "shipping" && "및 배송지"}</h2>
          <div className="custom-fields two">
            <label>
              <span>주문자명 / 회사명 <b style={{ color: "var(--wine)" }}>*</b></span>
              <input
                value={buyerName}
                aria-invalid={Boolean(errors.buyerName)}
                onChange={(e) => {
                  setBuyerName(e.target.value);
                  if (errors.buyerName) setErrors((prev) => ({ ...prev, buyerName: "" }));
                }}
                placeholder="성함 또는 상호명"
              />
              {errors.buyerName && <span style={{ color: "#b9362e", fontSize: "11px" }}>{errors.buyerName}</span>}
            </label>
            <label>
              <span>주문자 연락처 <b style={{ color: "var(--wine)" }}>*</b></span>
              <input
                type="tel"
                value={formatKoreanPhoneInput(buyerPhone)}
                aria-invalid={Boolean(errors.buyerPhone)}
                onChange={(e) => {
                  setBuyerPhone(e.target.value);
                  if (errors.buyerPhone) setErrors((prev) => ({ ...prev, buyerPhone: "" }));
                }}
                placeholder="010-0000-0000"
              />
              {errors.buyerPhone && <span style={{ color: "#b9362e", fontSize: "11px" }}>{errors.buyerPhone}</span>}
            </label>
          </div>

          {fulfillmentType === "shipping" && (
            <div style={{ marginTop: "20px", borderTop: "1px dashed #e0d8cc", paddingTop: "18px" }}>
              <div style={{ fontSize: "14px", fontWeight: "800", marginBottom: "12px" }}>택배 받으실 분 정보</div>
              <div className="custom-fields two" style={{ marginBottom: "14px" }}>
                <label>
                  <span>받는 분 성함 <b style={{ color: "var(--wine)" }}>*</b></span>
                  <input
                    value={recipientName}
                    aria-invalid={Boolean(errors.recipientName)}
                    onChange={(e) => {
                      setRecipientName(e.target.value);
                      if (errors.recipientName) setErrors((prev) => ({ ...prev, recipientName: "" }));
                    }}
                    placeholder="받는 분 성함"
                  />
                  {errors.recipientName && <span style={{ color: "#b9362e", fontSize: "11px" }}>{errors.recipientName}</span>}
                </label>
                <label>
                  <span>받는 분 연락처 <b style={{ color: "var(--wine)" }}>*</b></span>
                  <input
                    type="tel"
                    value={formatKoreanPhoneInput(recipientPhone)}
                    aria-invalid={Boolean(errors.recipientPhone)}
                    onChange={(e) => {
                      setRecipientPhone(e.target.value);
                      if (errors.recipientPhone) setErrors((prev) => ({ ...prev, recipientPhone: "" }));
                    }}
                    placeholder="010-0000-0000"
                  />
                  {errors.recipientPhone && <span style={{ color: "#b9362e", fontSize: "11px" }}>{errors.recipientPhone}</span>}
                </label>
              </div>

              {addressMode === "search" ? (
                <>
                  <button type="button" className="postcode-search-button" onClick={searchAddress}>
                    도로명주소 검색
                  </button>
                  {roadAddr && (
                    <article className="address-result-card">
                      <small>선택된 기본 주소</small>
                      <b>[{postalCode}] {roadAddr}</b>
                      {jibunAddr && <span>지번: {jibunAddr}</span>}
                      {roadAddrReference && <span>참고: {roadAddrReference}</span>}
                    </article>
                  )}
                  <button type="button" className="direct-address-button" onClick={() => setAddressMode("manual")}>
                    주소 직접 입력하기
                  </button>
                </>
              ) : (
                <div style={{ display: "grid", gap: "10px", marginBottom: "14px" }}>
                  <div className="manual-address-notice">직접 입력 모드입니다. 우편번호와 도로명 주소를 정확히 입력해주세요.</div>
                  <input
                    placeholder="우편번호 5자리"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  />
                  <input
                    placeholder="도로명 또는 지번 기본주소"
                    value={roadAddr}
                    onChange={(e) => setRoadAddr(e.target.value)}
                  />
                  <button type="button" className="direct-address-button" onClick={() => setAddressMode("search")}>
                    주소검색으로 돌아가기
                  </button>
                </div>
              )}

              {postcodeError && <div className="address-error">{postcodeError}</div>}

              <label className="custom-wide" style={{ marginTop: "10px" }}>
                <span>상세 주소 (동·호수, 선택)</span>
                <input
                  placeholder="예: 101동 1202호 또는 상세 위치 (선택 사항)"
                  value={detailAddr}
                  aria-invalid={Boolean(errors.detailAddr)}
                  onChange={(e) => {
                    setDetailAddr(e.target.value);
                    if (errors.detailAddr) setErrors((prev) => ({ ...prev, detailAddr: "" }));
                  }}
                />
                {errors.detailAddr && <span style={{ color: "#b9362e", fontSize: "11px" }}>{errors.detailAddr}</span>}
              </label>
            </div>
          )}
        </section>

        {/* 7. 결제 방식 선택 */}
        <section>
          <h2><span>7</span> 결제 방식 선택</h2>
          <div className="payment-method-options" style={{ margin: "14px 0" }}>
            {[
              { value: "card" as const, label: "카드 결제", desc: "카드 결제 완료 처리" },
              { value: "cash" as const, label: "현금 수납", desc: "현금 수납 완료 처리" },
              { value: "bank_transfer" as const, label: "계좌이체", desc: "입금 확인 완료 처리" },
              { value: "later" as const, label: "나중에 결정", desc: "수령 시 결제 (미수)" },
            ].map((method) => (
              <button
                key={method.value}
                type="button"
                className={paymentMethod === method.value ? "selected" : ""}
                onClick={() => setPaymentMethod(method.value)}
              >
                <b>{method.label}</b>
                <small>{method.desc}</small>
              </button>
            ))}
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: paymentMethod !== "later" ? "#f0fdf4" : "#fffbeb",
              border: `1px solid ${paymentMethod !== "later" ? "#bbf7d0" : "#fef3c7"}`,
              color: paymentMethod !== "later" ? "#166534" : "#92400e",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {paymentMethod !== "later"
              ? "✓ 카드 / 현금 / 계좌이체 선택 시 수령일과 상관없이 즉시 '결제완료(paid)'로 등록됩니다."
              : "○ '나중에 결정' 선택 시 수령 당일 결제하는 '미결제' 주문으로 접수됩니다."}
          </div>
        </section>

        {submitError && (
          <div className="custom-error" role="alert">
            <b>접수 오류:</b> {submitError}
          </div>
        )}

        <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
          <button type="submit" className="custom-submit" disabled={submitting}>
            <span>{submitting ? "주문을 접수하고 있습니다…" : "맞춤주문 바로 접수하기"}</span>
            <span>{submitting ? "…" : "→"}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToCart}
            style={{
              width: "100%",
              height: "52px",
              border: "1px solid #d4ccbf",
              borderRadius: "13px",
              background: "#fff",
              color: "#4d4942",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            일반 장바구니에 담아 다른 상품과 함께 주문하기
          </button>
        </div>

        <p className="custom-safe">
          정일품 운영 원칙에 따라 결제 및 주문 내역은 데이터베이스에 안전하게 보관됩니다.
        </p>
      </form>
    </main>
  );
}

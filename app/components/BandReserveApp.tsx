"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Sale = {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  productionLimit: number;
  reservedQty: number;
  remainingQty: number;
  depositPerUnit: number;
  reservationStartAt: string;
  reservationEndAt: string;
  productionLockAt: string;
  pickupDate: string;
  pickupStart: string;
  pickupEnd: string;
  pickupLocation: string;
  state: "upcoming" | "open" | "closed" | "sold_out";
};

type ReservationReceipt = {
  reservationNo: string;
  customerName: string;
  quantity: number;
  totalAmount: number;
  depositAmount: number;
  pickupWindow: string;
  pickupDate: string;
  pickupStart: string;
  pickupEnd: string;
  pickupLocation: string;
};

const pickupWindows = [
  "10:00~12:00",
  "12:00~14:00",
  "14:00~16:00",
  "16:00~18:00",
  "18:00 이후",
  "아직 모름",
];

const won = (value: number) => new Intl.NumberFormat("ko-KR").format(value) + "원";

function kst(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function BandReserveApp() {
  const [sale, setSale] = useState<Sale | null>(null);
  const [paymentMode, setPaymentMode] = useState("test");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupWindow, setPickupWindow] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReservationReceipt | null>(null);
  const requestIdRef = useRef("");

  const loadSale = async () => {
    try {
      const response = await fetch("/api/band-sales", { cache: "no-store" });
      const data = await response.json() as { sale?: Sale | null; paymentMode?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "판매정보를 불러오지 못했습니다.");
      setSale(data.sale ?? null);
      setPaymentMode(data.paymentMode || "test");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "판매정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/band-sales", { cache: "no-store" })
      .then(async (response) => ({
        response,
        data: await response.json() as { sale?: Sale | null; paymentMode?: string; error?: string },
      }))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || "판매정보를 불러오지 못했습니다.");
        if (cancelled) return;
        setSale(data.sale ?? null);
        setPaymentMode(data.paymentMode || "test");
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "판매정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const deposit = useMemo(() => (sale?.depositPerUnit ?? 0) * quantity, [sale, quantity]);
  const total = useMemo(() => (sale?.price ?? 0) * quantity, [sale, quantity]);
  const balance = Math.max(0, total - deposit);
  const canSubmit = Boolean(
    sale?.state === "open"
      && quantity >= 1
      && quantity <= sale.remainingQty
      && name.trim().length >= 2
      && phone.replace(/\D/g, "").length >= 10
      && pickupWindow
      && agreed
      && !submitting,
  );

  const submit = async () => {
    if (!sale || !canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const requestKey = requestIdRef.current || crypto.randomUUID();
      requestIdRef.current = requestKey;
      const response = await fetch("/api/band-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id,
          customerName: name,
          customerPhone: phone,
          quantity,
          pickupWindow,
          policyAgreed: agreed,
          idempotencyKey: requestKey,
        }),
      });
      const data = await response.json() as { reservation?: ReservationReceipt; error?: string };
      if (!response.ok || !data.reservation) throw new Error(data.error || "예약을 완료하지 못했습니다.");
      setReceipt(data.reservation);
      await loadSale();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "예약을 완료하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main className="band-public"><section className="band-card"><p>예약 정보를 불러오는 중입니다…</p></section></main>;

  if (receipt) {
    return <main className="band-public">
      <section className="band-hero band-success">
        <span className="band-eyebrow">JEONGILPUM BAND</span>
        <h1>예약이 완료되었습니다</h1>
        <p>예약번호 <strong>{receipt.reservationNo}</strong></p>
      </section>
      <section className="band-card receipt-grid">
        <div><span>예약자</span><strong>{receipt.customerName}</strong></div>
        <div><span>수량</span><strong>{receipt.quantity}개</strong></div>
        <div><span>상품금액</span><strong>{won(receipt.totalAmount)}</strong></div>
        <div><span>예약금</span><strong>{won(receipt.depositAmount)}</strong></div>
        <div><span>수령 시 잔액</span><strong>{won(receipt.totalAmount - receipt.depositAmount)}</strong></div>
        <div><span>예상 픽업시간</span><strong>{receipt.pickupWindow}</strong></div>
      </section>
      <section className="band-card">
        <h2>픽업 안내</h2>
        <p><strong>{receipt.pickupDate}</strong> {receipt.pickupStart}~{receipt.pickupEnd}</p>
        <p>{receipt.pickupLocation || "픽업장소는 BAND 공지를 확인해주세요."}</p>
        {paymentMode === "test" && <div className="band-test-note">MVP 테스트 모드입니다. 실제 예약금 결제는 발생하지 않았습니다.</div>}
      </section>
    </main>;
  }

  return <main className="band-public">
    <section className="band-hero">
      <span className="band-eyebrow">정일품 정육식당 · BAND 전용</span>
      <h1>{sale?.title || "현재 예약 가능한 상품이 없습니다"}</h1>
      {sale?.subtitle && <p>{sale.subtitle}</p>}
    </section>

    {error && <div className="band-alert" role="alert">{error}</div>}

    {!sale ? <section className="band-card"><p>BAND의 다음 판매 공지를 확인해주세요.</p></section> : <>
      <section className="band-card product-card">
        <div>
          <span className="band-label">판매가</span>
          <strong className="band-price">{won(sale.price)}</strong>
        </div>
        <div className="band-stock">
          <span>예약 가능</span>
          <strong>{sale.remainingQty}개</strong>
        </div>
        <dl>
          <div><dt>예약 시작</dt><dd>{kst(sale.reservationStartAt)}</dd></div>
          <div><dt>예약 마감</dt><dd>{kst(sale.reservationEndAt)}</dd></div>
          <div><dt>픽업일</dt><dd>{sale.pickupDate} · {sale.pickupStart}~{sale.pickupEnd}</dd></div>
        </dl>
        {sale.state !== "open" && <div className="band-state">
          {sale.state === "upcoming" ? "아직 예약 시작 전입니다." : sale.state === "sold_out" ? "최대 생산수량까지 예약되어 마감되었습니다." : "이번 회차 예약이 마감되었습니다."}
        </div>}
      </section>

      <section className="band-card">
        <h2>수량 선택</h2>
        <div className="quantity-control">
          <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="수량 줄이기">−</button>
          <strong>{quantity}개</strong>
          <button type="button" onClick={() => setQuantity((value) => Math.min(Math.max(1, sale.remainingQty), value + 1))} aria-label="수량 늘리기">＋</button>
        </div>
        <div className="price-summary">
          <div><span>상품금액</span><strong>{won(total)}</strong></div>
          <div><span>예약금</span><strong>{won(deposit)}</strong></div>
          <div><span>수령 시 잔액</span><strong>{won(balance)}</strong></div>
        </div>
        {paymentMode === "test" && <div className="band-test-note">10월 MVP 테스트 기간에는 실제 예약금이 결제되지 않습니다. 11월 정식 출시 전 결제 흐름을 검증하는 화면입니다.</div>}
      </section>

      <section className="band-card band-form">
        <h2>예약자 정보</h2>
        <label><span>이름</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="예약자 성함" autoComplete="name" /></label>
        <label><span>휴대전화</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01012345678" inputMode="tel" autoComplete="tel" /></label>
        <label><span>예상 픽업시간</span>
          <select value={pickupWindow} onChange={(event) => setPickupWindow(event.target.value)}>
            <option value="">선택해주세요</option>
            {pickupWindows.map((window) => <option key={window}>{window}</option>)}
          </select>
        </label>
        <p className="band-help">예상 방문시간을 파악하기 위한 항목입니다. 선택한 시간을 반드시 지킬 필요는 없습니다.</p>
      </section>

      <section className="band-card band-policy">
        <h2>예약금 및 취소 안내</h2>
        <ul>
          <li>예약금은 상품 1개당 {won(sale.depositPerUnit)}이며 수령 시 상품금액에서 차감됩니다.</li>
          <li>생산 확정 전 취소 시 예약금은 환불 대상입니다.</li>
          <li><strong>생산 확정 이후, 수령 당일 취소 및 노쇼는 예약금이 환불되지 않습니다.</strong></li>
          <li>정일품 사정으로 상품 제공이 불가능한 경우 예약금은 전액 환불합니다.</li>
        </ul>
        <label className="policy-check">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          <span>위 예약·취소·환불 정책을 확인하고 동의합니다.</span>
        </label>
      </section>

      <button className="band-primary sticky-submit" type="button" disabled={!canSubmit} onClick={() => void submit()}>
        {submitting ? "예약 처리 중…" : paymentMode === "test" ? "MVP 테스트 예약 · " + won(deposit) : "예약금 결제 · " + won(deposit)}
      </button>
    </>}
  </main>;
}

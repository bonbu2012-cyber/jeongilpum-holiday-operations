"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; price: number; daily_limit: number | null; active: boolean };
type Sale = {
  id: string; product_id: string; title: string; price: number; production_limit: number; reserved_qty: number;
  deposit_per_unit: number; reservation_start_at: string; reservation_end_at: string; production_lock_at: string;
  pickup_date: string; pickup_start: string; pickup_end: string; pickup_location: string; status: string; active: boolean; state: string;
};
type Reservation = {
  id: string; reservation_no: string; customer_name: string; customer_phone: string; quantity: number;
  total_amount: number; deposit_amount: number; pickup_window: string; status: string; payment_status: string; created_at: string;
  sale?: { id: string; title: string; pickup_date: string; production_lock_at: string } | null;
};
type Customer = {
  phone: string; name: string; reservationCount: number; pickupCount: number; cancelCount: number; noShowCount: number;
  purchaseQty: number; purchaseAmount: number; pickupRate: number; label: string; lastReservationAt: string;
};

type AdminSalesResponse = { sales?: Sale[]; products?: Product[]; paymentMode?: string; error?: string };
type AdminReservationsResponse = { reservations?: Reservation[]; error?: string };
type AdminCustomersResponse = { customers?: Customer[]; error?: string };
type ErrorResponse = { error?: string };

const won = (value: number) => new Intl.NumberFormat("ko-KR").format(value) + "원";
const dt = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const toKstIso = (value: string) => value ? new Date(value + ":00+09:00").toISOString() : "";

export default function BandAdminApp() {
  const [tab, setTab] = useState<"sale" | "reservations" | "customers">("sale");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMode, setPaymentMode] = useState("test");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [productId, setProductId] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(0);
  const [limit, setLimit] = useState(50);
  const [deposit, setDeposit] = useState(1000);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [lockAt, setLockAt] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupStart, setPickupStart] = useState("10:00");
  const [pickupEnd, setPickupEnd] = useState("19:00");
  const [pickupLocation, setPickupLocation] = useState("정일품 BAND 전용 작업장");

  const load = async () => {
    try {
      const [saleRes, reservationRes, customerRes] = await Promise.all([
        fetch("/api/band-sales?admin=1", { cache: "no-store" }),
        fetch("/api/band-reservations", { cache: "no-store" }),
        fetch("/api/band-customers", { cache: "no-store" }),
      ]);
      const saleData = await saleRes.json() as AdminSalesResponse;
      const reservationData = await reservationRes.json() as AdminReservationsResponse;
      const customerData = await customerRes.json() as AdminCustomersResponse;
      if (!saleRes.ok) throw new Error(saleData.error || "판매회차를 불러오지 못했습니다.");
      if (!reservationRes.ok) throw new Error(reservationData.error || "예약목록을 불러오지 못했습니다.");
      if (!customerRes.ok) throw new Error(customerData.error || "고객DB를 불러오지 못했습니다.");
      setProducts(saleData.products || []);
      setSales(saleData.sales || []);
      setPaymentMode(saleData.paymentMode || "test");
      setReservations(reservationData.reservations || []);
      setCustomers(customerData.customers || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "데이터를 불러오지 못했습니다.");
    }
  };

  useEffect(() => { void load(); }, []);

  const activeSale = useMemo(() => sales.find((sale) => sale.active) ?? null, [sales]);
  const activeReservations = useMemo(
    () => activeSale ? reservations.filter((reservation) => reservation.sale?.id === activeSale.id) : [],
    [activeSale, reservations],
  );
  const projectedRevenue = activeReservations
    .filter((reservation) => reservation.status !== "cancelled")
    .reduce((sum, reservation) => sum + reservation.total_amount, 0);

  const selectProduct = (id: string) => {
    setProductId(id);
    const product = products.find((item) => item.id === id);
    if (product) {
      setTitle(product.name);
      setPrice(product.price);
      setLimit(product.daily_limit || 50);
    }
  };

  const createSale = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/band-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId, title, price, productionLimit: limit, depositPerUnit: deposit,
          reservationStartAt: toKstIso(startAt), reservationEndAt: toKstIso(endAt), productionLockAt: toKstIso(lockAt),
          pickupDate, pickupStart, pickupEnd, pickupLocation,
        }),
      });
      const data = await response.json() as ErrorResponse;
      if (!response.ok) throw new Error(data.error || "판매회차를 만들지 못했습니다.");
      await load();
      setTab("reservations");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "판매회차를 만들지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const updateReservation = async (id: string, status: string) => {
    if (!confirm(status === "picked_up" ? "수령완료 처리할까요?" : status === "no_show" ? "노쇼로 기록할까요?" : "예약을 취소 처리할까요?")) return;
    const response = await fetch("/api/band-reservations/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json() as ErrorResponse;
    if (!response.ok) {
      setError(data.error || "예약상태를 변경하지 못했습니다.");
      return;
    }
    await load();
  };

  const closeSale = async (id: string) => {
    const response = await fetch("/api/band-sales", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "close" }),
    });
    const data = await response.json() as ErrorResponse;
    if (!response.ok) setError(data.error || "예약을 마감하지 못했습니다.");
    else await load();
  };

  const copyReserveLink = async () => {
    await navigator.clipboard.writeText(location.origin + "/band-reserve");
    alert("예약 링크를 복사했습니다.");
  };

  return <main className="band-admin">
    <header className="band-admin-head">
      <div><span className="band-eyebrow">JEONGILPUM BAND · MVP</span><h1>예약 운영</h1></div>
      <div className="admin-head-actions">
        <span className="mode-badge">{paymentMode === "test" ? "TEST PAYMENT" : paymentMode.toUpperCase()}</span>
        <button onClick={() => void copyReserveLink()}>예약링크 복사</button>
      </div>
    </header>

    <nav className="band-tabs">
      <button className={tab === "sale" ? "active" : ""} onClick={() => setTab("sale")}>판매회차</button>
      <button className={tab === "reservations" ? "active" : ""} onClick={() => setTab("reservations")}>예약 {reservations.length}</button>
      <button className={tab === "customers" ? "active" : ""} onClick={() => setTab("customers")}>고객DB {customers.length}</button>
    </nav>

    {error && <div className="band-alert" role="alert">{error}</div>}

    {activeSale && <section className="band-dashboard">
      <div><span>생산한도</span><strong>{activeSale.production_limit}</strong></div>
      <div><span>예약수량</span><strong>{activeSale.reserved_qty}</strong></div>
      <div><span>잔여</span><strong>{Math.max(0, activeSale.production_limit - activeSale.reserved_qty)}</strong></div>
      <div><span>예상매출</span><strong>{won(projectedRevenue)}</strong></div>
    </section>}

    {tab === "sale" && <section className="band-admin-grid">
      <div className="band-card">
        <h2>새 판매회차</h2>
        <div className="admin-form-grid">
          <label><span>상품</span><select value={productId} onChange={(event) => selectProduct(event.target.value)}><option value="">선택</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label><span>표시 상품명</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label><span>판매가</span><input type="number" value={price || ""} onChange={(event) => setPrice(Number(event.target.value))} /></label>
          <label><span>최대 생산수량</span><input type="number" value={limit} onChange={(event) => setLimit(Number(event.target.value))} /></label>
          <label><span>예약금 / 개</span><input type="number" value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} /></label>
          <label><span>예약 시작</span><input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /></label>
          <label><span>예약 마감</span><input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} /></label>
          <label><span>생산 확정</span><input type="datetime-local" value={lockAt} onChange={(event) => setLockAt(event.target.value)} /></label>
          <label><span>픽업일</span><input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} /></label>
          <label><span>픽업 시작</span><input type="time" value={pickupStart} onChange={(event) => setPickupStart(event.target.value)} /></label>
          <label><span>픽업 종료</span><input type="time" value={pickupEnd} onChange={(event) => setPickupEnd(event.target.value)} /></label>
          <label className="wide"><span>픽업장소</span><input value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} /></label>
        </div>
        <button className="band-primary" disabled={saving || !productId || !startAt || !endAt || !lockAt || !pickupDate} onClick={() => void createSale()}>
          {saving ? "생성 중…" : "판매회차 생성"}
        </button>
      </div>

      <div className="band-card">
        <h2>최근 판매회차</h2>
        <div className="admin-list">
          {sales.map((sale) => <article key={sale.id} className="admin-list-row">
            <div><strong>{sale.title}</strong><span>{sale.pickup_date} · {sale.reserved_qty}/{sale.production_limit}개</span></div>
            <div><span className={sale.active ? "status-pill good" : "status-pill"}>{sale.active ? sale.state : sale.status}</span>{sale.active && <button onClick={() => void closeSale(sale.id)}>마감</button>}</div>
          </article>)}
          {!sales.length && <p>아직 생성된 판매회차가 없습니다.</p>}
        </div>
      </div>
    </section>}

    {tab === "reservations" && <section className="band-card">
      <div className="section-title"><div><h2>예약목록</h2><p>{activeSale ? activeSale.title + " · 픽업 " + activeSale.pickup_date : "전체 예약"}</p></div><button onClick={() => void load()}>새로고침</button></div>
      <div className="reservation-list">
        {(activeSale ? activeReservations : reservations).map((reservation) => <article className="reservation-row" key={reservation.id}>
          <div className="reservation-main">
            <strong>{reservation.customer_name} · {reservation.quantity}개</strong>
            <span>{reservation.customer_phone} · {reservation.pickup_window}</span>
            <small>{reservation.reservation_no} · {dt(reservation.created_at)}</small>
          </div>
          <div className="reservation-money"><strong>{won(reservation.total_amount)}</strong><span>예약금 {won(reservation.deposit_amount)} · {reservation.payment_status}</span></div>
          <div className="reservation-actions">
            <span className="status-pill">{reservation.status}</span>
            {reservation.status === "confirmed" && <>
              <button className="success" onClick={() => void updateReservation(reservation.id, "picked_up")}>수령완료</button>
              <button onClick={() => void updateReservation(reservation.id, "cancelled")}>취소</button>
              <button className="danger" onClick={() => void updateReservation(reservation.id, "no_show")}>노쇼</button>
            </>}
          </div>
        </article>)}
        {!(activeSale ? activeReservations : reservations).length && <p>예약이 없습니다.</p>}
      </div>
    </section>}

    {tab === "customers" && <section className="band-card">
      <div className="section-title"><div><h2>고객 DB</h2><p>광고 발송용이 아닌 예약·재구매·노쇼 관리용 데이터입니다.</p></div></div>
      <div className="customer-table">
        <div className="customer-row customer-head"><span>고객</span><span>등급</span><span>정상수령</span><span>노쇼</span><span>누적구매</span></div>
        {customers.map((customer) => <div className="customer-row" key={customer.phone}>
          <span><strong>{customer.name}</strong><small>{customer.phone}</small></span>
          <span><b className={customer.label === "노쇼주의" ? "danger-text" : ""}>{customer.label}</b></span>
          <span>{customer.pickupCount}회<small>{customer.pickupRate}%</small></span>
          <span>{customer.noShowCount}회</span>
          <span>{won(customer.purchaseAmount)}<small>{customer.purchaseQty}개</small></span>
        </div>)}
        {!customers.length && <p>아직 누적된 고객 데이터가 없습니다.</p>}
      </div>
    </section>}
  </main>;
}

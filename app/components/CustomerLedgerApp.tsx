"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaymentMethod } from "./types";

type CustomerSummary = {
  id: string;
  displayName: string;
  displayPhone: string;
  ledgerLabel: string;
  totalOrdered: number;
  netReceived: number;
  receivable: number;
  advance: number;
  state: "credit" | "partial" | "paid" | "advance";
  orderCount: number;
  oldestDueDate: string | null;
  lastPaymentAt: string | null;
  lastPaymentMethod: PaymentMethod | null;
  pendingConsultations: number;
};

type LedgerOrder = {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  submittedAt: string;
  fulfillmentType: "pickup" | "shipping";
  dueDate: string | null;
  items: { id: string; name: string; quantity: number; lineTotal: number }[];
};

type LedgerTransaction = {
  id: string;
  type: "payment" | "reversal" | "adjustment" | "transfer_in" | "transfer_out";
  method: PaymentMethod | null;
  amount: number;
  netAmount: number;
  transactedAt: string;
  payerName: string | null;
  payerPhone: string | null;
  payerRelation: string | null;
  memo: string;
  relatedTransactionId: string | null;
  consultationId: string | null;
};

type Consultation = {
  id: string;
  note: string;
  status: "pending" | "applied";
  createdAt: string;
  appliedAt: string | null;
  targetCustomerAccountId: string | null;
  transferAmount: number;
  applicationMemo: string;
  orderIds: string[];
};

type CustomerDetail = {
  account: { id: string; displayName: string; displayPhone: string; ledgerSequence: number; ledgerLabel: string };
  summary: Pick<CustomerSummary, "totalOrdered" | "netReceived" | "receivable" | "advance" | "state">;
  orders: LedgerOrder[];
  transactions: LedgerTransaction[];
  consultations: Consultation[];
};

const won = (value: number) => value.toLocaleString("ko-KR") + "원";
const methodLabel: Record<PaymentMethod, string> = { card: "카드", cash: "현금", bank_transfer: "계좌이체" };
const stateLabel = { credit: "외상", partial: "부분결제", paid: "결제 완료", advance: "선수금 보유" } as const;
const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const todayInSeoul = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const dueStatus = (date: string | null, receivable: number) => {
  if (!date || receivable <= 0) return { label: "-", className: "" };
  const today = todayInSeoul();
  if (date < today) return { label: "연체 · " + date, className: "overdue" };
  if (date === today) return { label: "오늘 · " + date, className: "today" };
  return { label: "예정 · " + date, className: "planned" };
};

export default function CustomerLedgerApp({
  initialCustomerId,
  onClose,
  onChanged,
}: {
  initialCustomerId?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedId, setSelectedId] = useState(initialCustomerId ?? "");
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const lastServerTouch = useRef(0);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(async () => {
    setUnlocked(false);
    setPassword("");
    setDetail(null);
    if (lockTimer.current) clearTimeout(lockTimer.current);
    await fetch("/api/customer-ledger/access", { method: "DELETE" }).catch(() => undefined);
  }, []);

  const resetIdle = useCallback(() => {
    if (!unlocked) return;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => void lock(), 5 * 60 * 1000);
    if (Date.now() - lastServerTouch.current > 60_000) {
      lastServerTouch.current = Date.now();
      void fetch("/api/customer-ledger/access", { cache: "no-store" }).then((response) => {
        if (!response.ok) void lock();
      }).catch(() => undefined);
    }
  }, [lock, unlocked]);

  useEffect(() => {
    const check = async () => {
      const response = await fetch("/api/customer-ledger/access", { cache: "no-store" });
      setUnlocked(response.ok);
      setLoading(false);
    };
    void check();
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    resetIdle();
    const activity = () => resetIdle();
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    window.addEventListener("input", activity);
    return () => {
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("input", activity);
      if (lockTimer.current) clearTimeout(lockTimer.current);
    };
  }, [resetIdle, unlocked]);

  const handleLocked = useCallback((response: Response) => {
    if (response.status !== 401) return false;
    setUnlocked(false);
    setDetail(null);
    setError("5분 동안 사용하지 않아 고객 장부가 잠겼습니다.");
    return true;
  }, []);

  const loadCustomers = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const response = await fetch("/api/customer-ledger?q=" + encodeURIComponent(search), { cache: "no-store" });
      if (handleLocked(response)) return;
      const data = await response.json() as { customers?: CustomerSummary[]; error?: string };
      if (!response.ok) throw new Error(data.error || "고객 장부를 불러오지 못했습니다.");
      setCustomers(data.customers ?? []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "고객 장부를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [handleLocked]);

  const loadDetail = useCallback(async (customerId: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/customer-ledger?customerId=" + encodeURIComponent(customerId), { cache: "no-store" });
      if (handleLocked(response)) return;
      const data = await response.json() as CustomerDetail & { error?: string };
      if (!response.ok) throw new Error(data.error || "고객 원장을 불러오지 못했습니다.");
      setDetail(data);
      setSelectedId(customerId);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "고객 원장을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [handleLocked]);

  useEffect(() => {
    if (!unlocked) return;
    const frame = requestAnimationFrame(() => {
      if (selectedId) void loadDetail(selectedId);
      else void loadCustomers();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadCustomers, loadDetail, selectedId, unlocked]);

  const unlock = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/customer-ledger/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "고객 장부를 열지 못했습니다.");
      lastServerTouch.current = Date.now();
      setUnlocked(true);
      setPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "고객 장부를 열지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    await Promise.all([loadCustomers(query), selectedId ? loadDetail(selectedId) : Promise.resolve()]);
    onChanged();
  };

  return <div className="ledger-backdrop">
    <section className="customer-ledger" aria-label="고객 결제와 미수 장부">
      <header className="ledger-header">
        <div><small>OWNER LEDGER</small><h2>고객 결제·미수 장부</h2></div>
        <div>{unlocked && <button onClick={() => void lock()}>장부 잠금</button>}<button onClick={onClose} aria-label="고객 장부 닫기">×</button></div>
      </header>

      {!unlocked ? <form className="ledger-lock" onSubmit={(event) => { event.preventDefault(); void unlock(); }}>
        <b>관리자 확인이 필요합니다</b>
        <p>고객정보와 결제장부는 관리자 패스워드 확인 후 5분 동안 열립니다.</p>
        <label><span>관리자 패스워드</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        {error && <p className="payment-error" role="alert">{error}</p>}
        <button className="task-primary" disabled={loading || !password}>{loading ? "확인 중…" : "고객 장부 열기"}</button>
      </form> : <>
        <div className="ledger-toolbar">
          {detail ? <button onClick={() => { setDetail(null); setSelectedId(""); }}>← 고객 목록</button> : <form onSubmit={(event) => { event.preventDefault(); void loadCustomers(query); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="고객명·전화번호 검색" /><button>검색</button></form>}
          <span>5분 비활동 시 자동 잠금</span>
        </div>
        {error && <p className="ledger-error" role="alert">{error}</p>}
        {loading && <div className="ledger-loading">장부를 확인하고 있습니다…</div>}
        {!loading && !detail && <CustomerList customers={customers} onSelect={(customerId) => setSelectedId(customerId)} />}
        {!loading && detail && <CustomerDetailView detail={detail} refresh={() => void refresh()} />}
      </>}
    </section>
  </div>;
}

function CustomerList({ customers, onSelect }: { customers: CustomerSummary[]; onSelect: (id: string) => void }) {
  if (!customers.length) return <div className="ledger-empty">조건에 맞는 고객 장부가 없습니다.</div>;
  return <div className="ledger-customer-list"><table><thead><tr><th>고객</th><th>주문</th><th>총 주문</th><th>입금</th><th>미수</th><th>선수금</th><th>상태</th><th>결제 기준일</th><th>마지막 입금</th></tr></thead><tbody>
    {customers.map((customer) => {
      const due = dueStatus(customer.oldestDueDate, customer.receivable);
      return <tr key={customer.id} tabIndex={0} onClick={() => onSelect(customer.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(customer.id); }}>
      <td><b>{customer.displayName}</b><small>{customer.displayPhone}{customer.ledgerLabel ? " · " + customer.ledgerLabel : ""}</small></td>
      <td>{customer.orderCount}건</td><td>{won(customer.totalOrdered)}</td><td>{won(customer.netReceived)}</td>
      <td className="ledger-receivable">{won(customer.receivable)}</td><td>{won(customer.advance)}</td>
      <td><em className={"ledger-state " + customer.state}>{stateLabel[customer.state]}</em>{customer.pendingConsultations > 0 && <small>상담 {customer.pendingConsultations}건</small>}</td>
      <td><em className={"ledger-due " + due.className}>{due.label}</em></td>
      <td>{customer.lastPaymentAt ? new Date(customer.lastPaymentAt).toLocaleDateString("ko-KR") : "-"}<small>{customer.lastPaymentMethod ? methodLabel[customer.lastPaymentMethod] : ""}</small></td>
    </tr>;})}
  </tbody></table></div>;
}

function CustomerDetailView({ detail, refresh }: { detail: CustomerDetail; refresh: () => void }) {
  const [panel, setPanel] = useState<"payment" | "consultation" | null>(null);
  const [correction, setCorrection] = useState<LedgerTransaction | null>(null);
  const [applyConsultation, setApplyConsultation] = useState<Consultation | null>(null);
  const reversed = useMemo(() => new Set(detail.transactions.filter((item) => item.type === "reversal").map((item) => item.relatedTransactionId)), [detail.transactions]);
  const consultationNeeded = detail.summary.advance > 0 && detail.orders.some((order) => order.status === "cancelled");
  return <div className="ledger-detail">
    <section className="ledger-customer-heading"><div><small>{detail.account.ledgerLabel || "통합 장부"}</small><h3>{detail.account.displayName}</h3><span>{detail.account.displayPhone}</span></div><div><button onClick={() => setPanel("payment")}>결제 등록</button><button onClick={() => setPanel("consultation")}>상담 메모</button></div></section>
    <section className="ledger-summary"><p><span>총 주문금액</span><b>{won(detail.summary.totalOrdered)}</b></p><p><span>입금 누계</span><b>{won(detail.summary.netReceived)}</b></p><p><span>현재 미수금</span><b>{won(detail.summary.receivable)}</b></p><p><span>현재 선수금</span><b>{won(detail.summary.advance)}</b></p><p><span>결제상태</span><b>{stateLabel[detail.summary.state]}</b></p></section>
    {consultationNeeded && <div className="ledger-consultation-warning">입금 후 취소로 선수금이 남았습니다. 고객 상담 내용을 기록해주세요.</div>}
    {panel === "payment" && <PaymentForm customerId={detail.account.id} onDone={() => { setPanel(null); refresh(); }} onCancel={() => setPanel(null)} />}
    {correction && <CorrectionForm customerId={detail.account.id} transaction={correction} onDone={() => { setCorrection(null); refresh(); }} onCancel={() => setCorrection(null)} />}
    {panel === "consultation" && <ConsultationForm customerId={detail.account.id} orders={detail.orders} onDone={() => { setPanel(null); refresh(); }} onCancel={() => setPanel(null)} />}
    {applyConsultation && <ApplyConsultationForm customerId={detail.account.id} consultation={applyConsultation} onDone={() => { setApplyConsultation(null); refresh(); }} onCancel={() => setApplyConsultation(null)} />}

    <section className="ledger-section"><h3>주문·상품</h3><div className="ledger-order-list">{detail.orders.map((order) => <article key={order.id} className={order.status === "cancelled" ? "cancelled" : ""}><header><b>{order.orderNo}</b><span>{order.dueDate || "기준일 미지정"} · {order.fulfillmentType === "pickup" ? "방문수령" : "택배발송"}</span><em>{order.status === "cancelled" ? "취소" : won(order.totalAmount)}</em></header>{order.items.map((item) => <p key={item.id}><span>{item.name} × {item.quantity}</span><b>{won(item.lineTotal)}</b></p>)}</article>)}</div></section>
    <section className="ledger-section"><h3>입금·정정 내역</h3>{detail.transactions.length ? <ul className="ledger-transactions">{detail.transactions.map((transaction) => <li key={transaction.id}><div><b>{transaction.type === "payment" ? (transaction.method ? methodLabel[transaction.method] : "입금") : transaction.type === "reversal" ? "결제 정정" : transaction.type === "transfer_in" ? "분리 이관 입금" : transaction.type === "transfer_out" ? "분리 이관 출금" : "잔액 조정"}</b><span>{new Date(transaction.transactedAt).toLocaleString("ko-KR")}{transaction.payerName ? " · 결제자 " + transaction.payerName : ""}</span>{transaction.memo && <small>{transaction.memo}</small>}</div><strong className={transaction.netAmount < 0 ? "negative" : ""}>{transaction.netAmount < 0 ? "−" : "+"}{won(Math.abs(transaction.netAmount))}</strong>{transaction.type === "payment" && !reversed.has(transaction.id) && <button onClick={() => setCorrection(transaction)}>정정</button>}</li>)}</ul> : <p className="ledger-empty">아직 등록된 입금이 없습니다.</p>}</section>
    <section className="ledger-section"><h3>상담 메모</h3>{detail.consultations.length ? <ul className="ledger-consultations">{detail.consultations.map((consultation) => <li key={consultation.id}><div><b>{consultation.status === "pending" ? "적용 대기" : "적용 완료"}</b><span>{new Date(consultation.createdAt).toLocaleString("ko-KR")}</span><p>{consultation.note}</p><small>대상 주문 {consultation.orderIds.length}건{consultation.transferAmount ? " · 이관 " + won(consultation.transferAmount) : ""}</small></div>{consultation.status === "pending" && consultation.orderIds.length > 0 && <button onClick={() => setApplyConsultation(consultation)}>분리 적용</button>}</li>)}</ul> : <p className="ledger-empty">등록된 상담 메모가 없습니다.</p>}</section>
  </div>;
}

function PaymentFields({ method, setMethod, amount, setAmount, paidAt, setPaidAt, payerName, setPayerName, payerPhone, setPayerPhone, payerRelation, setPayerRelation, memo, setMemo }: {
  method: PaymentMethod; setMethod: (value: PaymentMethod) => void; amount: string; setAmount: (value: string) => void; paidAt: string; setPaidAt: (value: string) => void;
  payerName: string; setPayerName: (value: string) => void; payerPhone: string; setPayerPhone: (value: string) => void; payerRelation: string; setPayerRelation: (value: string) => void; memo: string; setMemo: (value: string) => void;
}) {
  return <div className="ledger-form-grid"><label><span>결제수단</span><select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><option value="card">카드</option><option value="cash">현금</option><option value="bank_transfer">계좌이체</option></select></label><label><span>결제금액</span><input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label><span>결제일시</span><input type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label><label><span>실제 결제자 이름 · 선택</span><input value={payerName} onChange={(event) => setPayerName(event.target.value)} /></label><label><span>실제 결제자 전화번호 · 선택</span><input value={payerPhone} onChange={(event) => setPayerPhone(event.target.value)} /></label><label><span>고객과의 관계 · 선택</span><input value={payerRelation} onChange={(event) => setPayerRelation(event.target.value)} /></label><label className="wide"><span>메모 · 선택</span><input value={memo} onChange={(event) => setMemo(event.target.value)} /></label></div>;
}

function PaymentForm({ customerId, onDone, onCancel }: { customerId: string; onDone: () => void; onCancel: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>("card"); const [amount, setAmount] = useState(""); const [paidAt, setPaidAt] = useState(localDateTime); const [payerName, setPayerName] = useState(""); const [payerPhone, setPayerPhone] = useState(""); const [payerRelation, setPayerRelation] = useState(""); const [memo, setMemo] = useState(""); const [adminPassword, setAdminPassword] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); setError(""); try { const response = await fetch("/api/customer-ledger/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "payment", customerAccountId: customerId, method, amount: Number(amount), paidAt: new Date(paidAt).toISOString(), payerName, payerPhone, payerRelation, memo, adminPassword, idempotencyKey: crypto.randomUUID() }) }); const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || "결제를 등록하지 못했습니다."); onDone(); } catch (caught) { setError(caught instanceof Error ? caught.message : "결제를 등록하지 못했습니다."); } finally { setSaving(false); } };
  return <section className="ledger-editor"><h3>고객 결제 등록</h3><PaymentFields {...{ method, setMethod, amount, setAmount, paidAt, setPaidAt, payerName, setPayerName, payerPhone, setPayerPhone, payerRelation, setPayerRelation, memo, setMemo }} /><label><span>관리자 패스워드 · 저장 시 재확인</span><input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} /></label>{error && <p className="payment-error" role="alert">{error}</p>}<div><button onClick={onCancel}>취소</button><button className="task-primary" disabled={saving || !amount || !adminPassword} onClick={() => void save()}>{saving ? "저장 중…" : "결제 등록"}</button></div></section>;
}

function CorrectionForm({ customerId, transaction, onDone, onCancel }: { customerId: string; transaction: LedgerTransaction; onDone: () => void; onCancel: () => void }) {
  const [replace, setReplace] = useState(true); const [reason, setReason] = useState(""); const [method, setMethod] = useState<PaymentMethod>(transaction.method || "card"); const [amount, setAmount] = useState(String(transaction.amount)); const [paidAt, setPaidAt] = useState(localDateTime); const [payerName, setPayerName] = useState(transaction.payerName || ""); const [payerPhone, setPayerPhone] = useState(transaction.payerPhone || ""); const [payerRelation, setPayerRelation] = useState(transaction.payerRelation || ""); const [memo, setMemo] = useState(transaction.memo); const [adminPassword, setAdminPassword] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); setError(""); try { const response = await fetch("/api/customer-ledger/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "correction", customerAccountId: customerId, originalTransactionId: transaction.id, reason, adminPassword, idempotencyKey: crypto.randomUUID(), replacement: replace ? { method, amount: Number(amount), paidAt: new Date(paidAt).toISOString(), payerName, payerPhone, payerRelation, memo } : null }) }); const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || "결제를 정정하지 못했습니다."); onDone(); } catch (caught) { setError(caught instanceof Error ? caught.message : "결제를 정정하지 못했습니다."); } finally { setSaving(false); } };
  return <section className="ledger-editor"><h3>결제 기록 정정</h3><p>원본 {methodLabel[transaction.method || "card"]} {won(transaction.amount)} 기록은 보존되고 상쇄 기록이 추가됩니다.</p><label><span>정정 사유</span><input value={reason} onChange={(event) => setReason(event.target.value)} /></label><label className="ledger-check"><input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} /> 올바른 결제를 이어서 등록</label>{replace && <PaymentFields {...{ method, setMethod, amount, setAmount, paidAt, setPaidAt, payerName, setPayerName, payerPhone, setPayerPhone, payerRelation, setPayerRelation, memo, setMemo }} />}<label><span>관리자 패스워드 · 저장 시 재확인</span><input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} /></label>{error && <p className="payment-error" role="alert">{error}</p>}<div><button onClick={onCancel}>취소</button><button className="task-primary" disabled={saving || !reason || !adminPassword} onClick={() => void save()}>{saving ? "저장 중…" : "정정 기록 저장"}</button></div></section>;
}

function ConsultationForm({ customerId, orders, onDone, onCancel }: { customerId: string; orders: LedgerOrder[]; onDone: () => void; onCancel: () => void }) {
  const [note, setNote] = useState(""); const [orderIds, setOrderIds] = useState<string[]>([]); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); setError(""); try { const response = await fetch("/api/customer-ledger/consultations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "note", customerAccountId: customerId, note, orderIds }) }); const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || "상담 메모를 저장하지 못했습니다."); onDone(); } catch (caught) { setError(caught instanceof Error ? caught.message : "상담 메모를 저장하지 못했습니다."); } finally { setSaving(false); } };
  return <section className="ledger-editor"><h3>고객 상담 메모</h3><label><span>상담 내용</span><textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><fieldset><legend>나중에 분리 적용할 주문 · 선택</legend>{orders.map((order) => <label className="ledger-check" key={order.id}><input type="checkbox" checked={orderIds.includes(order.id)} onChange={(event) => setOrderIds((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} /> {order.orderNo} · {won(order.totalAmount)}</label>)}</fieldset>{error && <p className="payment-error" role="alert">{error}</p>}<div><button onClick={onCancel}>취소</button><button className="task-primary" disabled={saving || !note.trim()} onClick={() => void save()}>{saving ? "저장 중…" : "상담 메모 저장"}</button></div></section>;
}

function ApplyConsultationForm({ customerId, consultation, onDone, onCancel }: { customerId: string; consultation: Consultation; onDone: () => void; onCancel: () => void }) {
  const [ledgerLabel, setLedgerLabel] = useState(""); const [transferAmount, setTransferAmount] = useState("0"); const [applicationMemo, setApplicationMemo] = useState(""); const [adminPassword, setAdminPassword] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); setError(""); try { const response = await fetch("/api/customer-ledger/consultations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply", customerAccountId: customerId, consultationId: consultation.id, ledgerLabel, transferAmount: Number(transferAmount), applicationMemo, adminPassword }) }); const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || "장부 분리를 적용하지 못했습니다."); onDone(); } catch (caught) { setError(caught instanceof Error ? caught.message : "장부 분리를 적용하지 못했습니다."); } finally { setSaving(false); } };
  return <section className="ledger-editor"><h3>상담 내용 장부에 적용</h3><p>{consultation.note}</p><label><span>새 장부 표시명 · 선택</span><input value={ledgerLabel} onChange={(event) => setLedgerLabel(event.target.value)} placeholder="예: 가족 대리결제 분리" /></label><label><span>새 장부로 이관할 입금액</span><input type="number" min="0" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} /></label><label><span>상담 후 적용 내용</span><textarea value={applicationMemo} onChange={(event) => setApplicationMemo(event.target.value)} /></label><label><span>관리자 패스워드 · 적용 시 재확인</span><input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} /></label>{error && <p className="payment-error" role="alert">{error}</p>}<div><button onClick={onCancel}>취소</button><button className="task-primary" disabled={saving || !applicationMemo.trim() || !adminPassword} onClick={() => void save()}>{saving ? "적용 중…" : "장부 분리 적용"}</button></div></section>;
}

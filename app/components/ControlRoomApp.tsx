"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppNav from "./AppNav";
import type {
  ControlRoomForecastResponse,
  ControlRoomLedgerSummary,
  ControlRoomLiveResponse,
} from "../lib/control-room-types";

type LedgerCustomerRow = {
  totalOrdered: number;
  netReceived: number;
  receivable: number;
  advance: number;
};

const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

function clockLabel(value: string) {
  if (!value) return "연결 중";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", month: "numeric", day: "numeric", weekday: "short" }).format(new Date(`${value}T00:00:00Z`));
}

function metric(label: string, value: number | string, tone = "") {
  return <div className={`control-metric ${tone}`}><small>{label}</small><b>{value}</b></div>;
}

export default function ControlRoomApp({ initialDate }: { initialDate: string }) {
  const [live, setLive] = useState<ControlRoomLiveResponse | null>(null);
  const [forecast, setForecast] = useState<ControlRoomForecastResponse | null>(null);
  const [liveError, setLiveError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [ledgerState, setLedgerState] = useState<"checking" | "locked" | "unlocked">("checking");
  const [ledgerSummary, setLedgerSummary] = useState<ControlRoomLedgerSummary | null>(null);
  const [ledgerPassword, setLedgerPassword] = useState("");
  const [ledgerError, setLedgerError] = useState("");
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const liveSequence = useRef(0);
  const forecastSequence = useRef(0);

  const loadLive = useCallback(async (silent = false) => {
    const requestId = ++liveSequence.current;
    try {
      const response = await fetch(`/api/control-room/live?date=${encodeURIComponent(initialDate)}`, { cache: "no-store" });
      const data = await response.json() as ControlRoomLiveResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "오늘 운영현황을 불러오지 못했습니다.");
      if (requestId !== liveSequence.current) return;
      setLive(data);
      setLiveError("");
    } catch (error) {
      if (requestId === liveSequence.current && (!silent || !live)) setLiveError(error instanceof Error ? error.message : "오늘 운영현황을 불러오지 못했습니다.");
    }
  }, [initialDate, live]);

  const loadForecast = useCallback(async (silent = false) => {
    const requestId = ++forecastSequence.current;
    try {
      const response = await fetch(`/api/control-room/forecast?startDate=${encodeURIComponent(initialDate)}&days=7`, { cache: "no-store" });
      const data = await response.json() as ControlRoomForecastResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "7일 운영전망을 불러오지 못했습니다.");
      if (requestId !== forecastSequence.current) return;
      setForecast(data);
      setForecastError("");
    } catch (error) {
      if (requestId === forecastSequence.current && (!silent || !forecast)) setForecastError(error instanceof Error ? error.message : "7일 운영전망을 불러오지 못했습니다.");
    }
  }, [forecast, initialDate]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadLive());
    const timer = setInterval(() => void loadLive(true), 2500);
    const refresh = () => void loadLive(true);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [loadLive]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadForecast());
    const timer = setInterval(() => void loadForecast(true), 60_000);
    const refresh = () => void loadForecast(true);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [loadForecast]);

  const loadLedgerSummary = useCallback(async () => {
    const response = await fetch("/api/customer-ledger", { cache: "no-store" });
    const data = await response.json() as { customers?: LedgerCustomerRow[]; error?: string; locked?: boolean };
    if (!response.ok || !data.customers) {
      if (data.locked || response.status === 401) { setLedgerState("locked"); setLedgerSummary(null); }
      throw new Error(data.error || "고객 장부를 불러오지 못했습니다.");
    }
    const summary = data.customers.reduce<ControlRoomLedgerSummary>((result, customer) => ({
      totalOrdered: result.totalOrdered + Number(customer.totalOrdered),
      netReceived: result.netReceived + Number(customer.netReceived),
      receivable: result.receivable + Number(customer.receivable),
      advance: result.advance + Number(customer.advance),
      receivableCustomers: result.receivableCustomers + (Number(customer.receivable) > 0 ? 1 : 0),
      advanceCustomers: result.advanceCustomers + (Number(customer.advance) > 0 ? 1 : 0),
    }), { totalOrdered: 0, netReceived: 0, receivable: 0, advance: 0, receivableCustomers: 0, advanceCustomers: 0 });
    setLedgerSummary(summary);
    setLedgerState("unlocked");
    setLedgerError("");
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch("/api/customer-ledger/access", { cache: "no-store" });
        if (!response.ok) { setLedgerState("locked"); return; }
        await loadLedgerSummary();
      } catch { setLedgerState("locked"); }
    };
    void check();
  }, [loadLedgerSummary]);

  async function unlockLedger(event: FormEvent) {
    event.preventDefault();
    setLedgerBusy(true);
    setLedgerError("");
    try {
      const response = await fetch("/api/customer-ledger/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: ledgerPassword }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "장부 잠금을 해제하지 못했습니다.");
      setLedgerPassword("");
      await loadLedgerSummary();
    } catch (error) { setLedgerError(error instanceof Error ? error.message : "장부 잠금을 해제하지 못했습니다."); }
    finally { setLedgerBusy(false); }
  }

  async function lockLedger() {
    await fetch("/api/customer-ledger/access", { method: "DELETE" });
    setLedgerState("locked");
    setLedgerSummary(null);
  }

  const alertCounts = useMemo(() => ({
    critical: live?.alerts.filter((alert) => alert.severity === "critical").length ?? 0,
    warning: live?.alerts.filter((alert) => alert.severity === "warning").length ?? 0,
    production: live?.alerts.filter((alert) => alert.severity === "production").length ?? 0,
  }), [live]);

  return <div className="control-room-page">
    <header className="control-room-header">
      <a href="/" className="control-room-brand"><Image src="/jeongilpum-logo.png" width={52} height={52} alt="정일품 정육식당 로고" /><span><b>정일품 종합통제실</b><small>OPERATIONS CONTROL</small></span></a>
      <div className="control-room-sync"><i /> 실시간 연결 <span>최근 동기화 {clockLabel(live?.generatedAt ?? "")}</span></div>
    </header>
    <AppNav current="control-room" />

    <main className="control-room-main">
      <section className="control-room-intro">
        <div><small>TODAY · {initialDate}</small><h1>오늘 운영의 위험부터 확인합니다</h1><p>주문·작업·생산·패키지를 읽기 전용으로 모아 보고, 실제 처리는 해당 운영 화면에서 진행합니다.</p></div>
        <div className="control-room-alert-totals"><span className="critical">긴급 <b>{alertCounts.critical}</b></span><span className="warning">주의 <b>{alertCounts.warning}</b></span><span className="production">생산 <b>{alertCounts.production}</b></span></div>
      </section>

      {liveError && <div className="control-room-error" role="alert">{liveError}<button onClick={() => void loadLive()}>다시 불러오기</button></div>}

      <section className="control-room-alert-board" aria-label="지금 조치 필요">
        <header><div><small>PRIORITY QUEUE</small><h2>지금 조치 필요</h2></div><b>{live?.alerts.length ?? 0}건</b></header>
        <div className="control-room-alert-list">
          {!live && !liveError && <p className="control-room-empty">실시간 위험을 확인하고 있습니다.</p>}
          {live && !live.alerts.length && <p className="control-room-empty success">현재 즉시 조치할 경보가 없습니다.</p>}
          {live?.alerts.map((alert) => <a key={alert.id} href={alert.href} className={`control-room-alert ${alert.severity}`}><span>{alert.severity === "critical" ? "!" : alert.severity === "production" ? "P" : "△"}</span><div><b>{alert.title}</b><small>{alert.detail}</small></div><em>{alert.area === "sales" ? "판매장" : alert.area === "workshop" ? "작업장" : "생산"} →</em></a>)}
        </div>
      </section>

      <div className="control-room-grid">
        <section className="control-panel orders"><header><div><small>ORDERS</small><h2>오늘 주문</h2></div><a href={`/sales?date=${initialDate}`}>판매장 열기 →</a></header><div className="control-metrics primary">{metric("전체 주문", live?.orders.total ?? 0, "featured")}{metric("총 세트", live?.orders.totalSets ?? 0)}</div><div className="control-metrics">{metric("현장", live?.orders.onsite ?? 0)}{metric("방문", live?.orders.pickup ?? 0)}{metric("택배", live?.orders.shipping ?? 0)}{metric("대기", live?.orders.waiting ?? 0)}{metric("작업중", live?.orders.inProgress ?? 0)}{metric("준비완료", live?.orders.ready ?? 0)}{metric("완료", live?.orders.fulfilled ?? 0)}</div></section>
        <section className="control-panel workshop"><header><div><small>WORKSHOP</small><h2>작업장</h2></div><a href={`/workshop?date=${initialDate}`}>작업장 열기 →</a></header><div className="control-metrics">{metric("긴급", live?.workshop.urgent ?? 0, (live?.workshop.urgent ?? 0) ? "danger" : "")}{metric("작업대기", live?.workshop.waiting ?? 0)}{metric("수락완료", live?.workshop.accepted ?? 0)}{metric("작업중", live?.workshop.inProgress ?? 0)}{metric("준비완료", live?.workshop.ready ?? 0)}</div></section>
        <section className="control-panel production"><header><div><small>PRODUCTION</small><h2>생산·패키지</h2></div><a href={`/workshop/production?date=${initialDate}`}>생산관리 열기 →</a></header>{live && !live.production.available ? <p className="control-room-empty">생산 migration 적용 후 상세 현황이 연결됩니다.</p> : <><div className="control-metrics">{metric("필요팩", live?.production.requiredPacks ?? 0)}{metric("가용팩", live?.production.availablePacks ?? 0)}{metric("즉시 부족", live?.production.shortagePacks ?? 0, (live?.production.shortagePacks ?? 0) ? "warning" : "")}{metric("계획 미충당", live?.production.uncoveredPacks ?? 0, (live?.production.uncoveredPacks ?? 0) ? "danger" : "")}</div><div className="control-progress"><span><b>생산 배치</b><em>{live?.production.batchProduced ?? 0} / {live?.production.batchTarget ?? 0}팩</em></span><i><b style={{ width: `${live?.production.batchTarget ? Math.min(100, live.production.batchProduced / live.production.batchTarget * 100) : 0}%` }} /></i></div></>}<div className="control-progress"><span><b>패키지 완성</b><em>{live?.packages.completed ?? 0} / {live?.packages.total ?? 0}세트</em></span><i><b style={{ width: `${live?.packages.completionRate ?? 0}%` }} /></i></div></section>
        <section className="control-panel ledger"><header><div><small>FINANCE · LOCKED BY DEFAULT</small><h2>결제·미수</h2></div>{ledgerState === "unlocked" && <button onClick={() => void lockLedger()}>잠그기</button>}</header>{ledgerState === "checking" && <p className="control-room-empty">장부 권한을 확인하고 있습니다.</p>}{ledgerState === "locked" && <form className="ledger-unlock" onSubmit={unlockLedger}><p>금액은 고객 장부 5분 세션을 열어야 표시됩니다.</p><label><span>직원 장부 비밀번호</span><input type="password" value={ledgerPassword} onChange={(event) => setLedgerPassword(event.target.value)} autoComplete="current-password" /></label>{ledgerError && <small role="alert">{ledgerError}</small>}<button disabled={ledgerBusy || !ledgerPassword}>{ledgerBusy ? "확인 중…" : "금액 보기"}</button></form>}{ledgerState === "unlocked" && ledgerSummary && <><div className="control-metrics finance">{metric("총 주문", won.format(ledgerSummary.totalOrdered))}{metric("순입금", won.format(ledgerSummary.netReceived))}{metric("총 미수", won.format(ledgerSummary.receivable), ledgerSummary.receivable ? "danger" : "")}{metric("총 선수금", won.format(ledgerSummary.advance))}</div><footer><span>미수 고객 {ledgerSummary.receivableCustomers}명 · 선수금 고객 {ledgerSummary.advanceCustomers}명</span><button onClick={() => void loadLedgerSummary()}>금액 새로고침</button></footer></>}</section>
      </div>

      <section className="control-room-forecast">
        <header><div><small>NEXT 7 DAYS</small><h2>오늘 이후 7일 운영전망</h2><p>현재 가용팩과 날짜별 남은 생산목표를 순서대로 반영한 전망입니다.</p></div><span>60초 간격 갱신 · {clockLabel(forecast?.generatedAt ?? "")}</span></header>
        {forecastError && <div className="control-room-error" role="alert">{forecastError}<button onClick={() => void loadForecast()}>다시 불러오기</button></div>}
        <div className="forecast-table-wrap"><table><thead><tr><th>날짜</th><th>주문</th><th>세트</th><th>방문</th><th>택배</th><th>필요팩</th><th>부족</th><th>패키지</th><th>이동</th></tr></thead><tbody>{forecast?.forecast.map((day) => <tr key={day.date} className={day.shortagePacks || day.missingBomProducts ? "risk" : ""}><td><b>{dateLabel(day.date)}</b><small>{day.date}</small></td><td>{day.orderCount}</td><td>{day.totalSets}</td><td>{day.pickup}</td><td>{day.shipping}</td><td>{day.productionAvailable ? day.requiredPacks : "-"}</td><td><b>{day.productionAvailable ? day.shortagePacks : "-"}</b>{day.missingBomProducts > 0 && <small>BOM {day.missingBomProducts}</small>}</td><td>{day.packageCompleted}/{day.packageTotal}</td><td><div className="forecast-links"><a href={`/sales?date=${day.date}`}>판매</a><a href={`/workshop?date=${day.date}`}>작업</a><a href={`/workshop/production?date=${day.date}`}>생산</a></div></td></tr>)}{!forecast && !forecastError && <tr><td colSpan={9} className="control-room-empty">7일 전망을 계산하고 있습니다.</td></tr>}</tbody></table></div>
      </section>
    </main>
  </div>;
}


"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorkshopPackageDetail } from "../lib/package-types";
import AppNav from "./AppNav";
import "../workshop-flow.css";

type LabelPreview = { packageCode: string; orderNo: string; productName: string; schedule: string; components: Array<{ name: string; traceabilityNo: string; weightG: number; origin: string; slaughterhouse: string; cattleType: string; grade: string }> };

export default function PackageApp({ packageCode }: { packageCode: string }) {
  const [detail, setDetail] = useState<WorkshopPackageDetail | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [scan, setScan] = useState("");
  const [origin, setOrigin] = useState("");
  const [slaughterhouse, setSlaughterhouse] = useState("");
  const [cattleType, setCattleType] = useState("");
  const [grade, setGrade] = useState("");
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [qrData, setQrData] = useState("");
  const [label, setLabel] = useState<LabelPreview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/workshop/packages/${encodeURIComponent(packageCode)}`, { cache: "no-store" });
    const data = await response.json() as { package?: WorkshopPackageDetail; error?: string };
    if (!response.ok || !data.package) throw new Error(data.error || "패키지 정보를 불러오지 못했습니다.");
    const nextPackage = data.package;
    setDetail(nextPackage);
    setSelected((current) => current.length ? current.filter((id) => nextPackage.components.some((component) => component.id === id)) : nextPackage.components.map((component) => component.id));
    setWeights(Object.fromEntries(nextPackage.components.map((component) => [component.id, component.weightG ? String(component.weightG) : ""])));
    setError("");
  }, [packageCode]);

  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "패키지 정보를 불러오지 못했습니다.")); }, [load]);
  useEffect(() => {
    if (!detail) return;
    void QRCode.toDataURL(detail.qrValue, { width: 200, margin: 1, errorCorrectionLevel: "M" }).then(setQrData).catch(() => setError("QR을 생성하지 못했습니다."));
  }, [detail]);

  const validationErrors = useMemo(() => detail?.components.flatMap((component) => {
    const errors: string[] = [];
    if (component.traceabilityRequired && !component.traceabilityNo) errors.push(`${component.componentName}: 이력번호 필요`);
    if (component.weightRequired && (!component.weightG || component.weightG <= 0)) errors.push(`${component.componentName}: 중량 필요`);
    if (component.originRequired && !component.origin) errors.push(`${component.componentName}: 원산지 필요`);
    if (component.slaughterhouseRequired && !component.slaughterhouse) errors.push(`${component.componentName}: 도축장 필요`);
    return errors;
  }) ?? [], [detail]);

  async function patch(body: object) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/workshop/packages/${encodeURIComponent(packageCode)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { package?: WorkshopPackageDetail; label?: LabelPreview; version?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "저장하지 못했습니다.");
      if (data.package) {
        setDetail(data.package);
        setWeights(Object.fromEntries(data.package.components.map((component) => [component.id, component.weightG ? String(component.weightG) : ""])));
      }
      if (data.label) { setLabel(data.label); setNotice(`라벨 미리보기 v${data.version}을 저장했습니다.`); }
      return data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장하지 못했습니다.");
      throw caught;
    } finally { setBusy(false); }
  }

  async function applyTraceability(rawScan = scan, source: "manual" | "hid" | "recent" = "manual") {
    try {
      await patch({ action: "apply_traceability", rawScan, componentIds: selected, origin, slaughterhouse, cattleType, grade, source });
      setScan("");
      setNotice(`${selected.length}개 구성품에 이력번호를 적용했습니다.`);
    } catch { /* 화면 오류로 안내 */ }
  }

  async function saveWeight(componentId: string) {
    const weightG = Number(weights[componentId]);
    try { await patch({ action: "update_weight", componentId, weightG }); setNotice("중량을 저장했습니다."); } catch { /* 화면 오류로 안내 */ }
  }

  if (!detail) return <div className="package-page"><header className="workshop-header"><a href="/workshop" className="workshop-brand"><b>正</b><span>정일품 작업장<small>PACKAGE TRACEABILITY</small></span></a><AppNav current="workshop" /></header><main className="package-loading">{error || "패키지 정보를 불러오는 중…"}</main></div>;

  return <div className="package-page">
    <header className="workshop-header"><a href="/workshop" className="workshop-brand"><b>正</b><span>정일품 작업장<small>PACKAGE TRACEABILITY</small></span></a><AppNav current="workshop" /></header>
    <main className="package-main">
      <nav className="package-breadcrumb"><a href="/workshop">← 작업장으로</a><span>{detail.orderNo}</span></nav>
      <section className="package-hero">
        <div><small>PACKAGE</small><h1>{detail.packageCode}</h1><p>{detail.productName} · {detail.schedule}</p><b>{detail.packageStatus}</b>{detail.labelActionRequired && <strong>기존 라벨 폐기·재출력 필요</strong>}</div>
        {qrData && <figure><Image src={qrData} width={200} height={200} alt={`${detail.packageCode} 내부 상세 QR`} unoptimized /><figcaption>개인정보 없는 내부 패키지 링크</figcaption></figure>}
      </section>

      {error && <div className="package-message error" role="alert">{error}</div>}
      {notice && <div className="package-message" role="status">{notice}</div>}

      <section className="package-panel">
        <header><div><small>TRACEABILITY</small><h2>구성품 이력번호</h2></div><p>선택한 여러 구성품에 같은 이력번호를 한 번에 적용할 수 있습니다.</p></header>
        <div className="trace-entry">
          <label><span>이력번호 스캔·직접입력</span><input autoFocus inputMode="numeric" value={scan} onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void applyTraceability(scan, "hid"); } }} placeholder="숫자 입력 후 Enter" /></label>
          <label><span>원산지 (선택)</span><input value={origin} onChange={(event) => setOrigin(event.target.value)} /></label>
          <label><span>도축장 (선택)</span><input value={slaughterhouse} onChange={(event) => setSlaughterhouse(event.target.value)} /></label><label><span>축종 (선택)</span><input value={cattleType} onChange={(event) => setCattleType(event.target.value)} /></label><label><span>등급 (선택)</span><input value={grade} onChange={(event) => setGrade(event.target.value)} /></label>
          <button disabled={busy || !selected.length || !scan.trim()} onClick={() => void applyTraceability()}>선택 구성품에 적용</button>
        </div>
        {detail.recentTraceability.length > 0 && <div className="recent-traces"><span>최근 사용</span>{detail.recentTraceability.map((item) => <button key={item.traceabilityNo} onClick={() => { setOrigin(item.origin); setSlaughterhouse(item.slaughterhouse); setCattleType(item.cattleType); setGrade(item.grade); void applyTraceability(item.traceabilityNo, "recent"); }}>{item.traceabilityNo}</button>)}</div>}
        <div className="package-components">
          {detail.components.length ? detail.components.map((component) => <article key={component.id}>
            <label className="component-select"><input type="checkbox" checked={selected.includes(component.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, component.id])] : current.filter((id) => id !== component.id))} /><b>{component.componentName}</b></label>
            <p><span>이력번호</span><strong>{component.traceabilityNo || "미입력"}</strong></p>
            <p><span>원산지 / 도축장</span><strong>{component.origin || "-"} / {component.slaughterhouse || "-"}</strong><small>{component.cattleType || "축종 미입력"} · {component.grade || "등급 미입력"}</small></p>
            <label className="weight-entry"><span>중량(g)</span><input type="number" min="1" step="1" value={weights[component.id] ?? ""} onChange={(event) => setWeights((current) => ({ ...current, [component.id]: event.target.value }))} /><button disabled={busy} onClick={() => void saveWeight(component.id)}>저장</button></label>
          </article>) : <p className="package-empty">이 상품에 등록된 구성품 템플릿이 없습니다. 상품 구성 확정 후 설정이 필요합니다.</p>}
        </div>
      </section>

      <section className="package-panel label-foundation">
        <header><div><small>OPEN LABEL CSV</small><h2>라벨 미리보기</h2></div><p>다구성 세트 1장을 위한 wide 형식 CSV입니다.</p></header>
        {validationErrors.length > 0 && <div className="label-validation"><b>라벨 전 필수 확인</b><ul>{validationErrors.map((value) => <li key={value}>{value}</li>)}</ul></div>}
        <div className="label-actions"><button disabled={busy || validationErrors.length > 0 || !detail.components.length} onClick={() => void patch({ action: "preview_label" })}>라벨 미리보기 생성</button><a className={validationErrors.length || !detail.components.length ? "disabled" : ""} aria-disabled={Boolean(validationErrors.length || !detail.components.length)} href={validationErrors.length || !detail.components.length ? undefined : `/api/workshop/packages/${encodeURIComponent(packageCode)}/csv`}>CSV 내보내기</a></div>
        {label && <div className="label-preview"><small>정일품 작업 라벨</small><h3>{label.productName}</h3><b>{label.packageCode}</b><p>{label.orderNo} · {label.schedule}</p>{label.components.map((component) => <div key={component.name}><span>{component.name}</span><strong>{component.weightG}g</strong><code>{component.traceabilityNo}</code><small>{component.cattleType || "-"} · {component.grade || "-"}</small></div>)}</div>}
        {detail.labels.length > 0 && <div className="label-history"><h3>라벨 이력</h3>{detail.labels.map((item) => <p key={item.version}><b>v{item.version}</b><span>{item.status}</span><time>{new Date(item.createdAt).toLocaleString("ko-KR")}</time></p>)}</div>}
        {detail.auditEvents.length > 0 && <div className="label-history"><h3>패키지 작업 이력</h3>{detail.auditEvents.map((item) => <p key={item.id}><b>{item.type}</b><time>{new Date(item.createdAt).toLocaleString("ko-KR")}</time></p>)}</div>}
      </section>
    </main>
  </div>;
}

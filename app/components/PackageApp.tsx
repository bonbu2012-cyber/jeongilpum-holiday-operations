"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import type { WorkshopPackageDetail } from "../lib/package-types";
import AppNav from "./AppNav";
import "../workshop-flow.css";

type LabelPreview = { packageCode: string; productName: string; qrValue: string; skinPacks: Array<{ skinPackCode: string; cutName: string }> };

export default function PackageApp({ packageCode }: { packageCode: string }) {
  const [detail, setDetail] = useState<WorkshopPackageDetail | null>(null);
  const [qrData, setQrData] = useState("");
  const [label, setLabel] = useState<LabelPreview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/workshop/packages/${encodeURIComponent(packageCode)}`, { cache: "no-store" });
    const data = await response.json() as { package?: WorkshopPackageDetail; error?: string };
    if (!response.ok || !data.package) throw new Error(data.error || "패키지 정보를 불러오지 못했습니다.");
    setDetail(data.package);
    setError("");
  }, [packageCode]);

  useEffect(() => { const frame = requestAnimationFrame(() => void load().catch((caught) => setError(caught instanceof Error ? caught.message : "패키지 정보를 불러오지 못했습니다."))); return () => cancelAnimationFrame(frame); }, [load]);
  useEffect(() => { if (detail) void QRCode.toDataURL(detail.qrValue, { width: 200, margin: 1, errorCorrectionLevel: "M" }).then(setQrData).catch(() => setError("QR을 생성하지 못했습니다.")); }, [detail]);

  async function previewLabel() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/workshop/packages/${encodeURIComponent(packageCode)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview_label" }) });
      const data = await response.json() as { label?: LabelPreview; version?: number; error?: string };
      if (!response.ok || !data.label) throw new Error(data.error || "라벨 미리보기를 저장하지 못했습니다.");
      setLabel(data.label); setNotice(`외부 패키지 라벨 미리보기 v${data.version}을 저장했습니다.`); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "라벨 미리보기를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  if (!detail) return <div className="package-page"><header className="workshop-header"><a href="/workshop" className="workshop-brand"><Image className="operations-brand-logo" src="/jeongilpum-logo.png" alt="정일품 정육식당 로고" width={46} height={46}/><span>정일품 작업장<small>ASSEMBLED PACKAGE</small></span></a></header><AppNav current="workshop" /><main className="package-loading">{error || "패키지 정보를 불러오는 중…"}</main></div>;

  return <div className="package-page">
    <header className="workshop-header"><a href="/workshop" className="workshop-brand"><Image className="operations-brand-logo" src="/jeongilpum-logo.png" alt="정일품 정육식당 로고" width={46} height={46}/><span>정일품 작업장<small>ASSEMBLED PACKAGE</small></span></a></header>
    <AppNav current="workshop" />
    <main className="package-main">
      <nav className="package-breadcrumb"><a href="/workshop">← 작업장으로</a><a href="/workshop/production">생산 배치</a><span>{detail.orderNo}</span></nav>
      <section className="package-hero">
        <div><small>ASSEMBLED GIFT SET</small><h1>{detail.packageCode}</h1><p>{detail.productName} · {detail.schedule}</p><b>{detail.packageStatus}</b>{detail.labelActionRequired && <strong>기존 라벨 폐기·재출력 필요</strong>}</div>
        {qrData && <figure><Image src={qrData} width={200} height={200} alt={`${detail.packageCode} 내부 상세 QR`} unoptimized /><figcaption>고객 개인정보 없는 내부 패키지 QR</figcaption></figure>}
      </section>
      {error && <div className="package-message error" role="alert">{error}</div>}
      {notice && <div className="package-message" role="status">{notice}</div>}
      <section className="package-panel">
        <header><div><small>ASSIGNED SKIN PACKS</small><h2>조립 구성 스킨팩</h2></div><p>생산 배치에서 완성된 개별 팩을 BOM 순서대로 조립한 결과입니다.</p></header>
        <div className="package-components">
          {detail.skinPacks.map((pack) => <article key={pack.id}>
            <div><b>{pack.componentName}</b><small>{pack.skinPackCode}</small></div>
            <p><span>중량</span><strong>{pack.weightG.toLocaleString()}g</strong></p>
            <p><span>이력번호</span><strong>{pack.traceabilityNo}</strong><small>{pack.origin || "원산지 미입력"} · {pack.grade || "등급 미입력"}</small></p>
            <p><span>생산일시</span><strong>{new Date(pack.manufacturedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</strong><small>{pack.storageMethod || "보관방법 미설정"}</small></p>
          </article>)}
          {!detail.skinPacks.length && <p className="package-empty">이 패키지에 배정된 스킨팩이 없습니다.</p>}
        </div>
      </section>
      <section className="package-panel label-foundation">
        <header><div><small>PACKAGE QR LABEL</small><h2>외부 패키지 라벨</h2></div><p>스킨팩별 라벨과 분리된 선물세트 외부 QR 라벨입니다.</p></header>
        <div className="label-actions"><button disabled={busy || !detail.skinPacks.length} onClick={() => void previewLabel()}>{busy ? "저장 중…" : "라벨 미리보기 생성"}</button><a className={!detail.skinPacks.length ? "disabled" : ""} href={detail.skinPacks.length ? `/api/workshop/packages/${encodeURIComponent(packageCode)}/csv` : undefined}>스킨팩 long CSV</a></div>
        {label && <div className="label-preview"><small>정일품 선물세트</small><h3>{label.productName}</h3><b>{label.packageCode}</b>{label.skinPacks.map((pack) => <div key={pack.skinPackCode}><span>{pack.cutName}</span><code>{pack.skinPackCode}</code></div>)}</div>}
        {detail.labels.length > 0 && <div className="label-history"><h3>라벨 이력</h3>{detail.labels.map((item) => <p key={item.version}><b>v{item.version}</b><span>{item.status}</span><time>{new Date(item.createdAt).toLocaleString("ko-KR")}</time></p>)}</div>}
        {detail.assignmentHistory.length > 0 && <div className="label-history"><h3>배정 이력</h3>{detail.assignmentHistory.map((item) => <p key={item.id}><b>{item.reason}</b><span>{item.fromOrderNo || "최초 조립"} → {item.toOrderNo}</span><time>{new Date(item.changedAt).toLocaleString("ko-KR")}</time></p>)}</div>}
      </section>
    </main>
  </div>;
}
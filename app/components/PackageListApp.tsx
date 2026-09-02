"use client";

import { PackageSearch } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { DataTableColumn } from "../ui";
import { Badge, Button, DataTable, useResource } from "../ui";
import AppNav from "./AppNav";
import "../workshop-flow.css";

type PackageSummary = {
  id: string;
  packageCode: string;
  productName: string;
  packageStatus: string;
  workItemId: string | null;
  orderNo: string | null;
  schedule: string;
};

export default function PackageListApp() {
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [error, setError] = useState("");
  const {
    loading,
    reload,
  } = useResource<{ packages?: PackageSummary[] }>("/api/workshop/packages", 2500, {
    onData: (data) => {
      setPackages(data.packages ?? []);
      setError("");
    },
    onError: (resourceError) => setError(resourceError.message || "패키지 목록을 불러오지 못했습니다."),
  });
  const columns: DataTableColumn<PackageSummary>[] = [
    {
      id: "code",
      header: "패키지 코드",
      cell: (item) => <strong>{item.packageCode}</strong>,
      sortValue: (item) => item.packageCode,
    },
    {
      id: "product",
      header: "상품",
      cell: (item) => item.productName,
      sortValue: (item) => item.productName,
    },
    {
      id: "schedule",
      header: "연결 작업",
      cell: (item) => item.schedule,
      sortValue: (item) => item.schedule,
    },
    {
      id: "status",
      header: "상태",
      cell: (item) => <Badge tone={item.packageStatus === "completed" ? "success" : "neutral"}>{item.packageStatus}</Badge>,
      sortValue: (item) => item.packageStatus,
    },
  ];

  return (
    <div className="workshop-app">
      <header className="workshop-header">
        <a href="/workshop" className="workshop-brand">
          <Image className="operations-brand-logo" src="/jeongilpum-logo.png" alt="정일품 정육식당 로고" width={46} height={46} />
          <span>정일품 작업장<small>PACKAGE LIST</small></span>
        </a>
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => void reload()} leadingIcon={<PackageSearch size={16} />}>
          {loading ? "조회 중" : "새로고침"}
        </Button>
      </header>
      <AppNav current="workshop" />
      <main className="workshop-main">
        <section className="whiteboard-section">
          <header>
            <div><small>OPTIONAL OPERATIONS</small><h1>패키지</h1></div>
            <a href="/workshop">작업장으로</a>
          </header>
          {error ? <div className="package-message error" role="alert">{error}</div> : null}
          <DataTable
            ariaLabel="패키지 목록"
            rows={packages}
            columns={columns}
            getRowId={(item) => item.id}
            initialSort={{ columnId: "code", direction: "desc" }}
            onRowClick={(item) => { window.location.href = `/workshop/packages/${encodeURIComponent(item.packageCode)}`; }}
            emptyMessage="등록된 패키지가 없습니다."
          />
        </section>
      </main>
    </div>
  );
}

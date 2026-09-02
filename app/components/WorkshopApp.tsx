"use client";

import {
  ClipboardList,
  Factory,
  Package,
  Route,
  ScanLine,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { ReactNode } from "react";
import type { DataTableColumn, StatTile } from "../ui";
import {
  Badge,
  Button,
  DataTable,
  FieldInput,
  FieldSelect,
  Modal,
  StatTiles,
  Tabs,
  Toolbar,
  useResource,
} from "../ui";
import {
  WORK_STATUS_OPTIONS,
  workStatusLabel,
  type WorkStatus,
} from "../lib/work-status";
import AppNav from "./AppNav";
import "../workshop-flow.css";

type WorkItem = {
  id: string;
  orderId: string;
  orderNo: string;
  productId: string;
  productName: string;
  quantity: number;
  deliveryMethod: "onsite_reservation" | "delivery";
  dueAt: string;
  workStatus: WorkStatus;
  note: string;
  address: string;
  version: number;
  events: Array<{
    id: string;
    type: string;
    fromValue: string | null;
    toValue: string | null;
    createdAt: string;
  }>;
};

type ProductTotal = {
  productId: string;
  productName: string;
  totalQuantity: number;
  completedQuantity: number;
  pendingQuantity: number;
  dailyLimit: number | null;
};

type WorkshopResponse = {
  onsite?: WorkItem[];
  delivery?: WorkItem[];
  products?: ProductTotal[];
};

type WorkshopTab = "onsite" | "delivery";

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

function formatTime(value: string) {
  return value.slice(11, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T12:00:00+09:00`));
}

function statusTone(status: WorkStatus) {
  if (status === "ready" || status === "completed") return "success" as const;
  if (status === "in_progress") return "info" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "confirmed") return "warning" as const;
  return "neutral" as const;
}

function historyLabel(type: string) {
  if (type.startsWith("work_status_changed:")) return "작업 상태 변경";
  if (type === "work_item_created") return "작업 생성";
  return type;
}

function productTiles(products: ProductTotal[]): StatTile[] {
  return products.map((product) => ({
    id: product.productId,
    label: product.productName,
    value: `${product.pendingQuantity.toLocaleString()}개`,
    detail: product.dailyLimit !== null && product.totalQuantity > product.dailyLimit
      ? `일일 한도 ${product.dailyLimit.toLocaleString()}개 초과`
      : "남은 작업",
    subtotals: [
      { label: "전체", value: `${product.totalQuantity.toLocaleString()}개` },
      { label: "완료", value: `${product.completedQuantity.toLocaleString()}개` },
    ],
    tone: product.dailyLimit !== null && product.totalQuantity > product.dailyLimit ? "attention" : undefined,
  }));
}

export default function WorkshopApp() {
  const [date, setDate] = useState(todayInSeoul);
  const [tab, setTab] = useState<WorkshopTab>("onsite");
  const [onsite, setOnsite] = useState<WorkItem[]>([]);
  const [delivery, setDelivery] = useState<WorkItem[]>([]);
  const [products, setProducts] = useState<ProductTotal[]>([]);
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<WorkStatus>("received");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const { reload } = useResource<WorkshopResponse>(
    `/api/workshop/orders?date=${encodeURIComponent(date)}`,
    2500,
    {
      onData: (data) => {
        const nextOnsite = data.onsite ?? [];
        const nextDelivery = data.delivery ?? [];
        setOnsite(nextOnsite);
        setDelivery(nextDelivery);
        setProducts(data.products ?? []);
        setSelected((current) => {
          if (!current) return null;
          return [...nextOnsite, ...nextDelivery].find((item) => item.id === current.id) ?? null;
        });
        setError("");
      },
      onError: (resourceError) => setError(resourceError.message || "작업 목록을 불러오지 못했습니다."),
    },
  );

  const openDetail = (item: WorkItem) => {
    setSelected(item);
    setSelectedStatus(item.workStatus);
  };

  const updateStatus = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workshop/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workItemId: selected.id,
          status: selectedStatus,
          expectedVersion: selected.version,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json() as { error?: string; alreadyApplied?: boolean };
      if (!response.ok) throw new Error(data.error || "작업 상태를 변경하지 못했습니다.");
      setNotice(data.alreadyApplied ? "같은 변경 요청이 이미 반영되었습니다." : "작업 상태를 저장했습니다.");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "작업 상태를 변경하지 못했습니다.");
      await reload({ silent: true });
    } finally {
      setBusy(false);
    }
  };

  const onsiteColumns: DataTableColumn<WorkItem>[] = [
    {
      id: "time",
      header: "예약 시각",
      cell: (item) => <strong>{formatTime(item.dueAt)}</strong>,
      sortValue: (item) => item.dueAt,
      width: "112px",
    },
    {
      id: "product",
      header: "상품",
      cell: (item) => <span>{item.productName}</span>,
      sortValue: (item) => item.productName,
    },
    {
      id: "quantity",
      header: "수량",
      cell: (item) => <strong>{item.quantity.toLocaleString()}개</strong>,
      sortValue: (item) => item.quantity,
      align: "right",
      width: "96px",
    },
    {
      id: "status",
      header: "작업 상태",
      cell: (item) => <Badge tone={statusTone(item.workStatus)}>{workStatusLabel(item.workStatus)}</Badge>,
      sortValue: (item) => item.workStatus,
      width: "132px",
    },
  ];

  const deliveryColumns: DataTableColumn<WorkItem>[] = [
    {
      id: "product",
      header: "상품",
      cell: (item) => <span>{item.productName}</span>,
      sortValue: (item) => item.productName,
    },
    {
      id: "quantity",
      header: "수량",
      cell: (item) => <strong>{item.quantity.toLocaleString()}개</strong>,
      sortValue: (item) => item.quantity,
      align: "right",
      width: "96px",
    },
    {
      id: "address",
      header: "배송지",
      cell: (item) => item.address || "주소 미입력",
      sortValue: (item) => item.address,
    },
    {
      id: "status",
      header: "작업 상태",
      cell: (item) => <Badge tone={statusTone(item.workStatus)}>{workStatusLabel(item.workStatus)}</Badge>,
      sortValue: (item) => item.workStatus,
      width: "132px",
    },
  ];

  const tabItems = [
    { id: "onsite", label: "현장", count: onsite.length },
    { id: "delivery", label: "택배", count: delivery.length },
  ];

  const activeRows = tab === "onsite" ? onsite : delivery;
  const activeColumns = tab === "onsite" ? onsiteColumns : deliveryColumns;

  return (
    <div className="workshop-app">
      <header className="workshop-header">
        <a href="/workshop" className="workshop-brand">
          <Image className="operations-brand-logo" src="/jeongilpum-logo.png" alt="정일품 정육식당 로고" width={46} height={46} />
          <span>정일품 작업장</span>
        </a>
      </header>
      <AppNav current="workshop" />

      <main className="workshop-main">
        <section className="workshop-date-toolbar" aria-label="작업 기준일 선택">
          <Toolbar>
            <h1>{formatDate(date)} 작업</h1>
            <FieldInput
              id="workshop-date"
              className="workshop-date-field"
              label="작업일"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Toolbar>
        </section>

        {error ? <section className="workshop-message workshop-message--error" role="alert">{error}</section> : null}
        {notice ? <section className="workshop-message" role="status">{notice}</section> : null}

        <section className="workshop-product-summary" aria-labelledby="workshop-product-summary-title">
          <h2 id="workshop-product-summary-title">상품별 작업량</h2>
          {products.length ? (
            <StatTiles ariaLabel="상품별 작업 수량" tiles={productTiles(products)} />
          ) : <p className="workshop-empty">집계할 상품 작업이 없습니다.</p>}
        </section>

        <div className="workshop-tab-bar">
          <Tabs
            ariaLabel="작업장 보기"
            items={tabItems}
            value={tab}
            onValueChange={(value) => setTab(value as WorkshopTab)}
          />
        </div>

        <section className="workshop-work-list">
          <DataTable
            key={tab}
            ariaLabel={tab === "onsite" ? "현장 작업" : "택배 작업"}
            rows={activeRows}
            columns={activeColumns}
            getRowId={(item) => item.id}
            onRowClick={openDetail}
            initialSort={tab === "onsite" ? { columnId: "time" } : { columnId: "product" }}
            emptyMessage={tab === "onsite" ? "현장 작업이 없습니다." : "택배 작업이 없습니다."}
          />
        </section>

        <nav className="workshop-utility-links" aria-label="작업장 부가 기능">
          <UtilityLink href="/workshop/production" icon={<Factory size={18} />} label="생산관리" />
          <UtilityLink href="/workshop/production#skin-packs" icon={<Package size={18} />} label="스킨팩" />
          <UtilityLink href="/workshop/production#traceability" icon={<ScanLine size={18} />} label="이력추적" />
          <UtilityLink href="/workshop/packages" icon={<Route size={18} />} label="패키지" />
        </nav>
      </main>

      <Modal
        open={Boolean(selected)}
        title={selected ? `${selected.productName} · ${selected.quantity.toLocaleString()}개` : ""}
        description={selected ? `${selected.orderNo} · ${selected.deliveryMethod === "delivery" ? "택배" : `${formatTime(selected.dueAt)} 현장 예약`}` : ""}
        onClose={() => setSelected(null)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>닫기</Button>
            <Button disabled={busy || !selected} onClick={() => void updateStatus()} leadingIcon={<ClipboardList size={16} />}>
              {busy ? "저장 중" : "작업 상태 저장"}
            </Button>
          </>
        )}
      >
        {selected ? (
          <div className="workshop-detail-content">
            <div className="workshop-detail-grid">
              <p><span>수령방법</span><strong>{selected.deliveryMethod === "delivery" ? "택배" : "현장 예약"}</strong></p>
              <p><span>작업 시각</span><strong>{selected.deliveryMethod === "delivery" ? selected.dueAt.slice(0, 10) : `${selected.dueAt.slice(0, 10)} ${formatTime(selected.dueAt)}`}</strong></p>
              {selected.deliveryMethod === "delivery" ? <p><span>배송지</span><strong>{selected.address || "주소 미입력"}</strong></p> : null}
            </div>
            <FieldSelect
              id={`work-status-${selected.id}`}
              className="workshop-status-field"
              label="작업 상태"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as WorkStatus)}
            >
              {WORK_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{workStatusLabel(status)}</option>
              ))}
            </FieldSelect>
            {selected.note ? <section className="workshop-detail-note"><h3>작업 요청사항</h3><p>{selected.note}</p></section> : null}
            <section className="workshop-detail-history">
              <h3>작업 이력</h3>
              {selected.events.length ? (
                <ol>
                  {selected.events.map((event) => (
                    <li key={event.id}>
                      <strong>{historyLabel(event.type)}</strong>
                      <time>{new Date(event.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</time>
                    </li>
                  ))}
                </ol>
              ) : <p>표시할 작업 이력이 없습니다.</p>}
            </section>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function UtilityLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a href={href}>
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

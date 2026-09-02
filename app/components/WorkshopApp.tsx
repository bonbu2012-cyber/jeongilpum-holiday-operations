"use client";

import {
  ClipboardList,
  Factory,
  Package,
  RefreshCw,
  Route,
  ScanLine,
} from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import type { DataTableColumn } from "../ui";
import {
  Badge,
  Button,
  DataTable,
  FieldInput,
  FieldSelect,
  Modal,
  Tabs,
  useResource,
} from "../ui";
import AppNav from "./AppNav";
import "../workshop-flow.css";

type WorkStatus = "received" | "confirmed" | "in_progress" | "ready" | "completed" | "cancelled";
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
type WorkshopTab = "onsite" | "delivery" | "products" | "tools";

const statuses: Array<{ value: WorkStatus; label: string }> = [
  { value: "received", label: "접수" },
  { value: "confirmed", label: "확인" },
  { value: "in_progress", label: "작업중" },
  { value: "ready", label: "준비완료" },
  { value: "completed", label: "수령완료" },
  { value: "cancelled", label: "취소" },
];

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

function statusLabel(status: WorkStatus) {
  return statuses.find((item) => item.value === status)?.label ?? status;
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
  const {
    loading,
    reload,
  } = useResource<WorkshopResponse>(
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
      cell: (item) => <Badge tone={statusTone(item.workStatus)}>{statusLabel(item.workStatus)}</Badge>,
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
      cell: (item) => <Badge tone={statusTone(item.workStatus)}>{statusLabel(item.workStatus)}</Badge>,
      sortValue: (item) => item.workStatus,
      width: "132px",
    },
  ];

  const productColumns: DataTableColumn<ProductTotal>[] = [
    {
      id: "product",
      header: "상품",
      cell: (item) => (
        <span>
          {item.productName}
          {item.dailyLimit !== null && item.totalQuantity > item.dailyLimit
            ? <Badge tone="warning">일일 한도 초과</Badge>
            : null}
        </span>
      ),
      sortValue: (item) => item.productName,
    },
    {
      id: "total",
      header: "총 수량",
      cell: (item) => <strong>{item.totalQuantity.toLocaleString()}개</strong>,
      sortValue: (item) => item.totalQuantity,
      align: "right",
      width: "112px",
    },
    {
      id: "completed",
      header: "완료",
      cell: (item) => `${item.completedQuantity.toLocaleString()}개`,
      sortValue: (item) => item.completedQuantity,
      align: "right",
      width: "96px",
    },
    {
      id: "pending",
      header: "남은 작업",
      cell: (item) => <strong>{item.pendingQuantity.toLocaleString()}개</strong>,
      sortValue: (item) => item.pendingQuantity,
      align: "right",
      width: "112px",
    },
  ];

  const tabItems = [
    { id: "onsite", label: "오늘 현장", count: onsite.length },
    { id: "delivery", label: "택배", count: delivery.length },
    { id: "products", label: "상품별", count: products.length },
    { id: "tools", label: "부가 기능" },
  ];

  return (
    <div className="workshop-app">
      <header className="workshop-header">
        <a href="/workshop" className="workshop-brand">
          <Image className="operations-brand-logo" src="/jeongilpum-logo.png" alt="정일품 정육식당 로고" width={46} height={46} />
          <span>정일품 작업장<small>WORK ITEM BOARD</small></span>
        </a>
        <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading} leadingIcon={<RefreshCw size={16} />}>
          {loading ? "동기화 중" : "새로고침"}
        </Button>
      </header>
      <AppNav current="workshop" />

      <main className="workshop-main">
        <section className="workshop-date-toolbar" aria-label="작업 기준일 선택">
          <div>
            <small>WORK ITEM SCHEDULE</small>
            <h1>{formatDate(date)} 작업</h1>
            <span>현장 예약과 택배 작업은 독립된 패널에서 관리합니다.</span>
          </div>
          <FieldInput
            id="workshop-date"
            label="작업일"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </section>

        {error ? <section className="package-message error" role="alert">{error}</section> : null}
        {notice ? <section className="package-message" role="status">{notice}</section> : null}

        <Tabs
          ariaLabel="작업장 탭"
          items={tabItems}
          value={tab}
          onValueChange={(value) => setTab(value as WorkshopTab)}
        />

        {tab === "onsite" ? (
          <section className="whiteboard-section">
            <header>
              <div>
                <small>ONSITE RESERVATION</small>
                <h2>오늘 현장 예약</h2>
              </div>
              <Badge tone="info">예약 시각 오름차순</Badge>
            </header>
            <DataTable
              ariaLabel="오늘 현장 예약 작업"
              rows={onsite}
              columns={onsiteColumns}
              getRowId={(item) => item.id}
              onRowClick={openDetail}
              initialSort={{ columnId: "time" }}
              emptyMessage="오늘 현장 예약 작업이 없습니다."
            />
          </section>
        ) : null}

        {tab === "delivery" ? (
          <section className="whiteboard-section workshop-delivery-panel">
            <header>
              <div>
                <small>DELIVERY</small>
                <h2>오늘 택배</h2>
              </div>
              <Badge tone="warning">현장 예약과 별도 관리</Badge>
            </header>
            <DataTable
              ariaLabel="오늘 택배 작업"
              rows={delivery}
              columns={deliveryColumns}
              getRowId={(item) => item.id}
              onRowClick={openDetail}
              initialSort={{ columnId: "product" }}
              emptyMessage="오늘 택배 작업이 없습니다."
            />
          </section>
        ) : null}

        {tab === "products" ? (
          <section className="whiteboard-section">
            <header>
              <div>
                <small>PRODUCT TOTALS</small>
                <h2>상품별 작업 수량</h2>
              </div>
              <span>일일 한도 초과는 경고로만 표시하며 작업자 수정을 차단하지 않습니다.</span>
            </header>
            <DataTable
              ariaLabel="상품별 작업 수량"
              rows={products}
              columns={productColumns}
              getRowId={(item) => item.productId}
              initialSort={{ columnId: "pending", direction: "desc" }}
              emptyMessage="오늘 집계할 상품 작업이 없습니다."
            />
          </section>
        ) : null}

        {tab === "tools" ? (
          <section className="whiteboard-section workshop-tools-panel">
            <header>
              <div>
                <small>OPTIONAL OPERATIONS</small>
                <h2>부가 기능</h2>
              </div>
              <span>생산·스킨팩·이력추적·패키지는 작업 항목 조회와 독립적으로 운영합니다.</span>
            </header>
            <div className="workshop-tools-grid">
              <ToolLink href="/workshop/production" icon={<Factory size={22} />} title="생산관리" detail="작업 수요와 생산 batch를 확인합니다." />
              <ToolLink href="/workshop/production#skin-packs" icon={<Package size={22} />} title="스킨팩" detail="생산 batch에서 스킨팩을 등록합니다." />
              <ToolLink href="/workshop/production#traceability" icon={<ScanLine size={22} />} title="이력추적" detail="이력번호와 생산 정보를 관리합니다." />
              <ToolLink href="/workshop/packages" icon={<Route size={22} />} title="패키지" detail="작업 항목에 연결된 패키지를 조회합니다." />
            </div>
          </section>
        ) : null}
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
              <p><span>수령방법</span><b>{selected.deliveryMethod === "delivery" ? "택배" : "현장 예약"}</b></p>
              <p><span>작업 시각</span><b>{selected.deliveryMethod === "delivery" ? selected.dueAt.slice(0, 10) : `${selected.dueAt.slice(0, 10)} ${formatTime(selected.dueAt)}`}</b></p>
              {selected.deliveryMethod === "delivery" ? <p><span>배송지</span><b>{selected.address || "주소 미입력"}</b></p> : null}
            </div>
            <FieldSelect
              id={`work-status-${selected.id}`}
              label="작업 상태"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as WorkStatus)}
              hint="모든 상태값을 선택할 수 있으며 완료 상태도 다시 변경할 수 있습니다."
            >
              {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </FieldSelect>
            {selected.note ? <section className="workshop-detail-note"><h3>작업 요청사항</h3><p>{selected.note}</p></section> : null}
            <section className="workshop-detail-history">
              <h3>작업 이력</h3>
              {selected.events.length ? (
                <ol>
                  {selected.events.map((event) => (
                    <li key={event.id}>
                      <b>{historyLabel(event.type)}</b>
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

function ToolLink({ href, icon, title, detail }: { href: string; icon: ReactNode; title: string; detail: string }) {
  return (
    <a className="workshop-tool-link" href={href}>
      <span aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <small>{detail}</small>
    </a>
  );
}

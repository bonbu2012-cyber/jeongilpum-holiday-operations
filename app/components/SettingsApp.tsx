/* eslint-disable @next/next/no-img-element */
"use client";

import { RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import AppNav from "./AppNav";
import {
  Badge,
  Button,
  DataTable,
  Field,
  FieldInput,
  FieldSelect,
  FieldTextarea,
  Modal,
  Toolbar,
  useResource,
  type DataTableColumn,
} from "../ui";

const PRODUCT_CATEGORIES = ["진공세트", "프리미엄", "O'meat", "LA갈비", "뼈세트", "맞춤주문"];

type CatalogProduct = {
  id: string;
  category: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  customerDisplayWeight: string | null;
  imageUrl: string | null;
  badge: string | null;
  dailyLimit: number | null;
  reservedQuantity: number;
};

type CatalogResponse = {
  products?: CatalogProduct[];
};

type ProductRevision = {
  id: string;
  active: boolean;
  imageUrl: string | null;
  sortOrder: number;
  version: string;
};

type ProductRecord = {
  id: string;
  category: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  displayWeight: string | null;
  imageUrl: string | null;
  previewImageUrl: string | null;
  badge: string | null;
  dailyLimit: number | null;
  sortOrder: number;
  active: boolean;
  version: string;
  reservedQuantity: number;
};

type SettingsResponse = {
  productRevisions?: ProductRevision[];
  inactiveProducts?: ProductRecord[];
};

type ProductDraft = {
  category: string;
  name: string;
  subtitle: string;
  description: string;
  price: string;
  displayWeight: string;
  badge: string;
  imageUrl: string;
  sortOrder: string;
  active: boolean;
  dailyLimit: string;
  version: string;
};

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const formattedInteger = (value: number) => value.toLocaleString("ko-KR");

function numericText(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}

function draftFor(product: ProductRecord): ProductDraft {
  return {
    category: product.category,
    name: product.name,
    subtitle: product.subtitle,
    description: product.description,
    price: formattedInteger(product.price),
    displayWeight: product.displayWeight ?? "",
    badge: product.badge ?? "",
    imageUrl: product.imageUrl ?? "",
    sortOrder: String(product.sortOrder),
    active: product.active,
    dailyLimit: product.dailyLimit === null ? "" : String(product.dailyLimit),
    version: product.version,
  };
}

function parsedInteger(value: string) {
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function productRows(catalog: CatalogResponse | null, settings: SettingsResponse | null) {
  const revisions = new Map((settings?.productRevisions ?? []).map((item) => [item.id, item]));
  const activeProducts = (catalog?.products ?? []).flatMap((product) => {
    const revision = revisions.get(product.id);
    if (!revision || !revision.active) return [];
    return [{
      id: product.id,
      category: product.category,
      name: product.name,
      subtitle: product.subtitle,
      description: product.description,
      price: product.price,
      displayWeight: product.customerDisplayWeight,
      imageUrl: revision.imageUrl,
      previewImageUrl: product.imageUrl,
      badge: product.badge,
      dailyLimit: product.dailyLimit,
      sortOrder: revision.sortOrder,
      active: revision.active,
      version: revision.version,
      reservedQuantity: product.reservedQuantity,
    }];
  });
  return [...activeProducts, ...(settings?.inactiveProducts ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ko-KR"));
}

export default function SettingsApp() {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const {
    data: catalog,
    error: catalogError,
    loading: catalogLoading,
    reload: reloadCatalog,
  } = useResource<CatalogResponse>("/api/products", 2500);
  const {
    data: settings,
    error: settingsError,
    loading: settingsLoading,
    reload: reloadSettings,
  } = useResource<SettingsResponse>("/api/settings", 2500);
  const products = productRows(catalog, settings);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visibleProducts = normalizedQuery
    ? products.filter((product) => `${product.name} ${product.category}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery))
    : products;
  const loading = catalogLoading || settingsLoading;
  const error = catalogError ?? settingsError;

  const columns: DataTableColumn<ProductRecord>[] = [
    {
      id: "sort-order",
      header: "노출 순서",
      cell: (product) => product.sortOrder,
      sortValue: (product) => product.sortOrder,
      width: "88px",
      align: "right",
    },
    {
      id: "name",
      header: "이름",
      cell: (product) => <span><b>{product.name}</b>{product.subtitle ? <small className="settings-product-subtitle">{product.subtitle}</small> : null}</span>,
      sortValue: (product) => product.name,
      width: "220px",
    },
    {
      id: "category",
      header: "카테고리",
      cell: (product) => product.category,
      sortValue: (product) => product.category,
      width: "110px",
    },
    {
      id: "price",
      header: "가격",
      cell: (product) => won(product.price),
      sortValue: (product) => product.price,
      width: "115px",
      align: "right",
    },
    {
      id: "daily-limit",
      header: "한정수량",
      cell: (product) => product.dailyLimit === null
        ? <Badge tone="neutral">무제한</Badge>
        : <Badge tone={product.dailyLimit === 0 ? "danger" : "info"}>{product.dailyLimit.toLocaleString("ko-KR")}세트</Badge>,
      sortValue: (product) => product.dailyLimit,
      width: "105px",
      align: "center",
    },
    {
      id: "reserved",
      header: "오늘 예약수량",
      cell: (product) => {
        const overLimit = product.dailyLimit !== null && product.reservedQuantity > product.dailyLimit;
        return <Badge tone={overLimit ? "danger" : product.reservedQuantity ? "warning" : "neutral"}>
          {product.reservedQuantity.toLocaleString("ko-KR")}세트{overLimit ? " 초과" : ""}
        </Badge>;
      },
      sortValue: (product) => product.reservedQuantity,
      width: "125px",
      align: "center",
    },
    {
      id: "active",
      header: "활성 여부",
      cell: (product) => <Badge tone={product.active ? "success" : "neutral"}>{product.active ? "노출" : "숨김"}</Badge>,
      sortValue: (product) => product.active ? 0 : 1,
      width: "90px",
      align: "center",
    },
  ];

  const openEditor = (product: ProductRecord) => {
    setEditing(product);
    setDraft(draftFor(product));
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setDraft(null);
  };

  const updateDraft = <Key extends keyof ProductDraft>(key: Key, value: ProductDraft[Key]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const reload = async () => {
    await Promise.all([reloadCatalog(), reloadSettings()]);
  };

  const save = async () => {
    if (!editing || !draft) return;
    const price = parsedInteger(draft.price);
    const sortOrder = parsedInteger(draft.sortOrder);
    const dailyLimit = draft.dailyLimit.trim() ? parsedInteger(draft.dailyLimit) : null;

    if (price === null || sortOrder === null || (draft.dailyLimit.trim() && dailyLimit === null)) {
      setNotice("가격, 노출 순서, 한정수량은 0 이상의 정수로 입력해주세요.");
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "product",
          id: editing.id,
          expectedVersion: draft.version,
          category: draft.category,
          name: draft.name,
          subtitle: draft.subtitle,
          description: draft.description,
          price,
          displayWeight: draft.displayWeight,
          badge: draft.badge,
          imageUrl: draft.imageUrl,
          sortOrder,
          active: draft.active,
          dailyLimit,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "상품을 저장하지 못했습니다.");
      await reload();
      setEditing(null);
      setDraft(null);
      setNotice(`${draft.name.trim() || editing.name} 상품을 저장했습니다.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "상품을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return <main className="settings-app">
    <header className="settings-header">
      <a href="/settings">
        <img className="settings-brand-logo" src="/jeongilpum-logo.png" alt="정일품 정육식당 로고" />
        <span>정일품 정육식당 설정<small>상품 관리</small></span>
      </a>
    </header>
    <AppNav current="settings" />
    <section className="settings-intro">
      <small>PRODUCT MANAGEMENT</small>
      <h1>상품 관리</h1>
      <p>상품 행을 선택하면 가격, 노출 순서, 키오스크 노출 여부와 한정수량을 바로 수정할 수 있습니다.</p>
    </section>
    <section className="settings-section">
      <Toolbar
        search={{
          value: query,
          onChange: setQuery,
          placeholder: "상품명 또는 카테고리 검색",
          label: "상품 검색",
        }}
        actions={<Button variant="ghost" size="sm" leadingIcon={<RefreshCw />} onClick={() => void reload()} disabled={loading}>새로고침</Button>}
      >
        <span className="settings-table-guide">행을 누르면 상품 수정 팝업이 열립니다.</span>
      </Toolbar>
    </section>
    {loading && !catalog && !settings ? <div className="settings-loading">상품을 불러오고 있습니다.</div> : null}
    {error ? <div className="access-error" role="alert"><b>상품 관리 화면에 연결할 수 없습니다</b><span>{error.message}</span><Button variant="ghost" onClick={() => void reload()}>다시 불러오기</Button></div> : null}
    {!error && (catalog || settings) ? <section className="settings-section">
      <DataTable
        rows={visibleProducts}
        columns={columns}
        getRowId={(product) => product.id}
        onRowClick={openEditor}
        initialSort={{ columnId: "sort-order" }}
        emptyMessage="검색 조건에 맞는 상품이 없습니다."
        ariaLabel="상품 관리 목록"
      />
    </section> : null}
    <Modal
      open={Boolean(editing && draft)}
      title={editing ? `${editing.name} 수정` : "상품 수정"}
      description="한정수량을 비우면 무제한입니다. 0이면 오늘 예약마감으로 표시되며, 수량을 지정하면 남은 수량과 고객 키오스크 주문 상한에 반영됩니다."
      onClose={closeEditor}
      footer={<><Button variant="ghost" onClick={closeEditor} disabled={saving}>취소</Button><Button leadingIcon={<Save />} onClick={() => void save()} disabled={saving}>{saving ? "저장 중" : "저장"}</Button></>}
    >
      {editing && draft ? <div className="editor-grid">
        <FieldInput id="product-name" label="이름" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
        <FieldSelect id="product-category" label="카테고리" value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}>
          {PRODUCT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </FieldSelect>
        <FieldInput id="product-price" label="가격" inputMode="numeric" value={draft.price} onChange={(event) => updateDraft("price", numericText(event.target.value))} />
        <FieldInput id="product-weight" label="중량 (display_weight)" value={draft.displayWeight} onChange={(event) => updateDraft("displayWeight", event.target.value)} placeholder="예: 1.8kg" />
        <FieldInput className="wide" id="product-subtitle" label="부제" value={draft.subtitle} onChange={(event) => updateDraft("subtitle", event.target.value)} />
        <FieldTextarea className="wide" id="product-description" label="설명" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
        <FieldInput id="product-badge" label="뱃지" value={draft.badge} onChange={(event) => updateDraft("badge", event.target.value)} placeholder="예: BEST" />
        <FieldInput id="product-sort-order" label="노출 순서 (sort_order)" inputMode="numeric" value={draft.sortOrder} onChange={(event) => updateDraft("sortOrder", numericText(event.target.value))} />
        <FieldInput
          className="wide"
          id="product-image-url"
          label="이미지 (image_url)"
          value={draft.imageUrl}
          onChange={(event) => updateDraft("imageUrl", event.target.value)}
          placeholder="/products/example.webp 또는 https://..."
        />
        <div className="wide">
          {(draft.imageUrl.trim() || editing.previewImageUrl) ? <img
            src={draft.imageUrl.trim() || editing.previewImageUrl || ""}
            alt={`${draft.name || editing.name} 이미지 미리보기`}
            style={{ width: "100%", maxHeight: 180, objectFit: "cover", border: "1px solid #d2c9bd", borderRadius: 8 }}
          /> : <Badge tone="neutral">표시할 이미지가 없습니다.</Badge>}
        </div>
        <FieldInput
          id="product-daily-limit"
          label="한정수량 (daily_limit)"
          hint="비우면 무제한입니다. 0이면 오늘 예약마감으로 표시됩니다."
          type="number"
          min="0"
          step="1"
          value={draft.dailyLimit}
          onChange={(event) => updateDraft("dailyLimit", event.target.value)}
        />
        <Field id="product-active" label="활성 (active)">
          <span className="settings-toggle">
            <input id="product-active" type="checkbox" checked={draft.active} onChange={(event) => updateDraft("active", event.target.checked)} />
            <span>키오스크에 노출</span>
          </span>
        </Field>
      </div> : null}
    </Modal>
    {notice ? <div className="ops-toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="알림 닫기">×</button></div> : null}
  </main>;
}

/* eslint-disable @next/next/no-img-element */
"use client";

import { ArrowDown, ArrowUp, GripVertical, Save } from "lucide-react";
import { useState } from "react";
import type { DragEvent } from "react";
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
  active: boolean;
  dailyLimit: string;
  version: string;
};

type BulkAction = "daily-limit" | "category" | "active" | null;

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const formattedInteger = (value: number) => value.toLocaleString("ko-KR");

function numericText(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}

function parsedInteger(value: string) {
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
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
    active: product.active,
    dailyLimit: product.dailyLimit === null ? "" : String(product.dailyLimit),
    version: product.version,
  };
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

function orderedProducts(products: ProductRecord[], categoryOrder: Record<string, string[]>) {
  return [...products].sort((left, right) => {
    if (left.category !== right.category) {
      const leftIndex = PRODUCT_CATEGORIES.indexOf(left.category);
      const rightIndex = PRODUCT_CATEGORIES.indexOf(right.category);
      return (leftIndex < 0 ? PRODUCT_CATEGORIES.length : leftIndex) - (rightIndex < 0 ? PRODUCT_CATEGORIES.length : rightIndex)
        || left.category.localeCompare(right.category, "ko-KR");
    }

    const order = categoryOrder[left.category];
    if (order) {
      const leftIndex = order.indexOf(left.id);
      const rightIndex = order.indexOf(right.id);
      return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }

    return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ko-KR");
  });
}

function productGroups(products: ProductRecord[]) {
  const groups = new Map<string, ProductRecord[]>();
  for (const product of products) {
    const group = groups.get(product.category) ?? [];
    group.push(product);
    groups.set(product.category, group);
  }

  return [...groups.entries()].map(([category, rows]) => ({ category, rows }));
}

async function productMutation(payload: Record<string, unknown>) {
  const response = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error ?? "상품 변경을 저장하지 못했습니다.");
}

export default function SettingsApp() {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<Record<string, string[]>>({});
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [bulkDailyLimit, setBulkDailyLimit] = useState("");
  const [bulkCategory, setBulkCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [bulkActive, setBulkActive] = useState<"visible" | "hidden">("visible");
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
  const products = orderedProducts(productRows(catalog, settings), categoryOrder);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visibleProducts = normalizedQuery
    ? products.filter((product) => `${product.name} ${product.subtitle} ${product.category}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery))
    : products;
  const selectedProducts = products.filter((product) => selectedIds.includes(product.id));
  const loading = catalogLoading || settingsLoading;
  const error = catalogError ?? settingsError;

  const reload = async () => {
    await Promise.all([reloadCatalog(), reloadSettings()]);
  };

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

  const persistOrder = async (category: string, rows: ProductRecord[]) => {
    setReordering(true);
    setNotice("");
    try {
      await productMutation({
        type: "product-reorder",
        category,
        items: rows.map((product) => ({ id: product.id, expectedVersion: product.version })),
      });
      await reload();
      setCategoryOrder((current) => {
        const next = { ...current };
        delete next[category];
        return next;
      });
    } catch (caught) {
      setCategoryOrder((current) => {
        const next = { ...current };
        delete next[category];
        return next;
      });
      setNotice(caught instanceof Error ? caught.message : "상품 순서를 저장하지 못했습니다.");
    } finally {
      setReordering(false);
      setDraggedProductId(null);
    }
  };

  const reorderProduct = (category: string, sourceId: string, targetId: string) => {
    if (sourceId === targetId || reordering) return;
    const categoryRows = products.filter((product) => product.category === category);
    const sourceIndex = categoryRows.findIndex((product) => product.id === sourceId);
    const targetIndex = categoryRows.findIndex((product) => product.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextRows = [...categoryRows];
    const [source] = nextRows.splice(sourceIndex, 1);
    nextRows.splice(targetIndex, 0, source);
    setCategoryOrder((current) => ({ ...current, [category]: nextRows.map((product) => product.id) }));
    void persistOrder(category, nextRows);
  };

  const moveProduct = (category: string, productId: string, direction: -1 | 1) => {
    const categoryRows = products.filter((product) => product.category === category);
    const sourceIndex = categoryRows.findIndex((product) => product.id === productId);
    const target = categoryRows[sourceIndex + direction];
    if (!target) return;
    reorderProduct(category, productId, target.id);
  };

  const updateCategorySelection = (categoryRows: ProductRecord[], nextCategoryIds: string[]) => {
    const categoryIdSet = new Set(categoryRows.map((product) => product.id));
    setSelectedIds((current) => [
      ...current.filter((id) => !categoryIdSet.has(id)),
      ...nextCategoryIds,
    ]);
  };

  const save = async () => {
    if (!editing || !draft) return;
    const price = parsedInteger(draft.price);
    const dailyLimit = draft.dailyLimit.trim() ? parsedInteger(draft.dailyLimit) : null;

    if (price === null || (draft.dailyLimit.trim() && dailyLimit === null)) {
      setNotice("가격과 한정수량은 0 이상의 정수로 입력해주세요.");
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      await productMutation({
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
        sortOrder: editing.sortOrder,
        active: draft.active,
        dailyLimit,
      });
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

  const saveBulkAction = async () => {
    if (!bulkAction || !selectedProducts.length) return;
    const dailyLimit = bulkDailyLimit.trim() ? parsedInteger(bulkDailyLimit) : null;
    if (bulkAction === "daily-limit" && bulkDailyLimit.trim() && dailyLimit === null) {
      setNotice("한정수량은 0 이상의 정수로 입력해주세요.");
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      await productMutation({
        type: "product-bulk",
        action: bulkAction,
        items: selectedProducts.map((product) => ({ id: product.id, expectedVersion: product.version })),
        ...(bulkAction === "daily-limit" ? { dailyLimit } : {}),
        ...(bulkAction === "category" ? { category: bulkCategory } : {}),
        ...(bulkAction === "active" ? { active: bulkActive === "visible" } : {}),
      });
      await reload();
      setSelectedIds([]);
      setBulkAction(null);
      setNotice(`${selectedProducts.length}개 상품을 변경했습니다.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "선택한 상품을 변경하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const columnsFor = (category: string, categoryRows: ProductRecord[]): DataTableColumn<ProductRecord>[] => [
    {
      id: "move",
      header: "순서",
      cell: (product) => {
        const productIndex = categoryRows.findIndex((item) => item.id === product.id);
        return <div
          className="settings-row-order"
          onDragOver={(event) => {
            if (draggedProductId && draggedProductId !== product.id) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const sourceId = event.dataTransfer.getData("text/plain") || draggedProductId;
            if (sourceId) reorderProduct(category, sourceId, product.id);
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            draggable={!reordering}
            disabled={reordering}
            leadingIcon={<GripVertical />}
            aria-label={`${product.name} 순서 이동`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onDragStart={(event: DragEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", product.id);
              setDraggedProductId(product.id);
            }}
            onDragEnd={() => setDraggedProductId(null)}
          >
            이동
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<ArrowUp />}
            disabled={reordering || productIndex === 0}
            aria-label={`${product.name} 위로 이동`}
            onClick={(event) => {
              event.stopPropagation();
              moveProduct(category, product.id, -1);
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            위
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<ArrowDown />}
            disabled={reordering || productIndex === categoryRows.length - 1}
            aria-label={`${product.name} 아래로 이동`}
            onClick={(event) => {
              event.stopPropagation();
              moveProduct(category, product.id, 1);
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            아래
          </Button>
        </div>;
      },
      width: "260px",
    },
    {
      id: "name",
      header: "이름",
      cell: (product) => <span className="settings-product-name"><b>{product.name}</b>{product.subtitle ? <small>{product.subtitle}</small> : null}</span>,
      width: "250px",
    },
    {
      id: "price",
      header: "가격",
      cell: (product) => won(product.price),
      width: "120px",
      align: "right",
    },
    {
      id: "daily-limit",
      header: "한정수량",
      cell: (product) => product.dailyLimit === null
        ? <Badge tone="neutral">무제한</Badge>
        : <Badge tone={product.dailyLimit === 0 ? "danger" : "info"}>{product.dailyLimit.toLocaleString("ko-KR")}세트</Badge>,
      width: "120px",
      align: "center",
    },
    {
      id: "remaining",
      header: "잔여",
      cell: (product) => {
        if (product.dailyLimit === null) return <Badge tone="neutral">무제한</Badge>;
        const remaining = Math.max(0, product.dailyLimit - product.reservedQuantity);
        return <Badge tone={remaining === 0 ? "danger" : remaining <= product.dailyLimit * 0.25 ? "warning" : "success"}>
          {remaining.toLocaleString("ko-KR")}세트
        </Badge>;
      },
      width: "105px",
      align: "center",
    },
    {
      id: "active",
      header: "노출",
      cell: (product) => <Badge tone={product.active ? "success" : "neutral"}>{product.active ? "노출" : "숨김"}</Badge>,
      width: "90px",
      align: "center",
    },
  ];

  const bulkTitle = bulkAction === "daily-limit"
    ? "한정수량 일괄 설정"
    : bulkAction === "category"
      ? "카테고리 일괄 변경"
      : "노출 상태 일괄 변경";

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
    </section>
    <section className="settings-section">
      <Toolbar
        search={{
          value: query,
          onChange: setQuery,
          placeholder: "상품명, 부제, 카테고리 검색",
          label: "상품 검색",
        }}
      />
    </section>
    {selectedProducts.length ? <section className="settings-section">
      <div className="settings-bulk-actions" aria-label="선택 상품 일괄 처리">
        <strong>{selectedProducts.length}개 선택</strong>
        <div>
          <Button variant="ghost" size="sm" onClick={() => setBulkAction("daily-limit")}>한정수량 일괄 설정</Button>
          <Button variant="ghost" size="sm" onClick={() => setBulkAction("category")}>카테고리 변경</Button>
          <Button variant="ghost" size="sm" onClick={() => setBulkAction("active")}>노출 / 숨김 전환</Button>
        </div>
      </div>
    </section> : null}
    {loading && !catalog && !settings ? <div className="settings-loading">상품을 불러오고 있습니다.</div> : null}
    {error ? <div className="access-error" role="alert"><b>상품 관리 화면에 연결할 수 없습니다</b><span>{error.message}</span></div> : null}
    {!error && (catalog || settings) ? <div className="settings-category-list">
      {productGroups(visibleProducts).map(({ category, rows }) => <section className="settings-section settings-category-section" key={category}>
        <div className="settings-category-heading">
          <h2>{category}</h2>
          <span>{rows.length}개</span>
        </div>
        <DataTable
          rows={rows}
          columns={columnsFor(category, rows)}
          getRowId={(product) => product.id}
          onRowClick={openEditor}
          selectedIds={selectedIds.filter((id) => rows.some((product) => product.id === id))}
          onSelectedIdsChange={(ids) => updateCategorySelection(rows, ids)}
          emptyMessage="카테고리에 상품이 없습니다."
          ariaLabel={`${category} 상품 목록`}
        />
      </section>)}
      {!visibleProducts.length ? <section className="settings-section"><div className="settings-empty">검색 조건에 맞는 상품이 없습니다.</div></section> : null}
    </div> : null}
    <Modal
      open={Boolean(editing && draft)}
      title={editing ? `${editing.name} 수정` : "상품 수정"}
      onClose={closeEditor}
      footer={<><Button variant="ghost" onClick={closeEditor} disabled={saving}>취소</Button><Button leadingIcon={<Save />} onClick={() => void save()} disabled={saving}>{saving ? "저장 중" : "저장"}</Button></>}
    >
      {editing && draft ? <div className="settings-editor-grid">
        <FieldInput id="product-name" label="이름" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
        <FieldSelect id="product-category" label="카테고리" value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}>
          {PRODUCT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </FieldSelect>
        <FieldInput id="product-price" label="가격" inputMode="numeric" value={draft.price} onChange={(event) => updateDraft("price", numericText(event.target.value))} />
        <FieldInput id="product-weight" label="중량" value={draft.displayWeight} onChange={(event) => updateDraft("displayWeight", event.target.value)} placeholder="예: 1.8kg" />
        <FieldInput className="settings-editor-grid__wide" id="product-subtitle" label="부제" value={draft.subtitle} onChange={(event) => updateDraft("subtitle", event.target.value)} />
        <FieldTextarea className="settings-editor-grid__wide" id="product-description" label="설명" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
        <FieldInput id="product-badge" label="뱃지" value={draft.badge} onChange={(event) => updateDraft("badge", event.target.value)} placeholder="예: BEST" />
        <FieldInput
          id="product-daily-limit"
          label="한정수량"
          hint="비우면 무제한입니다."
          inputMode="numeric"
          value={draft.dailyLimit}
          onChange={(event) => updateDraft("dailyLimit", numericText(event.target.value))}
        />
        <FieldInput
          className="settings-editor-grid__wide"
          id="product-image-url"
          label="이미지"
          value={draft.imageUrl}
          onChange={(event) => updateDraft("imageUrl", event.target.value)}
          placeholder="/products/example.webp 또는 https://..."
        />
        <div className="settings-editor-grid__wide">
          {(draft.imageUrl.trim() || editing.previewImageUrl) ? <img
            className="settings-image-preview"
            src={draft.imageUrl.trim() || editing.previewImageUrl || ""}
            alt={`${draft.name || editing.name} 이미지 미리보기`}
          /> : <Badge tone="neutral">표시할 이미지가 없습니다.</Badge>}
        </div>
        <Field id="product-active" label="키오스크 노출">
          <span className="settings-toggle">
            <input id="product-active" type="checkbox" checked={draft.active} onChange={(event) => updateDraft("active", event.target.checked)} />
            <span>{draft.active ? "노출" : "숨김"}</span>
          </span>
        </Field>
      </div> : null}
    </Modal>
    <Modal
      open={Boolean(bulkAction)}
      title={bulkTitle}
      onClose={() => {
        if (!saving) setBulkAction(null);
      }}
      footer={<><Button variant="ghost" onClick={() => setBulkAction(null)} disabled={saving}>취소</Button><Button onClick={() => void saveBulkAction()} disabled={saving}>{saving ? "저장 중" : "적용"}</Button></>}
    >
      {bulkAction === "daily-limit" ? <FieldInput
        id="bulk-daily-limit"
        label="한정수량"
        hint="비우면 무제한입니다."
        inputMode="numeric"
        value={bulkDailyLimit}
        onChange={(event) => setBulkDailyLimit(numericText(event.target.value))}
      /> : null}
      {bulkAction === "category" ? <FieldSelect id="bulk-category" label="카테고리" value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)}>
        {PRODUCT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
      </FieldSelect> : null}
      {bulkAction === "active" ? <FieldSelect id="bulk-active" label="노출 상태" value={bulkActive} onChange={(event) => setBulkActive(event.target.value as "visible" | "hidden")}>
        <option value="visible">노출</option>
        <option value="hidden">숨김</option>
      </FieldSelect> : null}
    </Modal>
    {notice ? <div className="ops-toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="알림 닫기">×</button></div> : null}
  </main>;
}

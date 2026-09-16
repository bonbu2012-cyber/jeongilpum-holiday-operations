"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button, FieldInput, FieldSelect, FieldTextarea, Modal, useResource } from "../ui";
import { type WorkStatus } from "../lib/work-status";
import WorkItemHistory, { type WorkItemHistoryEvent } from "./WorkItemHistory";
import { MoneyFieldInput } from "./MoneyInput";
import WorkStatusSelect from "./WorkStatusSelect";
import "../sales/work-table.css";

export type DeliveryMethod = "onsite_sale" | "onsite_reservation" | "delivery";

export type EditableWorkItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  deliveryMethod: DeliveryMethod;
  dueAt: string;
  workStatus: WorkStatus;
  recipientName: string | null;
  recipientPhone: string | null;
  postalCode: string | null;
  roadAddr: string | null;
  roadAddrReference: string | null;
  jibunAddr: string | null;
  detailAddr: string | null;
  customizationJson: string | null;
  note: string;
  version: number;
  orderNo: string;
  buyerName: string;
  buyerPhone: string;
  productDailyLimit: number | null;
  productScheduledQuantity: number;
  paymentStatus?: string | null;
  customerNote?: string | null;
};

export type WorkItemDraft = {
  productId: string;
  unitPrice: string;
  quantity: string;
  deliveryMethod: DeliveryMethod;
  dueAt: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  roadAddr: string;
  roadAddrReference: string;
  jibunAddr: string;
  detailAddr: string;
  customizationJson: string;
  workStatus: WorkStatus;
  note: string;
  paymentStatus?: "unpaid" | "paid";
};

type Product = {
  id: string;
  name: string;
  price: number;
  dailyLimit: number | null;
  reservedQuantity: number;
};

type ProductResponse = {
  products: Product[];
};

type WorkItemHistoryResponse = {
  orders: Array<{
    events: WorkItemHistoryEvent[];
  }>;
};

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  onsite_sale: "현장판매",
  onsite_reservation: "현장예약",
  delivery: "택배예약",
};

function toLocalDateTime(value: string) {
  return value.slice(0, 16);
}

export function draftForWorkItem(item: EditableWorkItem): WorkItemDraft {
  return {
    productId: item.productId,
    unitPrice: String(item.unitPrice),
    quantity: String(item.quantity),
    deliveryMethod: item.deliveryMethod,
    dueAt: toLocalDateTime(item.dueAt),
    recipientName: item.recipientName ?? "",
    recipientPhone: item.recipientPhone ?? "",
    postalCode: item.postalCode ?? "",
    roadAddr: item.roadAddr ?? "",
    roadAddrReference: item.roadAddrReference ?? "",
    jibunAddr: item.jibunAddr ?? "",
    detailAddr: item.detailAddr ?? "",
    customizationJson: item.customizationJson ?? "",
    workStatus: item.workStatus,
    note: item.note,
    paymentStatus: item.paymentStatus === "paid" ? "paid" : "unpaid",
  };
}

export function workItemDraftError(draft: WorkItemDraft) {
  if (!draft.productId) return "상품을 선택해주세요.";
  if (!Number.isInteger(Number(draft.quantity)) || Number(draft.quantity) < 1) {
    return "수량은 1 이상의 정수여야 합니다.";
  }
  if (!Number.isInteger(Number(draft.unitPrice)) || Number(draft.unitPrice) < 0) {
    return "상품 단가는 0 이상의 정수여야 합니다.";
  }
  if (!draft.dueAt) return "수령일시를 입력해주세요.";
  return "";
}

export function toWorkItemChanges(draft: WorkItemDraft) {
  const nullable = (value: string) => value.trim() || null;
  return {
    productId: draft.productId,
    unitPrice: Number(draft.unitPrice),
    quantity: Number(draft.quantity),
    deliveryMethod: draft.deliveryMethod,
    dueAt: `${draft.dueAt}:00+09:00`,
    recipientName: nullable(draft.recipientName),
    recipientPhone: nullable(draft.recipientPhone),
    postalCode: nullable(draft.postalCode),
    roadAddr: nullable(draft.roadAddr),
    roadAddrReference: nullable(draft.roadAddrReference),
    jibunAddr: nullable(draft.jibunAddr),
    detailAddr: nullable(draft.detailAddr),
    customizationJson: nullable(draft.customizationJson),
    workStatus: draft.workStatus,
    note: draft.note,
    paymentStatus: draft.paymentStatus ?? "unpaid",
  };
}

export default function WorkItemEditor({
  item,
  description,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
}: {
  item: EditableWorkItem;
  description: string;
  onClose: () => void;
  onSave: (item: EditableWorkItem, draft: WorkItemDraft) => Promise<void>;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [draft, setDraft] = useState(() => draftForWorkItem(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { data: historyData, error: historyError } = useResource<WorkItemHistoryResponse>(
    `/api/orders?workItemId=${encodeURIComponent(item.id)}`,
    2500,
  );

  const update = <Key extends keyof WorkItemDraft>(key: Key, value: WorkItemDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = workItemDraftError(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(item, draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "작업 행을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="작업 행 수정"
      description={description}
      onClose={onClose}
      footer={<>
        <Button variant="ghost" style={{ marginRight: "auto", borderColor: "#a42f28", color: "#a42f28" }} onClick={onDelete}>삭제</Button>
        <Button variant="ghost" onClick={onDuplicate}>복제</Button>
        <Button variant="ghost" onClick={onClose}>닫기</Button>
        <Button disabled={saving} onClick={() => (document.getElementById("work-item-editor") as HTMLFormElement | null)?.requestSubmit()}>{saving ? "저장 중" : "저장"}</Button>
      </>}
    >
      <form id="work-item-editor" className="sales-work-table__editor" onSubmit={submit}>
        <WorkItemFields draft={draft} idPrefix="work" existingItem={item} onChange={update} />
        {error ? <p className="sales-work-table__error" role="alert">{error}</p> : null}
      </form>
      <WorkItemHistory
        className="sales-work-table__history"
        events={historyData?.orders[0]?.events ?? []}
        loading={!historyData && !historyError}
        error={historyError?.message}
      />
    </Modal>
  );
}

type PostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  autoJibunAddress: string;
  bname: string;
  buildingName: string;
  apartment: string;
};

type KakaoWindow = Window & {
  kakao?: {
    Postcode: new (options: {
      oncomplete: (data: PostcodeData) => void;
      onclose?: () => void;
    }) => {
      open: () => void;
    };
  };
};

function loadPostcode(onComplete: (data: PostcodeData) => void, onError: () => void) {
  const kakaoWindow = window as unknown as KakaoWindow;
  const start = () => {
    if (!kakaoWindow.kakao?.Postcode) {
      onError();
      return;
    }
    new kakaoWindow.kakao.Postcode({ oncomplete: onComplete }).open();
  };
  if (kakaoWindow.kakao?.Postcode) {
    start();
    return;
  }
  const existing = document.getElementById("kakao-postcode-script") as HTMLScriptElement | null;
  if (existing) {
    existing.addEventListener("load", start, { once: true });
    existing.addEventListener("error", onError, { once: true });
    return;
  }
  const script = document.createElement("script");
  script.id = "kakao-postcode-script";
  script.src = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
  script.async = true;
  script.addEventListener("load", start, { once: true });
  script.addEventListener("error", onError, { once: true });
  document.head.appendChild(script);
}

export function WorkItemFields({
  draft,
  idPrefix,
  existingItem,
  onChange,
}: {
  draft: WorkItemDraft;
  idPrefix: string;
  existingItem?: EditableWorkItem;
  onChange: <Key extends keyof WorkItemDraft>(key: Key, value: WorkItemDraft[Key]) => void;
}) {
  const [manualAddress, setManualAddress] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");

  const searchAddress = () => {
    setPostcodeError("");
    loadPostcode(
      (data) => {
        const references: string[] = [];
        if (data.bname && /[동로가]$/.test(data.bname)) references.push(data.bname);
        if (data.buildingName && data.apartment === "Y") references.push(data.buildingName);
        onChange("postalCode", data.zonecode);
        onChange("roadAddr", data.roadAddress || data.jibunAddress);
        onChange("roadAddrReference", references.join(", "));
        onChange("jibunAddr", data.jibunAddress || data.autoJibunAddress || "");
        setPostcodeError("");
      },
      () => setPostcodeError("주소검색을 불러오지 못했습니다. 직접 입력을 이용해주세요."),
    );
  };

  const productUrl = draft.dueAt ? `/api/products?date=${encodeURIComponent(draft.dueAt.slice(0, 10))}` : null;
  const { data: productData } = useResource<ProductResponse>(productUrl, 15000);
  const products = productData?.products ?? [];
  const productOptions = existingItem && !products.some((product) => product.id === existingItem.productId)
    ? [{ id: existingItem.productId, name: existingItem.productName, price: existingItem.unitPrice, dailyLimit: existingItem.productDailyLimit, reservedQuantity: existingItem.productScheduledQuantity }, ...products]
    : products;
  const selectedProduct = productOptions.find((product) => product.id === draft.productId);
  const currentReservation = selectedProduct
    ? selectedProduct.reservedQuantity - (
      existingItem
      && selectedProduct.id === existingItem.productId
      && draft.dueAt.slice(0, 10) === existingItem.dueAt.slice(0, 10)
        ? existingItem.quantity
        : 0
    )
    : 0;
  const wouldExceedDailyLimit = Boolean(
    selectedProduct
    && selectedProduct.dailyLimit !== null
    && currentReservation + Number(draft.quantity) > selectedProduct.dailyLimit,
  );

  const isDelivery = draft.deliveryMethod === "delivery";

  return (
    <>
      <div className="sales-work-table__editor-grid">
        <FieldSelect id={`${idPrefix}-product`} label="상품" value={draft.productId} onChange={(event) => {
          const product = productOptions.find((value) => value.id === event.target.value);
          onChange("productId", event.target.value);
          if (product) onChange("unitPrice", String(product.price));
        }}>
          {existingItem ? null : <option value="">상품 선택</option>}
          {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </FieldSelect>
        <MoneyFieldInput id={`${idPrefix}-unit-price`} label="상품 단가" value={draft.unitPrice} onValueChange={(value) => onChange("unitPrice", value)} />
        <FieldInput id={`${idPrefix}-quantity`} label="수량" format="number" value={draft.quantity} onValueChange={(value) => onChange("quantity", value)} />
        <FieldSelect id={`${idPrefix}-delivery`} label="수령방법" value={draft.deliveryMethod} onChange={(event) => onChange("deliveryMethod", event.target.value as DeliveryMethod)}>
          {Object.entries(DELIVERY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </FieldSelect>
        <FieldInput id={`${idPrefix}-due-at`} label={isDelivery ? "발송일시" : "수령일시"} type="datetime-local" value={draft.dueAt} onChange={(event) => onChange("dueAt", event.target.value)} />
        <WorkStatusSelect id={`${idPrefix}-status`} label="작업 상태" value={draft.workStatus} onChange={(status) => onChange("workStatus", status)} />
        <FieldSelect
          id={`${idPrefix}-payment-status`}
          label="결제 여부"
          value={draft.paymentStatus ?? "unpaid"}
          onChange={(event) => onChange("paymentStatus", event.target.value as "unpaid" | "paid")}
        >
          <option value="unpaid">미결제</option>
          <option value="paid">결제완료</option>
        </FieldSelect>
        <FieldInput id={`${idPrefix}-recipient-name`} label={isDelivery ? "받는 분 성함" : "수령자 성함"} value={draft.recipientName} onChange={(event) => onChange("recipientName", event.target.value)} />
        <FieldInput id={`${idPrefix}-recipient-phone`} label={isDelivery ? "받는 분 연락처" : "수령자 전화번호"} format="phone" value={draft.recipientPhone} onValueChange={(value) => onChange("recipientPhone", value)} />

        {isDelivery && (
          <div className="sales-work-table__editor-wide sales-address-section">
            <div className="sales-address-section__header">
              <strong>📦 택배 배송 주소</strong>
              <button
                type="button"
                className="sales-address-toggle-btn"
                onClick={() => setManualAddress((v) => !v)}
              >
                {manualAddress ? "카카오 검색으로 변경" : "직접 입력/수정"}
              </button>
            </div>

            {!manualAddress ? (
              <div className="sales-address-search-box">
                <Button
                  type="button"
                  variant="primary"
                  className="sales-postcode-btn"
                  onClick={searchAddress}
                >
                  🔍 카카오 도로명주소 검색
                </Button>

                {draft.roadAddr ? (
                  <div className="sales-address-confirmed-card">
                    <small>선택 확인된 주소</small>
                    <div className="sales-address-confirmed-main">
                      <b>[{draft.postalCode || "우편번호 미입력"}]</b> {draft.roadAddr}
                    </div>
                    {draft.jibunAddr && <span className="sales-address-confirmed-sub">지번: {draft.jibunAddr}</span>}
                    {draft.roadAddrReference && <span className="sales-address-confirmed-sub">참고: {draft.roadAddrReference}</span>}
                  </div>
                ) : (
                  <p className="sales-address-empty-hint">버튼을 눌러 카카오 도로명주소를 검색해주세요.</p>
                )}
                {postcodeError && <p className="sales-work-table__error" role="alert">{postcodeError}</p>}
              </div>
            ) : (
              <div className="sales-manual-address-grid">
                <FieldInput id={`${idPrefix}-postal-code`} label="우편번호" value={draft.postalCode} onChange={(event) => onChange("postalCode", event.target.value)} placeholder="5자리 우편번호" />
                <FieldInput id={`${idPrefix}-road-address`} label="도로명 주소" value={draft.roadAddr} onChange={(event) => onChange("roadAddr", event.target.value)} placeholder="기본 도로명 주소" />
                <FieldInput id={`${idPrefix}-road-reference`} label="주소 참고" value={draft.roadAddrReference} onChange={(event) => onChange("roadAddrReference", event.target.value)} placeholder="참고항목" />
                <FieldInput id={`${idPrefix}-jibun-address`} label="지번 주소" value={draft.jibunAddr} onChange={(event) => onChange("jibunAddr", event.target.value)} placeholder="지번 주소 (선택)" />
              </div>
            )}

            <FieldInput
              id={`${idPrefix}-detail-address`}
              className="sales-detail-address-input"
              label="상세 주소 (동·호수, 선택)"
              value={draft.detailAddr}
              onChange={(event) => onChange("detailAddr", event.target.value)}
              placeholder="동·호수 또는 상세 위치 (선택 사항)"
            />
          </div>
        )}

        <FieldTextarea id={`${idPrefix}-customization`} className="sales-work-table__editor-wide" label="구성 정보 (맞춤 주문 시 품명/부위/중량 등)" rows={2} value={draft.customizationJson} onChange={(event) => onChange("customizationJson", event.target.value)} placeholder="예: 꽃등심 600g, 살치살 400g" />
        <FieldTextarea id={`${idPrefix}-note`} className="sales-work-table__editor-wide" label="관리자 메모" rows={3} value={draft.note} onChange={(event) => onChange("note", event.target.value)} placeholder="주문 또는 작업 관련 메모" />
      </div>
      {wouldExceedDailyLimit && selectedProduct && selectedProduct.dailyLimit !== null ? <p className="sales-work-table__warning">선택한 수령일의 {selectedProduct.name} 수량이 {currentReservation + Number(draft.quantity)}개로 일일 기준 {selectedProduct.dailyLimit}개를 초과합니다. 운영자 저장은 제한하지 않습니다.</p> : null}
    </>
  );
}

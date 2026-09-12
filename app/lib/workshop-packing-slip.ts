import { CATALOG_PRODUCT_DETAILS, resolveCatalogProductDetails } from "./catalog-product-details";

export type DeliveryClassification = "onsite" | "shipping" | "direct_delivery";

export type WorkItemLike = {
  id: string;
  orderId?: string;
  orderNo: string;
  productId: string;
  productName: string;
  unitPrice?: number;
  quantity: number;
  deliveryMethod: "onsite_reservation" | "delivery" | "onsite_sale" | string;
  dueAt: string;
  workStatus: string;
  paymentStatus?: string;
  customerNote?: string;
  note: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  postalCode?: string | null;
  roadAddr?: string | null;
  detailAddr?: string | null;
  address?: string;
  buyerName: string;
  buyerPhone: string;
};

export function classifyDeliveryType(item: {
  deliveryMethod: string;
  note?: string | null;
  customerNote?: string | null;
  address?: string | null;
  roadAddr?: string | null;
}): DeliveryClassification {
  const text = [item.note, item.customerNote, item.address, item.roadAddr].filter(Boolean).join(" ");
  const isDirectDelivery = /배달|직접배달|퀵|가져다/i.test(text);

  if (item.deliveryMethod === "delivery") {
    return isDirectDelivery ? "direct_delivery" : "shipping";
  }
  if (isDirectDelivery) {
    return "direct_delivery";
  }
  return "onsite";
}

export function deliveryClassificationLabel(type: DeliveryClassification): string {
  switch (type) {
    case "onsite":
      return "현장수령";
    case "shipping":
      return "택배발송";
    case "direct_delivery":
      return "직접배달";
  }
}

export function formatPaymentStatus(status?: string): { label: string; isPaid: boolean } {
  if (status === "paid") return { label: "결제완료", isPaid: true };
  if (status === "partial") return { label: "부분결제", isPaid: false };
  if (status === "refunded") return { label: "환불", isPaid: false };
  return { label: "미결제", isPaid: false };
}

export function formatDueTime(dueAt: string): string {
  if (!dueAt || dueAt.length < 16) return "-";
  return dueAt.slice(11, 16);
}

export function formatDueDate(dueAt: string): string {
  if (!dueAt || dueAt.length < 10) return "";
  return dueAt.slice(0, 10);
}

// 부위별 기본 구성 (카탈로그 데이터 및 정일품 표준 규격)
export const STANDARD_SET_CUTS: Record<string, string[]> = {
  bonghwang: ["치마살", "갈비살", "부채살", "제비추리", "차돌박이"],
  palyeong: ["치마살", "업진살", "부채살", "갈비살", "살치살", "제비추리", "채끝"],
  "omeat-signature": ["치마살", "부채살", "갈비살", "제비추리", "채끝", "차돌박이"],
  "omeat-prestige": ["부채살", "업진살", "갈비살", "살치살", "채끝", "안창살"],
  practical: ["부채살", "업진살", "제비추리", "채끝"],
  jin: ["안창살", "살치살", "치마살", "갈비살", "부채살", "채끝", "제비추리"],
  seon: ["치마살", "업진살", "부채살", "갈비살", "살치살", "채끝"],
  mi: ["치마살", "업진살", "부채살", "갈비살", "제비추리"],
};

export function getProductCuts(productId: string, productName: string): string[] {
  if (STANDARD_SET_CUTS[productId]) return STANDARD_SET_CUTS[productId];
  const catalog = resolveCatalogProductDetails({ id: productId, name: productName });
  if (catalog?.components && catalog.components.length > 0) {
    return catalog.components;
  }
  // 상품명 기반 보조 매칭
  if (/봉황/.test(productName)) return STANDARD_SET_CUTS.bonghwang;
  if (/팔영/.test(productName)) return STANDARD_SET_CUTS.palyeong;
  if (/시그니처|signature/i.test(productName)) return STANDARD_SET_CUTS["omeat-signature"];
  if (/프레스티지|prestige/i.test(productName)) return STANDARD_SET_CUTS["omeat-prestige"];
  if (/실속/.test(productName)) return STANDARD_SET_CUTS.practical;
  return [];
}

export type SetCategory = "vacuum" | "omeat" | "other";

export function categorizeProduct(productId: string, productName: string): SetCategory {
  if (/omeat|오미트/i.test(productId) || /omeat|오미트/i.test(productName)) {
    return "omeat";
  }
  if (
    /bonghwang|palyeong|practical|jin|seon|mi|vac/i.test(productId) ||
    /봉황|팔영|실속|진세트|선세트|미세트|진공/i.test(productName)
  ) {
    return "vacuum";
  }
  return "other";
}

export type CutPackSummary = {
  cutName: string;
  vacuumPacks: number;
  omeatPacks: number;
  otherPacks: number;
  totalPacks: number;
};

export type CutCalculationResult = {
  vacuumProducts: Array<{ name: string; quantity: number }>;
  omeatProducts: Array<{ name: string; quantity: number }>;
  otherProducts: Array<{ name: string; quantity: number }>;
  cuts: CutPackSummary[];
  totalVacuumPacks: number;
  totalOmeatPacks: number;
  totalAllPacks: number;
};

export function calculateSetCutRequirements(items: WorkItemLike[]): CutCalculationResult {
  const activeItems = items.filter((item) => item.workStatus !== "cancelled");

  // 상품별 수량 집계
  const quantityByProduct = new Map<string, { productId: string; name: string; quantity: number; category: SetCategory }>();

  for (const item of activeItems) {
    const key = item.productId || item.productName;
    const existing = quantityByProduct.get(key);
    const category = categorizeProduct(item.productId, item.productName);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      quantityByProduct.set(key, {
        productId: item.productId,
        name: item.productName,
        quantity: item.quantity,
        category,
      });
    }
  }

  const vacuumProducts: Array<{ name: string; quantity: number }> = [];
  const omeatProducts: Array<{ name: string; quantity: number }> = [];
  const otherProducts: Array<{ name: string; quantity: number }> = [];

  const cutMap = new Map<string, { cutName: string; vacuumPacks: number; omeatPacks: number; otherPacks: number }>();

  const ensureCut = (cutName: string) => {
    if (!cutMap.has(cutName)) {
      cutMap.set(cutName, { cutName, vacuumPacks: 0, omeatPacks: 0, otherPacks: 0 });
    }
    return cutMap.get(cutName)!;
  };

  for (const product of quantityByProduct.values()) {
    if (product.category === "vacuum") {
      vacuumProducts.push({ name: product.name, quantity: product.quantity });
    } else if (product.category === "omeat") {
      omeatProducts.push({ name: product.name, quantity: product.quantity });
    } else {
      otherProducts.push({ name: product.name, quantity: product.quantity });
    }

    const cuts = getProductCuts(product.productId, product.name);
    for (const cut of cuts) {
      const entry = ensureCut(cut);
      if (product.category === "vacuum") {
        entry.vacuumPacks += product.quantity;
      } else if (product.category === "omeat") {
        entry.omeatPacks += product.quantity;
      } else {
        entry.otherPacks += product.quantity;
      }
    }
  }

  // 선호 정렬 순서: 대표 구이 부위 순서
  const preferredCutOrder = [
    "치마살",
    "갈비살",
    "부채살",
    "업진살",
    "살치살",
    "제비추리",
    "채끝",
    "안창살",
    "차돌박이",
  ];

  const cuts: CutPackSummary[] = [...cutMap.values()]
    .map((entry) => ({
      cutName: entry.cutName,
      vacuumPacks: entry.vacuumPacks,
      omeatPacks: entry.omeatPacks,
      otherPacks: entry.otherPacks,
      totalPacks: entry.vacuumPacks + entry.omeatPacks + entry.otherPacks,
    }))
    .sort((a, b) => {
      const indexA = preferredCutOrder.indexOf(a.cutName);
      const indexB = preferredCutOrder.indexOf(b.cutName);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.cutName.localeCompare(b.cutName, "ko");
    });

  const totalVacuumPacks = cuts.reduce((sum, cut) => sum + cut.vacuumPacks, 0);
  const totalOmeatPacks = cuts.reduce((sum, cut) => sum + cut.omeatPacks, 0);
  const totalAllPacks = cuts.reduce((sum, cut) => sum + cut.totalPacks, 0);

  return {
    vacuumProducts: vacuumProducts.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "ko")),
    omeatProducts: omeatProducts.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "ko")),
    otherProducts: otherProducts.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "ko")),
    cuts,
    totalVacuumPacks,
    totalOmeatPacks,
    totalAllPacks,
  };
}

export type InspectionItem = WorkItemLike & {
  classification: DeliveryClassification;
  classificationLabel: string;
  dueTime: string;
  paymentBadge: { label: string; isPaid: boolean };
  fullAddress: string;
};

export function prepareInspectionItems(items: WorkItemLike[]): InspectionItem[] {
  return items
    .filter((item) => item.workStatus !== "cancelled")
    .map((item) => {
      const classification = classifyDeliveryType(item);
      const fullAddress = [item.postalCode ? `[${item.postalCode}]` : "", item.roadAddr, item.detailAddr]
        .filter(Boolean)
        .join(" ")
        .trim() || item.address || "";

      return {
        ...item,
        classification,
        classificationLabel: deliveryClassificationLabel(classification),
        dueTime: formatDueTime(item.dueAt),
        paymentBadge: formatPaymentStatus(item.paymentStatus),
        fullAddress,
      };
    })
    .sort((a, b) => {
      // 1순위: 현장수령은 시간순(10:00, 11:00...), 그 다음 택배, 그 다음 직접배달
      const order = { onsite: 1, shipping: 2, direct_delivery: 3 };
      if (order[a.classification] !== order[b.classification]) {
        return order[a.classification] - order[b.classification];
      }
      if (a.dueAt !== b.dueAt) {
        return a.dueAt.localeCompare(b.dueAt);
      }
      return a.orderNo.localeCompare(b.orderNo);
    });
}

// 50*50 감열 라벨 데이터 구조
export type PackingSlipLabel = {
  id: string;
  workItemId: string;
  orderNo: string;
  buyerName: string;
  buyerPhone: string;
  productName: string;
  itemIndex: number;
  itemTotal: number;
  quantityBadge: string; // "(1/2)"
  date: string; // "2026-09-12"
  classification: DeliveryClassification;
  classificationLabel: string;
  pickupTime: string; // "14:00"
  paymentStatusLabel: string; // "결제완료" | "미결제"
  isPaid: boolean;
  // 택배 배송 정보
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  fullAddress: string;
  note: string;
};

export function generatePackingLabels(items: WorkItemLike[], targetDate: string): PackingSlipLabel[] {
  const activeItems = items.filter((item) => item.workStatus !== "cancelled");
  const labels: PackingSlipLabel[] = [];

  for (const item of activeItems) {
    const count = Math.max(1, item.quantity);
    const classification = classifyDeliveryType(item);
    const pickupTime = classification === "onsite" ? formatDueTime(item.dueAt) : "";
    const payment = formatPaymentStatus(item.paymentStatus);
    const fullAddress = [item.postalCode ? `[${item.postalCode}]` : "", item.roadAddr, item.detailAddr]
      .filter(Boolean)
      .join(" ")
      .trim() || item.address || "";
    const effectiveDate = targetDate || formatDueDate(item.dueAt);

    for (let index = 1; index <= count; index++) {
      labels.push({
        id: `${item.id}-${index}`,
        workItemId: item.id,
        orderNo: item.orderNo,
        buyerName: item.buyerName || "주문자",
        buyerPhone: item.buyerPhone || "",
        productName: item.productName,
        itemIndex: index,
        itemTotal: count,
        quantityBadge: `(${index}/${count})`,
        date: effectiveDate,
        classification,
        classificationLabel: deliveryClassificationLabel(classification),
        pickupTime,
        paymentStatusLabel: payment.label,
        isPaid: payment.isPaid,
        recipientName: item.recipientName || item.buyerName || "수령인",
        recipientPhone: item.recipientPhone || item.buyerPhone || "",
        postalCode: item.postalCode || "",
        fullAddress,
        note: item.note || item.customerNote || "",
      });
    }
  }

  return labels;
}

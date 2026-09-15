import { resolveCatalogProductDetails } from "./catalog-product-details.ts";

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
  paymentStatus?: string | null;
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

export function formatPaymentStatus(status?: string | null): { label: string; isPaid: boolean } {
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

export type SetCategory = "vacuum" | "omeat" | "other";

// 2026 추석 정일품 공식 작업 지침서 기반 마스터 스펙
export type CutItemSpec = {
  cutName: string;
  weight: string; // 예: "180g", "280g", "200g", "230g", "300g", "150g", "900g 이상"
  container: string; // "162202", "241702", "V8", "223003", "3호 바구니", "4호 바구니" 등
  note?: string;
};

export type ProductPackagingSOP = {
  id: string;
  name: string;
  category: "vacuum" | "omeat" | "basket" | "la" | "bone" | "other";
  totalWeight: string;
  containerSummary: string;
  finishingSummary: string;
  cuts: CutItemSpec[];
  isBasketWeighed?: boolean;
  basketInstruction?: string;
};

export const SOP_SET_SPECS: Record<string, ProductPackagingSOP> = {
  practical: {
    id: "practical",
    name: "실속형",
    category: "vacuum",
    totalWeight: "600g",
    containerSummary: "V8 × 1 (4부위 합포)",
    finishingSummary: "안내카드 1, 아이스팩 2, 2호 박스·가방 (택배: +아이스팩 2)",
    cuts: [
      { cutName: "부채살", weight: "150g", container: "V8", note: "4부위 함께 담기" },
      { cutName: "업진살", weight: "150g", container: "V8", note: "4부위 함께 담기" },
      { cutName: "제비추리", weight: "150g", container: "V8", note: "4부위 함께 담기" },
      { cutName: "채끝", weight: "150g", container: "V8", note: "4부위 함께 담기" },
    ],
  },
  bonghwang: {
    id: "bonghwang",
    name: "봉황",
    category: "vacuum",
    totalWeight: "1,000g (5팩)",
    containerSummary: "162202 × 5, 슬리브 × 5",
    finishingSummary: "안내카드 1, 아이스팩 2, 지함 소·전용가방 (택배: +아이스팩 2)",
    cuts: [
      { cutName: "치마살", weight: "180g", container: "162202" },
      { cutName: "갈비살", weight: "180g", container: "162202" },
      { cutName: "부채살", weight: "180g", container: "162202" },
      { cutName: "제비추리", weight: "180g", container: "162202" },
      { cutName: "차돌박이", weight: "280g", container: "162202", note: "차돌박이 대용량 280g" },
    ],
  },
  palyeong: {
    id: "palyeong",
    name: "팔영",
    category: "vacuum",
    totalWeight: "1,260g (7팩)",
    containerSummary: "162202 × 7, 슬리브 × 7",
    finishingSummary: "안내카드 1, 아이스팩 2, 지함 대·전용가방 (택배: +아이스팩 2)",
    cuts: [
      { cutName: "치마살", weight: "180g", container: "162202" },
      { cutName: "업진살", weight: "180g", container: "162202" },
      { cutName: "부채살", weight: "180g", container: "162202" },
      { cutName: "갈비살", weight: "180g", container: "162202" },
      { cutName: "살치살", weight: "180g", container: "162202" },
      { cutName: "제비추리", weight: "180g", container: "162202" },
      { cutName: "채끝", weight: "180g", container: "162202" },
    ],
  },
  "omeat-signature": {
    id: "omeat-signature",
    name: "오미트 시그니처",
    category: "omeat",
    totalWeight: "1,300g (6팩)",
    containerSummary: "241702 × 6, 슬리브 × 6, 라벨 × 6",
    finishingSummary: "EPP 1, 쇼핑백 1, 아이스팩 2, 단상자 2, 리플렛 1 (택배: +아이스팩 2 + 외박스 1)",
    cuts: [
      { cutName: "치마살", weight: "200g", container: "241702" },
      { cutName: "부채살", weight: "200g", container: "241702" },
      { cutName: "갈비살", weight: "200g", container: "241702" },
      { cutName: "제비추리", weight: "200g", container: "241702" },
      { cutName: "채끝", weight: "200g", container: "241702" },
      { cutName: "차돌박이", weight: "300g", container: "241702", note: "오미트 차돌박이 300g" },
    ],
  },
  "omeat-prestige": {
    id: "omeat-prestige",
    name: "오미트 프레스티지",
    category: "omeat",
    totalWeight: "1,380g (6팩)",
    containerSummary: "241702 × 6, 슬리브 × 6, 라벨 × 6",
    finishingSummary: "EPP 1, 쇼핑백 1, 아이스팩 2, 단상자 2, 리플렛 1 (택배: +아이스팩 2 + 외박스 1)",
    cuts: [
      { cutName: "부채살", weight: "230g", container: "241702" },
      { cutName: "업진살", weight: "230g", container: "241702" },
      { cutName: "갈비살", weight: "230g", container: "241702" },
      { cutName: "살치살", weight: "230g", container: "241702" },
      { cutName: "채끝", weight: "230g", container: "241702" },
      { cutName: "안창살", weight: "230g", container: "241702" },
    ],
  },
  mi: {
    id: "mi",
    name: "프리미엄 미",
    category: "basket",
    totalWeight: "1.000kg 정확히",
    containerSummary: "3호 바구니",
    finishingSummary: "아이스팩 2, 3호 박스·가방 (택배: +아이스팩 2, 은박 1)",
    isBasketWeighed: true,
    basketInstruction: "개별 부위 중량 맞추지 않고 바구니 전체 중량만 계량 / 부족: 업진살 / 꽃: 부채살 2개",
    cuts: [
      { cutName: "치마살", weight: "바구니 계량", container: "3호 바구니" },
      { cutName: "업진살", weight: "바구니 계량(부족보충)", container: "3호 바구니" },
      { cutName: "부채살", weight: "바구니 계량(꽃 2개)", container: "3호 바구니" },
      { cutName: "갈비살", weight: "바구니 계량", container: "3호 바구니" },
      { cutName: "제비추리", weight: "바구니 계량", container: "3호 바구니" },
    ],
  },
  seon: {
    id: "seon",
    name: "프리미엄 선",
    category: "basket",
    totalWeight: "1,150~1,153g",
    containerSummary: "3호 바구니",
    finishingSummary: "아이스팩 2, 3호 박스·가방 (택배: +아이스팩 2, 은박 1)",
    isBasketWeighed: true,
    basketInstruction: "개별 부위 중량 맞추지 않고 바구니 전체 중량만 계량 / 부족: 업진살 / 꽃: 부채살 3개",
    cuts: [
      { cutName: "치마살", weight: "바구니 계량", container: "3호 바구니" },
      { cutName: "업진살", weight: "바구니 계량(부족보충)", container: "3호 바구니" },
      { cutName: "부채살", weight: "바구니 계량(꽃 3개)", container: "3호 바구니" },
      { cutName: "갈비살", weight: "바구니 계량", container: "3호 바구니" },
      { cutName: "살치살", weight: "바구니 계량", container: "3호 바구니" },
      { cutName: "채끝", weight: "바구니 계량", container: "3호 바구니" },
    ],
  },
  jin: {
    id: "jin",
    name: "프리미엄 진",
    category: "basket",
    totalWeight: "1,330~1,333g",
    containerSummary: "4호 바구니",
    finishingSummary: "아이스팩 2, 4호 박스·가방 (택배: +아이스팩 2, 은박 1)",
    isBasketWeighed: true,
    basketInstruction: "개별 부위 중량 맞추지 않고 바구니 전체 중량만 계량 / 부족: 부채살 / 꽃: 부채살 4개",
    cuts: [
      { cutName: "안창살", weight: "바구니 계량", container: "4호 바구니" },
      { cutName: "살치살", weight: "바구니 계량", container: "4호 바구니" },
      { cutName: "치마살", weight: "바구니 계량", container: "4호 바구니" },
      { cutName: "갈비살", weight: "바구니 계량", container: "4호 바구니" },
      { cutName: "부채살", weight: "바구니 계량(꽃 4개·부족보충)", container: "4호 바구니" },
      { cutName: "채끝", weight: "바구니 계량", container: "4호 바구니" },
      { cutName: "제비추리", weight: "바구니 계량", container: "4호 바구니" },
    ],
  },
  "la-1": {
    id: "la-1",
    name: "LA갈비 1호",
    category: "la",
    totalWeight: "1.8kg 이상 (2팩)",
    containerSummary: "223003 × 2",
    finishingSummary: "아이스팩 2, 냉삼 보냉박스, 호환가방 (택배: +아이스팩 2)",
    cuts: [{ cutName: "LA갈비", weight: "900g 이상", container: "223003" }],
  },
  "la-2": {
    id: "la-2",
    name: "LA갈비 2호",
    category: "la",
    totalWeight: "2.7kg",
    containerSummary: "낮은 4호 바구니",
    finishingSummary: "아이스팩 2, 4호 박스·가방 (택배: +아이스팩 2)",
    cuts: [{ cutName: "LA갈비", weight: "2.7kg", container: "낮은 4호 바구니" }],
  },
  "bone-1": {
    id: "bone-1",
    name: "사골×우족",
    category: "bone",
    totalWeight: "5kg",
    containerSummary: "깊은 4호 등바구니",
    finishingSummary: "원물 랩, 아이스팩 2, 4호 박스·가방 (택배: +아이스팩 2)",
    cuts: [
      { cutName: "사골", weight: "3.5kg", container: "깊은 4호 등바구니" },
      { cutName: "우족", weight: "1.5kg", container: "깊은 4호 등바구니" },
    ],
  },
  "bone-2": {
    id: "bone-2",
    name: "사골×잡뼈×꼬리",
    category: "bone",
    totalWeight: "6.5kg",
    containerSummary: "깊은 5호 등바구니",
    finishingSummary: "원물 랩, 아이스팩 2, 5호 박스·가방 (택배: +아이스팩 2)",
    cuts: [
      { cutName: "사골", weight: "3.5kg", container: "깊은 5호 등바구니" },
      { cutName: "꼬리", weight: "1개", container: "깊은 5호 등바구니" },
      { cutName: "잡뼈", weight: "나머지 중량 맞춤", container: "깊은 5호 등바구니" },
    ],
  },
};

export function resolveSOP(productId: string, productName: string): ProductPackagingSOP | null {
  if (SOP_SET_SPECS[productId]) return SOP_SET_SPECS[productId];
  const norm = (productId + " " + productName).toLowerCase();
  if (/봉황/.test(norm)) return SOP_SET_SPECS.bonghwang;
  if (/팔영/.test(norm)) return SOP_SET_SPECS.palyeong;
  if (/실속/.test(norm)) return SOP_SET_SPECS.practical;
  if (/시그니처|signature/.test(norm)) return SOP_SET_SPECS["omeat-signature"];
  if (/프레스티지|prestige/.test(norm)) return SOP_SET_SPECS["omeat-prestige"];
  if (/진세트|진\(|pre-jin/.test(norm)) return SOP_SET_SPECS.jin;
  if (/선세트|pre-seon/.test(norm)) return SOP_SET_SPECS.seon;
  if (/미세트|pre-mi/.test(norm)) return SOP_SET_SPECS.mi;
  if (/la.*1호|la-1/.test(norm)) return SOP_SET_SPECS["la-1"];
  if (/la.*2호|la-2/.test(norm)) return SOP_SET_SPECS["la-2"];
  if (/사골.*우족|bone-1/.test(norm)) return SOP_SET_SPECS["bone-1"];
  if (/꼬리|잡뼈|bone-2/.test(norm)) return SOP_SET_SPECS["bone-2"];
  return null;
}

export function getProductWeightSpec(productId: string, productName: string): string {
  const sop = resolveSOP(productId, productName);
  if (sop) {
    return `${sop.totalWeight} · [${sop.containerSummary}]`;
  }
  const catalog = resolveCatalogProductDetails({ id: productId, name: productName });
  return catalog?.totalWeight || "";
}

export function getProductCuts(productId: string, productName: string): string[] {
  const sop = resolveSOP(productId, productName);
  if (sop) {
    return sop.cuts.map((c) => c.cutName);
  }
  const catalog = resolveCatalogProductDetails({ id: productId, name: productName });
  return catalog?.components || [];
}

// 용기 + 중량 + 부위별 스킨팩 정밀 집계 단위
export type DetailedSkinPackItem = {
  cutName: string;
  container: string; // "162202", "241702", "V8", "223003", 바구니 등
  weight: string; // "180g", "280g", "200g", "230g", "300g" 등
  packs: number; // 총 필요 팩수
  targetSets: string[]; // 소요 세트 (예: ["봉황 5", "팔영 3"])
  note?: string;
};

export type BasketOrderItem = {
  productName: string;
  quantity: number;
  totalWeight: string;
  containerSummary: string;
  instruction: string;
  finishingSummary: string;
  cuts: CutItemSpec[];
};

export type CutPackSummary = {
  cutName: string;
  vacuumPacks: number;
  omeatPacks: number;
  otherPacks: number;
  totalPacks: number;
};

export type IndividualCutSummary = {
  cutName: string;
  packs: number;
};

export type ProductQuantityWithSpec = {
  name: string;
  quantity: number;
  weightSpec: string;
  containerSummary: string;
  finishingSummary: string;
};

export type CutCalculationResult = {
  vacuumProducts: ProductQuantityWithSpec[];
  omeatProducts: ProductQuantityWithSpec[];
  otherProducts: ProductQuantityWithSpec[];
  // 용기별 정밀 스킨팩 목록
  skinPacks162202: DetailedSkinPackItem[]; // 162202 용기 스킨팩 (봉황·팔영)
  skinPacks241702: DetailedSkinPackItem[]; // 241702 용기 오미트팩 (시그니처·프레스티지)
  skinPacksV8: DetailedSkinPackItem[];      // V8 용기 합포팩 (실속형)
  skinPacksLA223003: DetailedSkinPackItem[]; // 223003 용기 LA갈비 1호
  basketOrders: BasketOrderItem[];         // 프리미엄 바구니 및 등바구니 주문 목록
  // 이전 인터페이스 하위 호환
  vacuumCuts: IndividualCutSummary[];
  omeatCuts: IndividualCutSummary[];
  otherCuts: IndividualCutSummary[];
  totalVacuumPacks: number;
  totalOmeatPacks: number;
  totalOtherPacks: number;
  cuts: CutPackSummary[];
  totalAllPacks: number;
};

export function calculateSetCutRequirements(items: WorkItemLike[]): CutCalculationResult {
  const activeItems = items.filter((item) => item.workStatus !== "cancelled");

  // 상품별 수량 집계
  const quantityByProduct = new Map<
    string,
    {
      productId: string;
      name: string;
      quantity: number;
      category: SetCategory;
      weightSpec: string;
      containerSummary: string;
      finishingSummary: string;
      sop: ProductPackagingSOP | null;
    }
  >();

  for (const item of activeItems) {
    const key = item.productId || item.productName;
    const existing = quantityByProduct.get(key);
    const sop = resolveSOP(item.productId, item.productName);
    const category: SetCategory = sop?.category === "omeat" ? "omeat" : sop?.category === "vacuum" ? "vacuum" : "other";
    const weightSpec = getProductWeightSpec(item.productId, item.productName);
    const containerSummary = sop?.containerSummary || "";
    const finishingSummary = sop?.finishingSummary || "";

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      quantityByProduct.set(key, {
        productId: item.productId,
        name: item.productName,
        quantity: item.quantity,
        category,
        weightSpec,
        containerSummary,
        finishingSummary,
        sop,
      });
    }
  }

  const vacuumProducts: ProductQuantityWithSpec[] = [];
  const omeatProducts: ProductQuantityWithSpec[] = [];
  const otherProducts: ProductQuantityWithSpec[] = [];

  // 정밀 스킨팩 집계용 맵 (키: cutName + container + weight)
  const detailed162202Map = new Map<string, DetailedSkinPackItem>();
  const detailed241702Map = new Map<string, DetailedSkinPackItem>();
  const detailedV8Map = new Map<string, DetailedSkinPackItem>();
  const detailedLA223003Map = new Map<string, DetailedSkinPackItem>();
  const basketOrders: BasketOrderItem[] = [];

  // 하위 호환용 맵
  const cutMap = new Map<string, { cutName: string; vacuumPacks: number; omeatPacks: number; otherPacks: number }>();
  const ensureCut = (cutName: string) => {
    if (!cutMap.has(cutName)) {
      cutMap.set(cutName, { cutName, vacuumPacks: 0, omeatPacks: 0, otherPacks: 0 });
    }
    return cutMap.get(cutName)!;
  };

  for (const product of quantityByProduct.values()) {
    const itemData: ProductQuantityWithSpec = {
      name: product.name,
      quantity: product.quantity,
      weightSpec: product.weightSpec,
      containerSummary: product.containerSummary,
      finishingSummary: product.finishingSummary,
    };

    const sop = product.sop;

    // 사용자의 명시적 지침:
    // "V8은 대상에서 제외, 봉황,팔영/오미트 시그니처,프레스티지만 해당"
    // "스킨팩의 개수만 필요하고 나머지 선물세트 라인업은 무시"
    const isBonghwangOrPalyeong = sop?.id === "bonghwang" || sop?.id === "palyeong" || /봉황|팔영/.test(product.name);
    const isOmeatSignatureOrPrestige =
      sop?.id === "omeat-signature" ||
      sop?.id === "omeat-prestige" ||
      /오미트.*(시그니처|프레스티지)|(시그니처|프레스티지).*오미트|signature|prestige/i.test(product.name);

    if (isBonghwangOrPalyeong) {
      vacuumProducts.push(itemData);
    } else if (isOmeatSignatureOrPrestige) {
      omeatProducts.push(itemData);
    } else {
      otherProducts.push(itemData);
    }

    if (sop) {
      if (isBonghwangOrPalyeong && sop.category === "vacuum") {
        // 봉황(5팩: 180g×4, 280g×1), 팔영(7팩: 180g×7) - 162202 용기 스킨팩
        for (const c of sop.cuts) {
          const key = `${c.cutName}_${c.container}_${c.weight}`;
          const existing = detailed162202Map.get(key);
          if (existing) {
            existing.packs += product.quantity;
            existing.targetSets.push(`${product.name} ${product.quantity}`);
          } else {
            detailed162202Map.set(key, {
              cutName: c.cutName,
              container: c.container,
              weight: c.weight,
              packs: product.quantity,
              targetSets: [`${product.name} ${product.quantity}`],
              note: c.note,
            });
          }
        }
      } else if (isOmeatSignatureOrPrestige && sop.category === "omeat") {
        // 오미트 시그니처(6팩: 200g×5, 300g×1), 프레스티지(6팩: 230g×6) - 241702 용기 스킨팩
        for (const c of sop.cuts) {
          const key = `${c.cutName}_${c.container}_${c.weight}`;
          const existing = detailed241702Map.get(key);
          if (existing) {
            existing.packs += product.quantity;
            existing.targetSets.push(`${product.name} ${product.quantity}`);
          } else {
            detailed241702Map.set(key, {
              cutName: c.cutName,
              container: c.container,
              weight: c.weight,
              packs: product.quantity,
              targetSets: [`${product.name} ${product.quantity}`],
              note: c.note,
            });
          }
        }
      }
      // V8(실속형), LA갈비, 바구니 세트(진·선·미 등)는 스킨팩 필요 팩수 계산에서 완전히 제외됨
    }

    // 하위 호환성 cutMap 집계 (스킨팩 대상 4개 세트에 대해서만 집계)
    if (isBonghwangOrPalyeong || isOmeatSignatureOrPrestige) {
      const cuts = sop ? sop.cuts.map((c) => c.cutName) : getProductCuts(product.productId, product.name);
      for (const cut of cuts) {
        const entry = ensureCut(cut);
        if (isBonghwangOrPalyeong) {
          entry.vacuumPacks += product.quantity;
        } else if (isOmeatSignatureOrPrestige) {
          entry.omeatPacks += product.quantity;
        }
      }
    }
  }

  // 선호 정렬 순서
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

  const sortCuts = (aName: string, bName: string) => {
    const indexA = preferredCutOrder.indexOf(aName);
    const indexB = preferredCutOrder.indexOf(bName);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return aName.localeCompare(bName, "ko");
  };

  const sortDetailedItems = (a: DetailedSkinPackItem, b: DetailedSkinPackItem) => {
    const orderDiff = sortCuts(a.cutName, b.cutName);
    if (orderDiff !== 0) return orderDiff;
    return a.weight.localeCompare(b.weight, "ko");
  };

  const skinPacks162202 = [...detailed162202Map.values()].sort(sortDetailedItems);
  const skinPacks241702 = [...detailed241702Map.values()].sort(sortDetailedItems);
  const skinPacksV8 = [...detailedV8Map.values()];
  const skinPacksLA223003 = [...detailedLA223003Map.values()];

  const cuts: CutPackSummary[] = [...cutMap.values()]
    .map((entry) => ({
      cutName: entry.cutName,
      vacuumPacks: entry.vacuumPacks,
      omeatPacks: entry.omeatPacks,
      otherPacks: entry.otherPacks,
      totalPacks: entry.vacuumPacks + entry.omeatPacks + entry.otherPacks,
    }))
    .sort((a, b) => sortCuts(a.cutName, b.cutName));

  const vacuumCuts: IndividualCutSummary[] = [...cutMap.values()]
    .filter((entry) => entry.vacuumPacks > 0)
    .map((entry) => ({ cutName: entry.cutName, packs: entry.vacuumPacks }))
    .sort((a, b) => sortCuts(a.cutName, b.cutName));

  const omeatCuts: IndividualCutSummary[] = [...cutMap.values()]
    .filter((entry) => entry.omeatPacks > 0)
    .map((entry) => ({ cutName: entry.cutName, packs: entry.omeatPacks }))
    .sort((a, b) => sortCuts(a.cutName, b.cutName));

  const otherCuts: IndividualCutSummary[] = [...cutMap.values()]
    .filter((entry) => entry.otherPacks > 0)
    .map((entry) => ({ cutName: entry.cutName, packs: entry.otherPacks }))
    .sort((a, b) => sortCuts(a.cutName, b.cutName));

  const totalVacuumPacks = skinPacks162202.reduce((sum, item) => sum + item.packs, 0) + skinPacksV8.reduce((sum, item) => sum + item.packs, 0);
  const totalOmeatPacks = skinPacks241702.reduce((sum, item) => sum + item.packs, 0);
  const totalOtherPacks = skinPacksLA223003.reduce((sum, item) => sum + item.packs, 0);
  const totalAllPacks = totalVacuumPacks + totalOmeatPacks + totalOtherPacks;

  return {
    vacuumProducts: vacuumProducts.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "ko")),
    omeatProducts: omeatProducts.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "ko")),
    otherProducts: otherProducts.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "ko")),
    skinPacks162202,
    skinPacks241702,
    skinPacksV8,
    skinPacksLA223003,
    basketOrders,
    vacuumCuts,
    omeatCuts,
    otherCuts,
    totalVacuumPacks,
    totalOmeatPacks,
    totalOtherPacks,
    cuts,
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

export type DailyProductSummaryItem = {
  key: string;
  category: string;
  categoryClass: string;
  categoryOrder: number;
  name: string;
  price: number;
  priceLabel: string;
  quantity: number;
};

export function formatPriceInManwon(price?: number | null): string {
  if (!price || price <= 0) return "";
  if (price % 10000 === 0) {
    return `${price / 10000}만원`;
  }
  const manwon = price / 10000;
  return `${Number(manwon.toFixed(1))}만원`;
}

export function formatKoreanDateWithWeekday(dateStr: string): string {
  if (!dateStr) return "";
  const clean = dateStr.replace(/[^\d-]/g, "").slice(0, 10);
  const parts = clean.split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const [year, month, day] = parts;
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[d.getUTCDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

const MASTER_PRODUCT_CATALOG: Record<
  string,
  {
    category: string;
    categoryClass: string;
    categoryOrder: number;
    displayName: string;
    defaultPrice: number;
  }
> = {
  // 1. 프리미엄 라인업
  jin: {
    category: "프리미엄",
    categoryClass: "premium",
    categoryOrder: 1,
    displayName: "프리미엄 진",
    defaultPrice: 320000,
  },
  seon: {
    category: "프리미엄",
    categoryClass: "premium",
    categoryOrder: 1,
    displayName: "프리미엄 선",
    defaultPrice: 270000,
  },
  mi: {
    category: "프리미엄",
    categoryClass: "premium",
    categoryOrder: 1,
    displayName: "프리미엄 미",
    defaultPrice: 220000,
  },
  // 2. O'meat 라인업
  "omeat-prestige": {
    category: "O'meat",
    categoryClass: "omeat",
    categoryOrder: 2,
    displayName: "오미트 프레스티지",
    defaultPrice: 389000,
  },
  "omeat-signature": {
    category: "O'meat",
    categoryClass: "omeat",
    categoryOrder: 2,
    displayName: "오미트 시그니처",
    defaultPrice: 289000,
  },
  // 3. 진공세트 라인업
  palyeong: {
    category: "진공세트",
    categoryClass: "vacuum",
    categoryOrder: 3,
    displayName: "팔영",
    defaultPrice: 300000,
  },
  bonghwang: {
    category: "진공세트",
    categoryClass: "vacuum",
    categoryOrder: 3,
    displayName: "봉황",
    defaultPrice: 200000,
  },
  practical: {
    category: "진공세트",
    categoryClass: "vacuum",
    categoryOrder: 3,
    displayName: "실속형",
    defaultPrice: 144000,
  },
  // 4. LA갈비 라인업
  "la-2": {
    category: "LA갈비",
    categoryClass: "la",
    categoryOrder: 4,
    displayName: "LA갈비 2호",
    defaultPrice: 148000,
  },
  "la-1": {
    category: "LA갈비",
    categoryClass: "la",
    categoryOrder: 4,
    displayName: "LA갈비 1호",
    defaultPrice: 99000,
  },
  // 5. 뼈세트 라인업
  "bone-2": {
    category: "뼈세트",
    categoryClass: "bone",
    categoryOrder: 5,
    displayName: "사골×잡뼈×꼬리",
    defaultPrice: 99000,
  },
  "bone-1": {
    category: "뼈세트",
    categoryClass: "bone",
    categoryOrder: 5,
    displayName: "사골×우족",
    defaultPrice: 59000,
  },
};

export function resolveProductSummaryMeta(item: {
  productId?: string;
  productName?: string;
  unitPrice?: number;
}): {
  key: string;
  category: string;
  categoryClass: string;
  categoryOrder: number;
  name: string;
  price: number;
  priceLabel: string;
} {
  const pId = (item.productId || "").toLowerCase().trim();
  const rawName = (item.productName || "").trim();

  // 1. productId 매칭
  if (pId && MASTER_PRODUCT_CATALOG[pId]) {
    const meta = MASTER_PRODUCT_CATALOG[pId];
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: pId,
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }

  // 2. productName 텍스트 매칭
  const norm = rawName.replace(/[\s()（）·×'-]/g, "").toLowerCase();

  if (/프레스티지|prestige/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG["omeat-prestige"];
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "omeat-prestige",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/시그니처|signature/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG["omeat-signature"];
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "omeat-signature",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/프리미엄진|^진$|진세트|진\b/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG.jin;
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "jin",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/프리미엄선|^선$|선세트|선\b/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG.seon;
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "seon",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/프리미엄미|^미$|미세트|미\b/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG.mi;
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "mi",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/팔영/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG.palyeong;
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "palyeong",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/봉황/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG.bonghwang;
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "bonghwang",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/실속/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG.practical;
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "practical",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/la.*2|la갈비2/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG["la-2"];
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "la-2",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/la.*1|la갈비1|la갈비|la/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG["la-1"];
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "la-1",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/잡뼈|꼬리|사골잡뼈꼬리/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG["bone-2"];
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "bone-2",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }
  if (/우족|사골우족/.test(norm)) {
    const meta = MASTER_PRODUCT_CATALOG["bone-1"];
    const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : meta.defaultPrice;
    return {
      key: "bone-1",
      category: meta.category,
      categoryClass: meta.categoryClass,
      categoryOrder: meta.categoryOrder,
      name: meta.displayName,
      price,
      priceLabel: formatPriceInManwon(price),
    };
  }

  // 3. 맞춤주문 또는 기타 품목
  const isCustom = pId === "custom-order" || /맞춤/.test(norm);
  const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : 0;
  const name = rawName || (isCustom ? "맞춤주문" : "기타 상품");
  const key = `${pId || "other"}_${name}_${price}`;

  return {
    key,
    category: isCustom ? "맞춤주문" : "기타",
    categoryClass: isCustom ? "custom" : "other",
    categoryOrder: isCustom ? 6 : 7,
    name,
    price,
    priceLabel: formatPriceInManwon(price),
  };
}

export function calculateDailyProductSummary(items: WorkItemLike[]): DailyProductSummaryItem[] {
  const activeItems = items.filter((item) => item.workStatus !== "cancelled");
  const map = new Map<string, DailyProductSummaryItem>();

  for (const item of activeItems) {
    const qty = Number(item.quantity) || 1;
    if (qty <= 0) continue;

    const meta = resolveProductSummaryMeta(item);
    const existing = map.get(meta.key);
    if (existing) {
      existing.quantity += qty;
    } else {
      map.set(meta.key, { ...meta, quantity: qty });
    }
  }

  return Array.from(map.values())
    .filter((item) => item.quantity > 0)
    .sort((a, b) => {
      // 1순위: 라인업(카테고리) 순서
      if (a.categoryOrder !== b.categoryOrder) {
        return a.categoryOrder - b.categoryOrder;
      }
      // 2순위: 같은 라인업 내에서 가격 높은 순 (내림차순)
      if (b.price !== a.price) {
        return b.price - a.price;
      }
      // 3순위: 이름 가나다순
      return a.name.localeCompare(b.name, "ko");
    });
}


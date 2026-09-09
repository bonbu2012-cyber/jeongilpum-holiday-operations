export type CatalogProductDetails = {
  tagline: string;
  servings: string | null;
  totalWeight: string;
  components: string[];
};

export const CATALOG_PRODUCT_DETAILS: Record<string, CatalogProductDetails> = {
  practical: {
    tagline: "부담 없이 즐기는 알찬 한우 구이 모둠",
    servings: "약 4인분",
    totalWeight: "600g",
    components: ["부채살", "업진살", "제비추리", "채끝"],
  },
  bonghwang: {
    tagline: "육향과 식감의 조화를 고르게 담은 인기 한우 세트",
    servings: "약 6~7인분",
    totalWeight: "1kg",
    components: ["치마살", "갈비살", "부채살", "제비추리", "차돌박이"],
  },
  palyeong: {
    tagline: "일곱 가지 부위로 풍성하게 즐기는 한우 구이 세트",
    servings: "약 8인분",
    totalWeight: "1.26kg",
    components: ["치마살", "업진살", "부채살", "갈비살", "살치살", "제비추리", "채끝"],
  },
  jin: {
    tagline: "안창살과 살치살까지 담은 최상급 프리미엄 구성",
    servings: "약 8~9인분",
    totalWeight: "1.33kg",
    components: ["안창살", "살치살", "치마살", "갈비살", "부채살", "채끝", "제비추리"],
  },
  seon: {
    tagline: "부드러운 식감과 진한 육향을 균형 있게 담은 구성",
    servings: "약 7~8인분",
    totalWeight: "1.15kg",
    components: ["치마살", "업진살", "부채살", "갈비살", "살치살", "채끝"],
  },
  mi: {
    tagline: "선호도 높은 다섯 가지 부위를 알차게 담은 구성",
    servings: "약 6~7인분",
    totalWeight: "1kg",
    components: ["치마살", "업진살", "부채살", "갈비살", "제비추리"],
  },
  "omeat-signature": {
    tagline: "여섯 가지 한우 부위와 전용 패키지가 어우러진 품격 있는 선물",
    servings: "약 8~9인분",
    totalWeight: "1.3kg",
    components: ["치마살", "부채살", "갈비살", "제비추리", "채끝", "차돌박이"],
  },
  "omeat-prestige": {
    tagline: "안창살과 살치살을 더해 특별함을 높인 최고급 한우 선물",
    servings: "약 9인분",
    totalWeight: "1.38kg",
    components: ["부채살", "업진살", "갈비살", "살치살", "채끝", "안창살"],
  },
  "la-1": {
    tagline: "부드러운 육질과 풍부한 육즙을 즐기는 프라임 LA갈비",
    servings: "약 6인분",
    totalWeight: "1.8kg(뼈 포함)",
    components: ["미국산 USDA 프라임 LA갈비"],
  },
  "la-2": {
    tagline: "온 가족이 넉넉하게 즐기는 대용량 프라임 LA갈비",
    servings: "약 9인분",
    totalWeight: "2.7kg(뼈 포함)",
    components: ["미국산 USDA 프라임 LA갈비"],
  },
  "bone-1": {
    tagline: "깊고 진한 국물 요리에 어울리는 한우 보양 세트",
    servings: null,
    totalWeight: "5kg",
    components: ["한우 사골", "한우 우족"],
  },
  "bone-2": {
    tagline: "세 가지 한우 뼈 부위를 풍성하게 담은 종합 국물 세트",
    servings: null,
    totalWeight: "6.5kg",
    components: ["한우 꼬리", "한우 사골", "한우 잡뼈"],
  },
};

function normalizeProductName(value: string) {
  return value
    .toLocaleLowerCase("ko-KR")
    .replaceAll("’", "'")
    .replace(/[\s()（）·×'-]/g, "");
}

const PRODUCT_ALIASES: Record<string, string[]> = {
  practical: ["실속형", "실속세트"],
  bonghwang: ["봉황", "봉황세트"],
  palyeong: ["팔영", "팔영세트"],
  jin: ["진", "진세트", "진(眞)"],
  seon: ["선", "선세트", "선(善)"],
  mi: ["미", "미세트", "미(美)"],
  "omeat-signature": ["O'meat Signature", "O'meat 시그니처", "오미트 시그니처"],
  "omeat-prestige": ["O'meat Prestige", "O'meat 프레스티지", "오미트 프레스티지"],
  "la-1": ["LA갈비 1호"],
  "la-2": ["LA갈비 2호"],
  "bone-1": ["사골×우족", "사골 우족"],
  "bone-2": ["사골×잡뼈×꼬리", "사골 잡뼈 꼬리"],
};

const aliases = new Map<string, CatalogProductDetails>();
for (const [productId, productAliases] of Object.entries(PRODUCT_ALIASES)) {
  const details = CATALOG_PRODUCT_DETAILS[productId];
  for (const alias of productAliases) aliases.set(normalizeProductName(alias), details);
}

export function resolveCatalogProductDetails(product: { id: string; name: string }) {
  return CATALOG_PRODUCT_DETAILS[product.id] ?? aliases.get(normalizeProductName(product.name));
}

export type TrackedSetProduct = {
  id: string;
  name: string;
  components: Array<{ code: string; name: string }>;
};

export type SetDemand = {
  productId: string;
  productName: string;
  quantity: number;
};

export const TRACKED_SET_PRODUCTS: TrackedSetProduct[] = [
  {
    id: "bonghwang",
    name: "봉황세트",
    components: [
      { code: "CM", name: "치마살" },
      { code: "GB", name: "갈비살" },
      { code: "BC", name: "부채살" },
      { code: "JJ", name: "제비추리" },
      { code: "CD", name: "차돌박이" },
    ],
  },
  {
    id: "palyeong",
    name: "팔영세트",
    components: [
      { code: "CM", name: "치마살" },
      { code: "UJ", name: "업진살" },
      { code: "BC", name: "부채살" },
      { code: "GB", name: "갈비살" },
      { code: "SC", name: "살치살" },
      { code: "JJ", name: "제비추리" },
      { code: "CE", name: "채끝" },
    ],
  },
  {
    id: "omeat-signature",
    name: "오미트 시그니처",
    components: [
      { code: "CM", name: "치마살" },
      { code: "BC", name: "부채살" },
      { code: "GB", name: "갈비살" },
      { code: "JJ", name: "제비추리" },
      { code: "CE", name: "채끝" },
      { code: "CD", name: "차돌박이" },
    ],
  },
  {
    id: "omeat-prestige",
    name: "오미트 프레스티지",
    components: [
      { code: "BC", name: "부채살" },
      { code: "UJ", name: "업진살" },
      { code: "GB", name: "갈비살" },
      { code: "SC", name: "살치살" },
      { code: "CE", name: "채끝" },
      { code: "AC", name: "안창살" },
    ],
  },
];

const COMPONENT_ORDER = ["CM", "GB", "BC", "JJ", "CD", "UJ", "SC", "CE", "AC"];

export function aggregateDailySkinPackRequirements(demands: SetDemand[]) {
  const demandByProduct = new Map<string, number>();
  for (const demand of demands) {
    if (!Number.isFinite(demand.quantity) || demand.quantity <= 0) continue;
    demandByProduct.set(demand.productId, (demandByProduct.get(demand.productId) ?? 0) + demand.quantity);
  }

  const products = TRACKED_SET_PRODUCTS.map((product) => ({
    productId: product.id,
    productName: product.name,
    setQuantity: demandByProduct.get(product.id) ?? 0,
    packQuantity: (demandByProduct.get(product.id) ?? 0) * product.components.length,
  }));
  const requirements = new Map<string, {
    componentCode: string;
    componentName: string;
    requiredQuantity: number;
    byProduct: Record<string, number>;
  }>();

  for (const product of TRACKED_SET_PRODUCTS) {
    const setQuantity = demandByProduct.get(product.id) ?? 0;
    if (!setQuantity) continue;
    for (const component of product.components) {
      const current = requirements.get(component.code) ?? {
        componentCode: component.code,
        componentName: component.name,
        requiredQuantity: 0,
        byProduct: {},
      };
      current.requiredQuantity += setQuantity;
      current.byProduct[product.id] = (current.byProduct[product.id] ?? 0) + setQuantity;
      requirements.set(component.code, current);
    }
  }

  const rows = [...requirements.values()].sort((left, right) => (
    COMPONENT_ORDER.indexOf(left.componentCode) - COMPONENT_ORDER.indexOf(right.componentCode)
  ));
  return {
    products,
    requirements: rows,
    totalSetQuantity: products.reduce((sum, product) => sum + product.setQuantity, 0),
    totalPackQuantity: rows.reduce((sum, row) => sum + row.requiredQuantity, 0),
  };
}

export type ProductDemand = { productId: string; productName: string; quantity: number };
export type BomComponent = { productId: string; componentId: string; componentCode: string; componentName: string; quantityPerProduct: number };
export type ComponentRequirement = { componentCode: string; componentName: string; requiredQuantity: number; availableQuantity: number; additionalNeeded: number; sourceProducts: string[] };
export type SkinPackLabelPayload = {
  skinPackCode: string;
  cutName: string;
  weightG: number;
  traceabilityNo: string;
  origin: string;
  slaughterhouse: string;
  grade: string;
  manufacturedAt: string;
  storageMethod: string;
  expiryText: string;
  packagingMaterial: string;
  foodType: string;
};

export function additionalNeeded(requiredQuantity: number, availableQuantity: number) {
  return Math.max(0, requiredQuantity - availableQuantity);
}

export function aggregateProductionNeeds(demands: ProductDemand[], bom: BomComponent[], availableByComponent: Record<string, number> = {}) {
  const requirements = new Map<string, ComponentRequirement>();
  const missingProducts: ProductDemand[] = [];
  for (const demand of demands) {
    const components = bom.filter((component) => component.productId === demand.productId);
    if (!components.length) {
      missingProducts.push(demand);
      continue;
    }
    for (const component of components) {
      const required = demand.quantity * component.quantityPerProduct;
      const current = requirements.get(component.componentCode) ?? {
        componentCode: component.componentCode,
        componentName: component.componentName,
        requiredQuantity: 0,
        availableQuantity: availableByComponent[component.componentCode] ?? 0,
        additionalNeeded: 0,
        sourceProducts: [],
      };
      current.requiredQuantity += required;
      if (!current.sourceProducts.includes(demand.productName)) current.sourceProducts.push(demand.productName);
      current.additionalNeeded = additionalNeeded(current.requiredQuantity, current.availableQuantity);
      requirements.set(component.componentCode, current);
    }
  }
  return { requirements: [...requirements.values()].sort((a, b) => a.componentName.localeCompare(b.componentName, "ko")), missingProducts };
}

export function buildSkinPackCode(componentCode: string, productionDate: string, sequence: number) {
  const prefix = componentCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "SP";
  const date = productionDate.replaceAll("-", "").slice(2);
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("스킨팩 순번은 1 이상이어야 합니다.");
  return `${prefix}-${date}-${String(sequence).padStart(4, "0")}`;
}

export function validateSkinPackWeight(weightG: number) {
  return Number.isInteger(weightG) && weightG > 0 && weightG <= 1_000_000;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function skinPackLabelsToLongCsv(rows: SkinPackLabelPayload[]) {
  const headers = ["skin_pack_code", "cut_name", "weight_g", "traceability_no", "origin", "slaughterhouse", "grade", "manufactured_at", "storage_method", "expiry_text", "packaging_material", "food_type"];
  const body = rows.map((row) => [row.skinPackCode, row.cutName, row.weightG, row.traceabilityNo, row.origin, row.slaughterhouse, row.grade, row.manufacturedAt, row.storageMethod, row.expiryText, row.packagingMaterial, row.foodType].map(csvCell).join(","));
  return `${headers.join(",")}\r\n${body.join("\r\n")}${body.length ? "\r\n" : ""}`;
}

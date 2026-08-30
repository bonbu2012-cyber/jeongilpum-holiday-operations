import type { ComponentRequirement, ProductDemand } from "./production-domain";

export type ProductionBatch = {
  id: string;
  productionDate: string;
  parentBatchId: string | null;
  segmentNo: number;
  componentCode: string;
  cutName: string;
  requiredQuantity: number;
  availableQuantityAtStart: number;
  additionalNeeded: number;
  productionTarget: number;
  producedQuantity: number;
  traceabilityNo: string;
  origin: string;
  slaughterhouse: string;
  cattleType: string;
  grade: string;
  storageMethod: string;
  expiryText: string;
  packagingMaterial: string;
  foodType: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
};

export type RecentProductionTrace = { traceabilityNo: string; origin: string; slaughterhouse: string; cattleType: string; grade: string; lastUsedAt: string };
export type ProductionOverview = { requirements: ComponentRequirement[]; missingProducts: ProductDemand[]; batches: ProductionBatch[]; recentTraceability: RecentProductionTrace[] };

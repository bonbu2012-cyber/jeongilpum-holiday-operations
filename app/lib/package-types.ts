export type PackageSkinPackRecord = {
  id: string;
  skinPackCode: string;
  componentName: string;
  componentCode: string;
  quantitySlot: number;
  weightG: number;
  traceabilityNo: string;
  origin: string;
  slaughterhouse: string;
  cattleType: string;
  grade: string;
  manufacturedAt: string;
  storageMethod: string;
  expiryText: string;
  packagingMaterial: string;
  foodType: string;
};

export type PackageLabelRecord = {
  version: number;
  status: "draft" | "printed" | "void";
  createdAt: string;
  printedAt: string | null;
  voidedAt: string | null;
};

export type PackageAssignmentRecord = {
  id: string;
  reason: string;
  fromOrderNo: string | null;
  toOrderNo: string;
  changedAt: string;
};

export type PackageAuditEvent = { id: string; type: string; createdAt: string };

export type WorkshopPackageDetail = {
  packageId: string;
  orderId: string;
  packageCode: string;
  packageStatus: string;
  orderNo: string;
  productName: string;
  fulfillmentType: "pickup" | "shipping";
  schedule: string;
  qrValue: string;
  skinPacks: PackageSkinPackRecord[];
  labels: PackageLabelRecord[];
  assignmentHistory: PackageAssignmentRecord[];
  auditEvents: PackageAuditEvent[];
  labelActionRequired: "VOID_AND_REPRINT" | null;
};
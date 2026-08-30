export type PackageComponentRecord = {
  id: string;
  componentName: string;
  sortOrder: number;
  traceabilityRequired: boolean;
  weightRequired: boolean;
  originRequired: boolean;
  slaughterhouseRequired: boolean;
  traceabilityNo: string | null;
  weightG: number | null;
  origin: string;
  slaughterhouse: string;
  cattleType: string;
  grade: string;
};

export type RecentTraceability = {
  traceabilityNo: string;
  origin: string;
  slaughterhouse: string;
  cattleType: string;
  grade: string;
  lastUsedAt: string;
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

export type PackageAuditEvent = {
  id: string;
  type: string;
  createdAt: string;
};
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
  components: PackageComponentRecord[];
  recentTraceability: RecentTraceability[];
  labels: PackageLabelRecord[];
  assignmentHistory: PackageAssignmentRecord[];
  auditEvents: PackageAuditEvent[];
  labelActionRequired: "VOID_AND_REPRINT" | null;
};

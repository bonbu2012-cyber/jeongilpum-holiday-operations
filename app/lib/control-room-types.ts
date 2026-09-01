export type ControlRoomSeverity = "critical" | "warning" | "production";

export type ControlRoomAlert = {
  id: string;
  severity: ControlRoomSeverity;
  area: "sales" | "workshop" | "production";
  title: string;
  detail: string;
  href: string;
};

export type ControlRoomOrderSummary = {
  total: number;
  totalSets: number;
  onsite: number;
  pickup: number;
  shipping: number;
  waiting: number;
  inProgress: number;
  ready: number;
  fulfilled: number;
  arrived: number;
  dueSoon: number;
  overdue: number;
  changes: number;
};

export type ControlRoomWorkshopSummary = {
  waiting: number;
  accepted: number;
  inProgress: number;
  ready: number;
  urgent: number;
};

export type ControlRoomProductionSummary = {
  available: boolean;
  requiredPacks: number;
  availablePacks: number;
  shortagePacks: number;
  uncoveredPacks: number;
  missingBomProducts: number;
  activeBatches: number;
  batchTarget: number;
  batchProduced: number;
};

export type ControlRoomPackageSummary = {
  total: number;
  completed: number;
  incomplete: number;
  completionRate: number;
};

export type ControlRoomLiveResponse = {
  date: string;
  generatedAt: string;
  orders: ControlRoomOrderSummary;
  workshop: ControlRoomWorkshopSummary;
  production: ControlRoomProductionSummary;
  packages: ControlRoomPackageSummary;
  alerts: ControlRoomAlert[];
};

export type ControlRoomForecastDay = {
  date: string;
  orderCount: number;
  totalSets: number;
  onsite: number;
  pickup: number;
  shipping: number;
  packageTotal: number;
  packageCompleted: number;
  productionAvailable: boolean;
  requiredPacks: number;
  shortagePacks: number;
  missingBomProducts: number;
};

export type ControlRoomForecastResponse = {
  startDate: string;
  days: number;
  generatedAt: string;
  forecast: ControlRoomForecastDay[];
};

export type ControlRoomLedgerSummary = {
  totalOrdered: number;
  netReceived: number;
  receivable: number;
  advance: number;
  receivableCustomers: number;
  advanceCustomers: number;
};


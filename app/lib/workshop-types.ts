import type { OrderStatus } from "../components/types";

export type WorkshopItem = {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  packageTotal: number;
  packageCompleted: number;
  hasCustomization: boolean;
};

export type SubstituteCandidate = {
  packageId: string;
  packageCode: string;
  productId: string;
  productName: string;
  sourceOrderId: string;
  sourceOrderNo: string;
  sourcePickupAt: string;
};

export type WorkshopEvent = {
  id: string;
  type: string;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
};

export type WorkshopOrder = {
  id: string;
  orderNo: string;
  buyerName: string;
  status: OrderStatus;
  version: number;
  submittedAt: string;
  fulfillmentId: string;
  fulfillmentType: "pickup" | "shipping";
  pickupAt: string | null;
  shipDate: string | null;
  scheduleLabel: string;
  customerArrived: boolean;
  actualArrivedAt: string | null;
  arrivalOffsetMinutes: number | null;
  note: string;
  hasSpecialRequest: boolean;
  items: WorkshopItem[];
  packageTotal: number;
  packageCompleted: number;
  hasUnacknowledgedChange: boolean;
  changeSeverity: "before_start" | "after_start" | null;
  workAcceptedAt: string | null;
  workAcceptedBy: string | null;
  workStartedAt: string | null;
  workCompletedAt: string | null;
  substituteCandidates: SubstituteCandidate[];
  events: WorkshopEvent[];
};
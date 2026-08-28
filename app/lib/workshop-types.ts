import type { OrderStatus } from "../components/types";

export type WorkshopItem = {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  packageTotal: number;
  packageCompleted: number;
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
  note: string;
  items: WorkshopItem[];
  packageTotal: number;
  packageCompleted: number;
  hasUnacknowledgedChange: boolean;
  workAcceptedAt: string | null;
  workStartedAt: string | null;
  workCompletedAt: string | null;
  events: WorkshopEvent[];
};

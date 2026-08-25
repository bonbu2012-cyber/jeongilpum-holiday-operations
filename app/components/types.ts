export type Product = {
  id: string;
  category: string;
  code: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  customerDisplayWeight: string | null;
  imageUrl: string | null;
  badge: string | null;
};

export type SeasonSchedule = {
  id: string;
  name: string;
  holidayDate: string;
  salesStartDate: string;
  salesEndDate: string;
};

export type OrderStatus = "submitted" | "confirmed" | "in_progress" | "ready" | "fulfilled" | "cancelled";

export type OrderItem = {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type OrderRecord = {
  id: string;
  orderNo: string;
  buyerName: string;
  buyerPhone: string;
  status: OrderStatus;
  fulfillmentType: "pickup" | "shipping";
  scheduleLabel: string;
  fulfillmentId: string | null;
  pickupAt: string | null;
  shipDate: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  postalCode: string | null;
  roadAddress: string | null;
  roadAddrReference: string | null;
  jibunAddr: string | null;
  detailAddress: string | null;
  customerArrived: boolean;
  note: string;
  totalAmount: number;
  version: number;
  submittedAt: string;
  items: OrderItem[];
  packageCodes: string[];
};

export type OrderDraft = {
  cart: Record<string, number>;
  fulfillmentType: "pickup" | "shipping" | null;
  buyerName: string;
  buyerPhone: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  roadAddr: string;
  roadAddrReference: string;
  jibunAddr: string;
  detailAddr: string;
  addressMode: "search" | "manual";
  pickupDate: string;
  pickupTime: string;
  shipDate: string;
  note: string;
  scheduleLabel: string;
  idempotencyKey: string;
};

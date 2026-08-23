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
  recipientName: string | null;
  recipientPhone: string | null;
  roadAddress: string | null;
  detailAddress: string | null;
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
  roadAddress: string;
  detailAddress: string;
  note: string;
  scheduleLabel: string;
  idempotencyKey: string;
};

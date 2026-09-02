export type CustomOrderDraftItem = {
  category: "진공세트" | "프리미엄" | "O'meat" | "LA갈비" | "뼈세트";
  budgetOption: string;
  budgetAmount: number;
  desiredComposition: string;
  preferredCut: string;
  fatPreference: string;
  packagingRequest: string;
  otherRequest: string;
};

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
  dailyLimit: number | null;
  reservedQuantity: number;
  remainingQuantity: number | null;
  availabilityDate: string;
};

export type SeasonSchedule = {
  salesStartDate: string;
  salesEndDate: string;
};

export type PaymentStatus = "unpaid" | "partial" | "paid";
export type PaymentMethod = "card" | "cash" | "bank_transfer";
export type FulfillmentType = "onsite" | "pickup" | "shipping";
export type OrderPaymentChoice = PaymentMethod | "later";
export type DeliveryMethod = "onsite_sale" | "onsite_reservation" | "delivery";
export type WorkStatus = "received" | "confirmed" | "in_progress" | "ready" | "completed" | "cancelled";

export type KioskOrderReceipt = {
  orderNo: string;
  fulfillmentType: FulfillmentType;
  scheduleLabel: string;
};

export type WorkItemEventRecord = {
  id: string;
  type: string;
  fromValue: string | null;
  toValue: string | null;
  actor: string;
  createdAt: string;
};

export type OrderRecord = KioskOrderReceipt & {
  id: string;
  orderId: string;
  buyerName: string;
  buyerPhone: string;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  totalAmount: number;
  customerArrivedAt: string | null;
  customerNote: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  deliveryMethod: DeliveryMethod;
  dueAt: string;
  workStatus: WorkStatus;
  recipientName: string | null;
  recipientPhone: string | null;
  postalCode: string | null;
  roadAddr: string | null;
  roadAddrReference: string | null;
  jibunAddr: string | null;
  detailAddr: string | null;
  customization: CustomOrderDraftItem | null;
  note: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  events: WorkItemEventRecord[];
};

export type OrderDraft = {
  cart: Record<string, number>;
  customItem: CustomOrderDraftItem | null;
  fulfillmentType: FulfillmentType | null;
  paymentMethod: OrderPaymentChoice | null;
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

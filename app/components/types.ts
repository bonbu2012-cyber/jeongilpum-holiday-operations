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
  id: string;
  name: string;
  holidayDate: string;
  salesStartDate: string;
  salesEndDate: string;
};

export type OrderStatus = "submitted" | "confirmed" | "in_progress" | "ready" | "fulfilled" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "credit";
export type PaymentMethod = "card" | "cash" | "bank_transfer";
export type FulfillmentType = "onsite" | "pickup" | "shipping";
export type OrderPaymentChoice = PaymentMethod | "later";
export type CustomerPaymentStatus = "credit" | "partial" | "paid" | "advance";

export type OrderItem = {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  customization?: CustomOrderDraftItem | null;
};

export type PaymentRecord = {
  id: string;
  type: "payment" | "refund" | "adjustment";
  method: PaymentMethod | null;
  amount: number;
  paidAt: string;
  recordedBy: string;
  memo: string;
};

export type OrderEventRecord = {
  id: string;
  type: string;
  reason: string | null;
  createdAt: string;
};

export type OrderRecord = {
  id: string;
  orderNo: string;
  buyerName: string;
  buyerPhone: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
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
  actualArrivedAt: string | null;
  arrivalOffsetMinutes: number | null;
  substituteCandidateCount: number;
  note: string;
  totalAmount: number;
  customerAccountId: string | null;
  customerTotalOrdered: number;
  customerNetReceived: number;
  customerReceivable: number;
  customerAdvance: number;
  customerPaymentStatus: CustomerPaymentStatus;
  paidAmount: number;
  balance: number;
  paymentStatus: PaymentStatus;
  creditDueDate: string | null;
  creditMemo: string | null;
  version: number;
  submittedAt: string;
  items: OrderItem[];
  payments: PaymentRecord[];
  packageCodes: string[];
  packageTotal: number;
  packageCompleted: number;
  hasUnacknowledgedChange: boolean;
  workAcceptedAt?: string | null;
  workStartedAt?: string | null;
  workCompletedAt?: string | null;
  events: OrderEventRecord[];
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

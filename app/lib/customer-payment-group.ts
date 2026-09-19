export type PaymentStatus = "unpaid" | "partial" | "paid";

export function normalizeCustomerName(value: string) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeCustomerPhone(value: string) {
  return (value || "").replace(/\D/g, "");
}

export function formatKoreanPhoneDisplay(value: string) {
  const digits = normalizeCustomerPhone(value);
  if (!digits) return "";
  const areaLength = digits.startsWith("02") ? 2 : 3;
  const area = digits.slice(0, areaLength);
  const rest = digits.slice(areaLength);
  if (!rest) return area;
  const subscriberLength = digits.length === areaLength + 7 ? 3 : 4;
  if (rest.length <= subscriberLength) return `${area}-${rest}`;
  return `${area}-${rest.slice(0, subscriberLength)}-${rest.slice(subscriberLength)}`;
}

export type CustomerDistinctOrder = {
  id: string;
  orderNo: string;
  orderVersion: number;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  totalAmount: number;
  balance: number;
  itemsSummary: string;
  dueScheduleSummary?: string;
  createdAt?: string;
};

export type CustomerGroupSummary<Row> = {
  id: string;
  customerKey: string;
  buyerName: string;
  buyerPhone: string;
  formattedPhone: string;
  orders: CustomerDistinctOrder[];
  totalOrders: number;
  totalItems: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  allPaid: boolean;
  rows: Row[];
};

export function getCustomerKey(name: string, phone: string): string {
  const normName = normalizeCustomerName(name || "");
  const normPhone = normalizeCustomerPhone(phone || "");
  return `${normName}\u0000${normPhone}`;
}

export type WorkItemLike = {
  id: string;
  orderId: string;
  orderNo: string;
  orderVersion: number;
  buyerName: string;
  buyerPhone: string;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  totalAmount: number;
  quantity: number;
  productName: string;
  deliveryMethod?: string;
  dueAt?: string;
  createdAt?: string;
};

export type CustomerOrderRowLike = {
  id: string;
  orderNo: string;
  version: number;
  buyerName: string;
  buyerPhone: string;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  totalAmount: number;
  balance: number;
  createdAt?: string;
  workItems?: Array<{
    id: string;
    productName: string;
    quantity: number;
  }>;
};

export function groupWorkItemsByCustomer<T extends WorkItemLike>(
  items: T[],
  formatDueSchedule?: (item: T) => string
): CustomerGroupSummary<T>[] {
  const groupMap = new Map<string, CustomerGroupSummary<T>>();

  for (const item of items) {
    const key = getCustomerKey(item.buyerName, item.buyerPhone);
    let group = groupMap.get(key);
    if (!group) {
      const cleanPhone = normalizeCustomerPhone(item.buyerPhone);
      group = {
        id: key,
        customerKey: key,
        buyerName: item.buyerName.trim(),
        buyerPhone: item.buyerPhone,
        formattedPhone: formatKoreanPhoneDisplay(cleanPhone) || item.buyerPhone,
        orders: [],
        totalOrders: 0,
        totalItems: 0,
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
        allPaid: false,
        rows: [],
      };
      groupMap.set(key, group);
    }
    group.rows.push(item);
    group.totalItems += item.quantity;
  }

  for (const group of groupMap.values()) {
    const orderMap = new Map<string, CustomerDistinctOrder>();
    for (const item of group.rows) {
      let ord = orderMap.get(item.orderId);
      if (!ord) {
        const balance = Math.max(0, item.totalAmount - item.paidAmount);
        ord = {
          id: item.orderId,
          orderNo: item.orderNo,
          orderVersion: item.orderVersion,
          paymentStatus: item.paymentStatus,
          paidAmount: item.paidAmount,
          totalAmount: item.totalAmount,
          balance,
          itemsSummary: "",
          dueScheduleSummary: formatDueSchedule ? formatDueSchedule(item) : undefined,
          createdAt: item.createdAt,
        };
        orderMap.set(item.orderId, ord);
      }
    }

    // Build itemsSummary for each order
    for (const ord of orderMap.values()) {
      const orderItems = group.rows.filter((r) => r.orderId === ord.id);
      ord.itemsSummary = orderItems.map((r) => `${r.productName} ${r.quantity}개`).join(", ");
    }

    group.orders = Array.from(orderMap.values());
    group.totalOrders = group.orders.length;
    group.totalAmount = group.orders.reduce((sum, o) => sum + o.totalAmount, 0);
    group.paidAmount = group.orders.reduce((sum, o) => sum + o.paidAmount, 0);
    group.unpaidAmount = group.orders.reduce((sum, o) => sum + o.balance, 0);
    group.allPaid = group.unpaidAmount === 0 && group.totalAmount > 0;
  }

  return Array.from(groupMap.values());
}

export function groupCustomerOrdersByCustomer<T extends CustomerOrderRowLike>(
  orders: T[],
  formatDueSummary?: (order: T) => string
): CustomerGroupSummary<T>[] {
  const groupMap = new Map<string, CustomerGroupSummary<T>>();

  for (const order of orders) {
    const key = getCustomerKey(order.buyerName, order.buyerPhone);
    let group = groupMap.get(key);
    if (!group) {
      const cleanPhone = normalizeCustomerPhone(order.buyerPhone);
      group = {
        id: key,
        customerKey: key,
        buyerName: order.buyerName.trim(),
        buyerPhone: order.buyerPhone,
        formattedPhone: formatKoreanPhoneDisplay(cleanPhone) || order.buyerPhone,
        orders: [],
        totalOrders: 0,
        totalItems: 0,
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
        allPaid: false,
        rows: [],
      };
      groupMap.set(key, group);
    }
    group.rows.push(order);
    const balance = Math.max(0, order.totalAmount - order.paidAmount);
    const itemsCount = (order.workItems || []).reduce((s, it) => s + it.quantity, 0);
    group.totalItems += itemsCount;

    const itemsSummary = (order.workItems || [])
      .map((it) => `${it.productName} ${it.quantity}개`)
      .join(", ") || "작업 미등록";
    const dueScheduleSummary = formatDueSummary ? formatDueSummary(order) : undefined;

    group.orders.push({
      id: order.id,
      orderNo: order.orderNo,
      orderVersion: order.version,
      paymentStatus: order.paymentStatus,
      paidAmount: order.paidAmount,
      totalAmount: order.totalAmount,
      balance,
      itemsSummary,
      dueScheduleSummary,
      createdAt: order.createdAt,
    });
  }

  for (const group of groupMap.values()) {
    group.totalOrders = group.orders.length;
    group.totalAmount = group.orders.reduce((sum, o) => sum + o.totalAmount, 0);
    group.paidAmount = group.orders.reduce((sum, o) => sum + o.paidAmount, 0);
    group.unpaidAmount = group.orders.reduce((sum, o) => sum + o.balance, 0);
    group.allPaid = group.unpaidAmount === 0 && group.totalAmount > 0;
  }

  return Array.from(groupMap.values());
}

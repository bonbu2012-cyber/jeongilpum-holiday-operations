import assert from "node:assert/strict";
import test from "node:test";
import {
  getCustomerKey,
  groupWorkItemsByCustomer,
  groupCustomerOrdersByCustomer,
} from "../app/lib/customer-payment-group.ts";

test("getCustomerKey normalizes name whitespace and phone digits accurately", () => {
  const key1 = getCustomerKey("신진식", "010-3640-3420");
  const key2 = getCustomerKey("  신진식  ", "01036403420");
  const key3 = getCustomerKey("신 진 식", "010-3640-3420");

  assert.equal(key1, key2);
  // Phone numbers with different characters
  assert.equal(getCustomerKey("홍길동", "010.1234.5678"), getCustomerKey("홍길동", "010-1234-5678"));
});

test("groupWorkItemsByCustomer correctly aggregates distinct orders and calculates unpaid balance without duplicate counts", () => {
  // Scenario matching user screenshot: Customer '신진식' has 6 work items across 3 distinct orders
  // Order 1: 2 items (선 1개 270,000 + 선 1개 270,000 = 540,000), paid 270,000 (prepaid card) => balance 270,000
  // Order 2: 1 item (선 1개 270,000), paid 0 => balance 270,000
  // Order 3: 3 items (미 220,000 + 선 270,000 + 진 320,000 = 810,000), paid 0 => balance 810,000
  // Total Ordered: 540,000 + 270,000 + 810,000 = 1,620,000
  // Total Paid: 270,000
  // Total Unpaid: 270,000 + 270,000 + 810,000 = 1,350,000
  const mockWorkItems = [
    {
      id: "item-1",
      orderId: "order-1",
      orderNo: "260917-01",
      orderVersion: 1,
      buyerName: "신진식",
      buyerPhone: "010-3640-3420",
      paymentStatus: "partial",
      paidAmount: 270000,
      totalAmount: 540000,
      quantity: 1,
      productName: "선",
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-18T10:00:00+09:00",
    },
    {
      id: "item-2",
      orderId: "order-1",
      orderNo: "260917-01",
      orderVersion: 1,
      buyerName: "신진식",
      buyerPhone: "01036403420",
      paymentStatus: "partial",
      paidAmount: 270000,
      totalAmount: 540000,
      quantity: 1,
      productName: "선",
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-25T12:00:00+09:00",
    },
    {
      id: "item-3",
      orderId: "order-2",
      orderNo: "260917-02",
      orderVersion: 1,
      buyerName: "신진식",
      buyerPhone: "010-3640-3420",
      paymentStatus: "unpaid",
      paidAmount: 0,
      totalAmount: 270000,
      quantity: 1,
      productName: "선",
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-18T12:00:00+09:00",
    },
    {
      id: "item-4",
      orderId: "order-3",
      orderNo: "260917-03",
      orderVersion: 1,
      buyerName: "신진식",
      buyerPhone: "010-3640-3420",
      paymentStatus: "unpaid",
      paidAmount: 0,
      totalAmount: 810000,
      quantity: 1,
      productName: "미",
      deliveryMethod: "delivery",
      dueAt: "2026-09-18T18:00:00+09:00",
    },
    {
      id: "item-5",
      orderId: "order-3",
      orderNo: "260917-03",
      orderVersion: 1,
      buyerName: "신진식",
      buyerPhone: "010-3640-3420",
      paymentStatus: "unpaid",
      paidAmount: 0,
      totalAmount: 810000,
      quantity: 1,
      productName: "선",
      deliveryMethod: "delivery",
      dueAt: "2026-09-18T18:00:00+09:00",
    },
    {
      id: "item-6",
      orderId: "order-3",
      orderNo: "260917-03",
      orderVersion: 1,
      buyerName: "신진식",
      buyerPhone: "010-3640-3420",
      paymentStatus: "unpaid",
      paidAmount: 0,
      totalAmount: 810000,
      quantity: 1,
      productName: "진",
      deliveryMethod: "delivery",
      dueAt: "2026-09-18T18:00:00+09:00",
    },
  ];

  const groups = groupWorkItemsByCustomer(mockWorkItems);

  assert.equal(groups.length, 1, "Should group all items into 1 customer");
  const customer = groups[0];

  assert.equal(customer.buyerName, "신진식");
  assert.equal(customer.formattedPhone, "010-3640-3420");
  assert.equal(customer.totalOrders, 3, "Customer should have 3 distinct orders");
  assert.equal(customer.totalItems, 6, "Customer should have 6 items in total");
  assert.equal(customer.totalAmount, 1620000, "Total order amount must not double-count order totals");
  assert.equal(customer.paidAmount, 270000, "Total paid amount must match");
  assert.equal(customer.unpaidAmount, 1350000, "Total unpaid balance must be exactly 1,350,000 won");
  assert.equal(customer.allPaid, false);
  assert.equal(customer.rows.length, 6, "All 6 work item rows must be preserved");

  // Check distinct orders breakdown inside customer
  assert.equal(customer.orders.length, 3);
  assert.equal(customer.orders[0].id, "order-1");
  assert.equal(customer.orders[0].totalAmount, 540000);
  assert.equal(customer.orders[0].balance, 270000);
  assert.equal(customer.orders[1].id, "order-2");
  assert.equal(customer.orders[1].balance, 270000);
  assert.equal(customer.orders[2].id, "order-3");
  assert.equal(customer.orders[2].balance, 810000);
});

test("groupCustomerOrdersByCustomer accurately aggregates order rows by customer", () => {
  const mockOrderRows = [
    {
      id: "ord-1",
      orderNo: "260917-01",
      version: 1,
      buyerName: "김철수",
      buyerPhone: "01011112222",
      paymentStatus: "paid",
      paidAmount: 540000,
      totalAmount: 540000,
      balance: 0,
      workItems: [
        { id: "w-1", productName: "선", quantity: 2 },
      ],
    },
    {
      id: "ord-2",
      orderNo: "260917-02",
      version: 1,
      buyerName: "김철수",
      buyerPhone: "010-1111-2222",
      paymentStatus: "unpaid",
      paidAmount: 0,
      totalAmount: 320000,
      balance: 320000,
      workItems: [
        { id: "w-2", productName: "진", quantity: 1 },
      ],
    },
    {
      id: "ord-3",
      orderNo: "260917-03",
      version: 1,
      buyerName: "이영희",
      buyerPhone: "01099998888",
      paymentStatus: "paid",
      paidAmount: 270000,
      totalAmount: 270000,
      balance: 0,
      workItems: [
        { id: "w-3", productName: "선", quantity: 1 },
      ],
    },
  ];

  const groups = groupCustomerOrdersByCustomer(mockOrderRows);

  assert.equal(groups.length, 2, "Should separate into 2 customers");
  const kim = groups.find((g) => g.buyerName === "김철수");
  const lee = groups.find((g) => g.buyerName === "이영희");

  assert.ok(kim);
  assert.equal(kim.totalOrders, 2);
  assert.equal(kim.totalItems, 3);
  assert.equal(kim.totalAmount, 860000);
  assert.equal(kim.paidAmount, 540000);
  assert.equal(kim.unpaidAmount, 320000);
  assert.equal(kim.allPaid, false);

  assert.ok(lee);
  assert.equal(lee.totalOrders, 1);
  assert.equal(lee.totalItems, 1);
  assert.equal(lee.totalAmount, 270000);
  assert.equal(lee.paidAmount, 270000);
  assert.equal(lee.unpaidAmount, 0);
  assert.equal(lee.allPaid, true);
});

test("groupWorkItemsByCustomer resolves true order total from work items when orders.totalAmount was undercounted", () => {
  // Real 신진식 issue case: 3 orders, 6 items
  // Order 17 had 2 items of 270k (540k total), but DB orders.totalAmount was mistakenly stored as 270k
  const mismatchedItems = [
    // Order 15: 3 items (미 220k + 선 270k + 진 320k = 810k)
    { id: "i1", orderId: "ord-15", orderNo: "260917-015", orderVersion: 1, buyerName: "신진식", buyerPhone: "01036403420", paymentStatus: "unpaid", paidAmount: 0, totalAmount: 810000, quantity: 1, unitPrice: 220000, lineTotal: 220000, productName: "미" },
    { id: "i2", orderId: "ord-15", orderNo: "260917-015", orderVersion: 1, buyerName: "신진식", buyerPhone: "01036403420", paymentStatus: "unpaid", paidAmount: 0, totalAmount: 810000, quantity: 1, unitPrice: 270000, lineTotal: 270000, productName: "선" },
    { id: "i3", orderId: "ord-15", orderNo: "260917-015", orderVersion: 1, buyerName: "신진식", buyerPhone: "01036403420", paymentStatus: "unpaid", paidAmount: 0, totalAmount: 810000, quantity: 1, unitPrice: 320000, lineTotal: 320000, productName: "진" },
    // Order 16: 1 item (선 270k)
    { id: "i4", orderId: "ord-16", orderNo: "260917-016", orderVersion: 1, buyerName: "신진식", buyerPhone: "01036403420", paymentStatus: "unpaid", paidAmount: 0, totalAmount: 270000, quantity: 1, unitPrice: 270000, lineTotal: 270000, productName: "선" },
    // Order 17: 2 items (선 270k + 선 270k = 540k), but legacy totalAmount was 270k!
    { id: "i5", orderId: "ord-17", orderNo: "260917-017", orderVersion: 1, buyerName: "신진식", buyerPhone: "01036403420", paymentStatus: "unpaid", paidAmount: 0, totalAmount: 270000, quantity: 1, unitPrice: 270000, lineTotal: 270000, productName: "선" },
    { id: "i6", orderId: "ord-17", orderNo: "260917-017", orderVersion: 1, buyerName: "신진식", buyerPhone: "01036403420", paymentStatus: "unpaid", paidAmount: 0, totalAmount: 270000, quantity: 1, unitPrice: 270000, lineTotal: 270000, productName: "선" },
  ];

  const groups = groupWorkItemsByCustomer(mismatchedItems);
  assert.equal(groups.length, 1);
  const shin = groups[0];
  // Must resolve to 1,620,000 won (not 1,350,000 won!)
  assert.equal(shin.totalAmount, 1620000, "전체 주문 총액은 누락 없이 162만원이어야 함");
  assert.equal(shin.unpaidAmount, 1620000, "미결제 금액도 162만원이어야 함");
  assert.equal(shin.totalItems, 6);
  assert.equal(shin.totalOrders, 3);
});


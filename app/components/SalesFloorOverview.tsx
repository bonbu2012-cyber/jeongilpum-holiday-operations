"use client";

import { Download, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import {
  PAYMENT_STATUS_LABELS,
  WORK_STATUS_LABELS,
  paymentRequiresCollection,
  paymentStatusTone,
  workStatusTone,
  type PaymentStatus,
  type WorkStatus,
} from "../lib/work-status";
import { Badge, Button, useResource } from "../ui";
import "../sales/floor-overview.css";

type WorkItem = {
  id: string;
  orderId: string;
  orderNo: string;
  buyerName: string;
  buyerPhone: string;
  productName: string;
  quantity: number;
  deliveryMethod: "onsite_sale" | "onsite_reservation" | "delivery";
  dueAt: string;
  workStatus: WorkStatus;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  totalAmount: number;
};

type WorkResponse = { workItems?: WorkItem[] };

type SalesOrder = {
  orderId: string;
  orderNo: string;
  buyerName: string;
  buyerPhone: string;
  deliveryMethod: WorkItem["deliveryMethod"];
  dueAt: string;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  totalAmount: number;
  items: WorkItem[];
};

const DELIVERY_LABELS: Record<WorkItem["deliveryMethod"], string> = {
  onsite_sale: "현장판매",
  onsite_reservation: "현장수령",
  delivery: "택배발송",
};

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function scheduleLabel(order: SalesOrder) {
  if (order.deliveryMethod === "delivery") return "택배 발송";
  if (order.deliveryMethod === "onsite_sale") return "현장 판매";
  return order.dueAt.slice(11, 16);
}

export default function SalesFloorOverview() {
  const today = todayInSeoul();
  const { data, error, reload } = useResource<WorkResponse>(
    `/api/work-items?view=work&dateFrom=${today}&dateTo=${today}&sort=dueAtAsc`,
    3_000,
  );
  const orders = useMemo(() => {
    const orderMap = new Map<string, SalesOrder>();
    for (const item of data?.workItems ?? []) {
      if (item.workStatus === "cancelled") continue;
      const current = orderMap.get(item.orderId) ?? {
        orderId: item.orderId,
        orderNo: item.orderNo,
        buyerName: item.buyerName,
        buyerPhone: item.buyerPhone,
        deliveryMethod: item.deliveryMethod,
        dueAt: item.dueAt,
        paymentStatus: item.paymentStatus,
        paidAmount: item.paidAmount,
        totalAmount: item.totalAmount,
        items: [],
      };
      current.items.push(item);
      if (item.dueAt < current.dueAt) current.dueAt = item.dueAt;
      orderMap.set(item.orderId, current);
    }
    return [...orderMap.values()].sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  }, [data?.workItems]);
  const unpaidOrders = orders.filter((order) => paymentRequiresCollection(order.paymentStatus)).length;
  const inProgressItems = orders.flatMap((order) => order.items).filter((item) => item.workStatus === "confirmed" || item.workStatus === "in_progress").length;
  const readyItems = orders.flatMap((order) => order.items).filter((item) => item.workStatus === "ready" || item.workStatus === "completed").length;

  return (
    <section className="sales-floor-overview" aria-labelledby="sales-floor-overview-title">
      <header className="sales-floor-overview__header">
        <div>
          <p>오늘 판매장 한눈에 보기</p>
          <h2 id="sales-floor-overview-title">고객별 상품·결제·작업 상태</h2>
        </div>
        <div className="sales-floor-overview__actions">
          <Button size="sm" variant="ghost" leadingIcon={<RefreshCw size={15} />} onClick={() => void reload()}>
            새로고침
          </Button>
          <a
            className="ui-button ui-button--ghost ui-button--sm"
            href="/templates/jeongilpum-bulk-orders-pickup-time.xlsx"
            download="정일품_대량주문_현장수령시간선택.xlsx"
          >
            <Download size={15} aria-hidden="true" />
            시간 선택 엑셀
          </a>
        </div>
      </header>

      <div className="sales-floor-overview__summary" aria-label="오늘 판매 요약">
        <span><small>주문</small><strong>{orders.length}건</strong></span>
        <span className={unpaidOrders ? "is-attention" : undefined}><small>미결제·부분결제</small><strong>{unpaidOrders}건</strong></span>
        <span><small>작업 중</small><strong>{inProgressItems}개</strong></span>
        <span><small>준비 완료</small><strong>{readyItems}개</strong></span>
      </div>

      {error ? <p className="sales-floor-overview__message is-error" role="alert">{error.message}</p> : null}
      {!error && !data ? <p className="sales-floor-overview__message" role="status">오늘 주문을 불러오는 중입니다.</p> : null}
      {data && !orders.length ? <p className="sales-floor-overview__message">오늘 확인할 주문이 없습니다.</p> : null}

      {orders.length ? (
        <div className="sales-floor-overview__table-wrap">
          <table className="sales-floor-overview__table">
            <thead>
              <tr>
                <th scope="col">수령</th>
                <th scope="col">고객</th>
                <th scope="col">상품별 작업 상태</th>
                <th scope="col">결제</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderId} className={paymentRequiresCollection(order.paymentStatus) ? "is-payment-due" : undefined}>
                  <td>
                    <strong>{scheduleLabel(order)}</strong>
                    <small>{DELIVERY_LABELS[order.deliveryMethod]}</small>
                  </td>
                  <td>
                    <strong>{order.buyerName}</strong>
                    <small>{order.buyerPhone} · {order.orderNo}</small>
                  </td>
                  <td>
                    <ul className="sales-floor-overview__products">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          <span>{item.productName} <b>{item.quantity}개</b></span>
                          <Badge tone={workStatusTone(item.workStatus)}>{WORK_STATUS_LABELS[item.workStatus]}</Badge>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <Badge tone={paymentStatusTone(order.paymentStatus)}>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</Badge>
                    <small>{won(order.paidAmount)} / {won(order.totalAmount)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="sales-floor-overview__excel-note">대량주문 양식의 현장수령시간 셀에서 08:00~21:00을 30분 단위로 선택할 수 있습니다.</p>
    </section>
  );
}

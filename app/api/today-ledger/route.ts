import { getDb } from "../../../db";
import { requireOperatorApi } from "../../lib/operator-session";

export const dynamic = "force-dynamic";

type DeliveryMethod = "onsite_reservation" | "delivery" | "onsite_sale";
type WorkStatus = "received" | "confirmed" | "in_progress" | "ready" | "completed" | "cancelled";

type RawWorkItemRow = {
  id: string;
  order_id: string;
  order_no: string;
  buyer_name: string;
  buyer_phone: string;
  payment_status: "unpaid" | "partial" | "paid";
  paid_amount: number;
  total_amount: number;
  customer_arrived_at: string | null;
  customer_note: string | null;
  product_id: string;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
  order_version: number;
  order_updated_at: string;
  paid_at: string | null;
  delivery_method: DeliveryMethod;
  due_at: string;
  work_status: WorkStatus;
  note: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  postal_code: string | null;
  road_addr: string | null;
  road_addr_reference: string | null;
  jibun_addr: string | null;
  detail_addr: string | null;
  customization_json: string | null;
  created_at: string;
};

export type TodayLedgerItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  customizationSummary: string | null;
};

export type TodayLedgerOrder = {
  orderId: string;
  orderNo: string;
  buyerName: string;
  buyerPhone: string;
  buyerPhoneMasked: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  orderVersion: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  paidAt: string | null;
  paidAtDisplay: string | null;
  paidAtFull: string | null;
  deliveryMethod: DeliveryMethod;
  dueAt: string;
  timeDisplay: string; // 예: "14:30" 또는 "오후 02:30"
  itemsSummary: string; // 예: "봉황세트 2개, LA갈비 1개"
  totalQuantity: number;
  items: TodayLedgerItem[];
  customerNote: string;
  adminNote: string;
  customerArrivedAt: string | null;
  // 택배 정보
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  isShipping: boolean;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function todayInSeoul(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatTimeDisplay(dueAt: string, isDelivery: boolean): string {
  if (isDelivery) return "택배발송";
  if (!dueAt) return "시간 미지정";
  try {
    const timeMatch = dueAt.match(/T(\d{2}):(\d{2})/);
    if (!timeMatch) return "시간 미지정";
    const hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2];
    const period = hour < 12 ? "오전" : "오후";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${period} ${String(displayHour).padStart(2, "0")}:${minute}`;
  } catch {
    return "시간 미지정";
  }
}

function formatDateTimeInSeoul(isoStr: string | null | undefined): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const hour = parseInt(value("hour"), 10);
    const minute = value("minute");
    const period = hour < 12 ? "오전" : "오후";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${period} ${String(displayHour).padStart(2, "0")}:${minute}`;
  } catch {
    return null;
  }
}

function formatFullDateTimeInSeoul(isoStr: string | null | undefined): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")}:${value("second")}`;
  } catch {
    return null;
  }
}

function formatPhoneDisplay(phone: string): string {
  const clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

function parseCustomization(jsonStr: string | null): string | null {
  if (!jsonStr) return null;
  try {
    const data = JSON.parse(jsonStr) as {
      specSummary?: string;
      customNotes?: string;
      rawText?: string;
    };
    return data.specSummary || data.customNotes || data.rawText || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  try {
    const db = getDb();
    const url = new URL(request.url);
    const dateQuery = url.searchParams.get("date")?.trim();
    const targetDate = dateQuery && datePattern.test(dateQuery) ? dateQuery : todayInSeoul();

    // 오늘 날짜의 work_items와 orders 조회 (cancelled 제외)
    const sql = `
      SELECT
        w.id,
        w.order_id,
        o.order_no,
        o.buyer_name,
        o.buyer_phone,
        o.payment_status,
        o.paid_amount,
        o.total_amount,
        o.version AS order_version,
        o.updated_at AS order_updated_at,
        (
          SELECT e.created_at
          FROM work_item_events e
          WHERE e.order_id = o.id AND e.event_type = 'payment_changed'
          ORDER BY e.created_at DESC, e.id DESC
          LIMIT 1
        ) AS paid_at,
        o.customer_arrived_at,
        o.customer_note,
        w.product_id,
        w.product_name_snapshot,
        w.unit_price_snapshot,
        w.quantity,
        w.line_total,
        w.delivery_method,
        w.due_at,
        w.work_status,
        w.note,
        w.recipient_name,
        w.recipient_phone,
        w.postal_code,
        w.road_addr,
        w.road_addr_reference,
        w.jibun_addr,
        w.detail_addr,
        w.customization_json,
        w.created_at
      FROM work_items w
      JOIN orders o ON o.id = w.order_id
      WHERE substr(w.due_at, 1, 10) = ?
        AND w.work_status != 'cancelled'
        AND o.order_status != 'cancelled'
      ORDER BY w.due_at ASC, w.created_at ASC, w.id ASC
      LIMIT 1000
    `;

    const rawResult = await db.prepare(sql).bind(targetDate).all<RawWorkItemRow>();
    const rows = rawResult.results || [];

    // order_id 별로 그룹화
    const orderMap = new Map<string, {
      orderInfo: RawWorkItemRow;
      items: TodayLedgerItem[];
    }>();

    for (const row of rows) {
      let entry = orderMap.get(row.order_id);
      if (!entry) {
        entry = {
          orderInfo: row,
          items: [],
        };
        orderMap.set(row.order_id, entry);
      }
      entry.items.push({
        name: row.product_name_snapshot,
        quantity: row.quantity,
        unitPrice: row.unit_price_snapshot,
        lineTotal: row.line_total,
        customizationSummary: parseCustomization(row.customization_json),
      });
    }

    const onsiteOrders: TodayLedgerOrder[] = [];
    const shippingOrders: TodayLedgerOrder[] = [];
    const mismatchedOrderUpdates: { orderId: string; totalAmount: number }[] = [];

    for (const { orderInfo: info, items } of orderMap.values()) {
      const isDelivery = info.delivery_method === "delivery";
      
      // 주문자별 상품금액 합계 (단가 x 수량의 합)
      const itemsTotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

      // 상품 세부내역 합계가 존재하면 이를 실제 총 금액으로 우선 채택 (단가만 기록되거나 0으로 기록된 불일치 방지)
      const effectiveTotalAmount = itemsTotal > 0 ? itemsTotal : (info.total_amount || 0);
      const paidAmount = info.paid_amount || 0;
      const balance = Math.max(0, effectiveTotalAmount - paidAmount);

      // 결제 상태 일관성 계산 (완납/일부/미결제)
      let effectivePaymentStatus: "unpaid" | "partial" | "paid" = info.payment_status || "unpaid";
      if (effectiveTotalAmount > 0) {
        if (paidAmount >= effectiveTotalAmount) {
          effectivePaymentStatus = "paid";
        } else if (paidAmount > 0) {
          effectivePaymentStatus = "partial";
        } else {
          effectivePaymentStatus = "unpaid";
        }
      }

      // DB의 total_amount가 실제 상품 합계(itemsTotal)와 다를 경우 자동 동기화 목록에 수집
      if (itemsTotal > 0 && info.total_amount !== itemsTotal) {
        mismatchedOrderUpdates.push({
          orderId: info.order_id,
          totalAmount: itemsTotal,
        });
      }

      const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
      
      // 상품 요약 문자열 (예: "봉황세트 2개, 갈비세트 1개")
      const itemsSummary = items
        .map((item) => `${item.name} ${item.quantity}개`)
        .join(", ");

      const addrParts = [
        info.road_addr || info.jibun_addr || "",
        info.detail_addr || "",
        info.road_addr_reference || "",
      ].filter(Boolean);
      const recipientAddress = addrParts.join(" ").trim();

      // 결제 변경 시점: work_item_events의 최신 payment_changed 기록 우선, 없으면 결제완료 상태 시 order_updated_at 활용
      const rawPaidAt = info.paid_at || (effectivePaymentStatus === "paid" ? info.order_updated_at : null);
      const paidAtDisplay = formatDateTimeInSeoul(rawPaidAt);
      const paidAtFull = formatFullDateTimeInSeoul(rawPaidAt);

      const orderObj: TodayLedgerOrder = {
        orderId: info.order_id,
        orderNo: info.order_no,
        buyerName: info.buyer_name || "고객",
        buyerPhone: formatPhoneDisplay(info.buyer_phone),
        buyerPhoneMasked: info.buyer_phone ? info.buyer_phone.slice(-4) : "",
        totalAmount: effectiveTotalAmount,
        paidAmount,
        balance,
        orderVersion: info.order_version || 1,
        paymentStatus: effectivePaymentStatus,
        paidAt: rawPaidAt,
        paidAtDisplay,
        paidAtFull,
        deliveryMethod: info.delivery_method,
        dueAt: info.due_at,
        timeDisplay: formatTimeDisplay(info.due_at, isDelivery),
        itemsSummary,
        totalQuantity: totalQty,
        items,
        customerNote: info.customer_note || "",
        adminNote: info.note || "",
        customerArrivedAt: info.customer_arrived_at,
        recipientName: info.recipient_name || info.buyer_name || "",
        recipientPhone: formatPhoneDisplay(info.recipient_phone || info.buyer_phone),
        recipientAddress,
        isShipping: isDelivery,
      };

      if (isDelivery) {
        shippingOrders.push(orderObj);
      } else {
        onsiteOrders.push(orderObj);
      }
    }

    // 불일치 주문이 있는 경우 DB의 orders.total_amount를 비동기로 자동 보정
    if (mismatchedOrderUpdates.length > 0) {
      Promise.allSettled(
        mismatchedOrderUpdates.map((u) =>
          db.prepare("UPDATE orders SET total_amount = ?, updated_at = ? WHERE id = ?")
            .bind(u.totalAmount, new Date().toISOString(), u.orderId)
            .run()
        )
      ).catch(() => {});
    }

    // 방문수령은 dueAt 시간순으로 정렬
    onsiteOrders.sort((a, b) => a.dueAt.localeCompare(b.dueAt));

    // 택배는 주문번호/이름 순
    shippingOrders.sort((a, b) => a.orderNo.localeCompare(b.orderNo));

    return Response.json(
      {
        date: targetDate,
        summary: {
          totalOrders: onsiteOrders.length + shippingOrders.length,
          onsiteCount: onsiteOrders.length,
          shippingCount: shippingOrders.length,
          unpaidCount: [...onsiteOrders, ...shippingOrders].filter((o) => o.paymentStatus !== "paid").length,
        },
        onsiteOrders,
        shippingOrders,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "장부 데이터를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

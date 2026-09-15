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
  paymentStatus: "unpaid" | "partial" | "paid";
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

    for (const { orderInfo: info, items } of orderMap.values()) {
      const isDelivery = info.delivery_method === "delivery";
      const balance = Math.max(0, (info.total_amount || 0) - (info.paid_amount || 0));
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

      const orderObj: TodayLedgerOrder = {
        orderId: info.order_id,
        orderNo: info.order_no,
        buyerName: info.buyer_name || "고객",
        buyerPhone: formatPhoneDisplay(info.buyer_phone),
        buyerPhoneMasked: info.buyer_phone ? info.buyer_phone.slice(-4) : "",
        totalAmount: info.total_amount || 0,
        paidAmount: info.paid_amount || 0,
        balance,
        paymentStatus: info.payment_status || "unpaid",
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

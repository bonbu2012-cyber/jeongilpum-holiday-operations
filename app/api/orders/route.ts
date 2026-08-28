import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {
  SALES_DATE_ORDERS_SQL,
  SALES_DATE_SEARCH_ORDERS_SQL,
  SALES_SEARCH_ORDERS_SQL,
} from "../../lib/sales-order-query";

type OrderRow = {
  id: string;
  order_no: string;
  buyer_name_snapshot: string;
  buyer_phone_snapshot: string;
  order_status: string;
  fulfillment_type: string;
  schedule_label: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  road_address: string | null;
  detail_address: string | null;
  customer_note: string;
  total_amount: number;
  version: number;
  submitted_at: string;
};
type ItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  sale_unit_price: number;
};
type PackageRow = {
  order_id: string;
  package_code: string;
  package_status: string;
};
type EventRow = {
  id: string;
  order_id: string;
  event_type: string;
  reason: string | null;
  created_at: string;
};
type ProductRow = { id: string; name: string; price: number; active: number };
type SeasonRow = { id: string; sales_start_date: string; sales_end_date: string; active: number };
type FulfillmentRow = {
  id: string;
  order_id: string;
  fulfillment_type: "pickup" | "shipping";
  pickup_at: string | null;
  ship_date: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  postal_code: string | null;
  road_addr: string | null;
  road_addr_reference: string | null;
  jibun_addr: string | null;
  detail_addr: string | null;
  customer_arrived: number;
  note: string;
};
type CustomizationRow = {
  order_item_id: string;
  category: string;
  budget_option: string;
  desired_composition: string;
  preferred_cut: string;
  fat_preference: string;
  packaging_request: string;
  other_request: string;
};
type PaymentRow = {
  id: string;
  order_id: string;
  type: "payment" | "refund" | "adjustment";
  method: "card" | "cash" | "bank_transfer" | null;
  amount: number;
  paid_at: string;
  recorded_by: string;
  memo: string;
};
type CreditRow = {
  order_id: string;
  outstanding_amount: number;
  due_date: string | null;
  memo: string;
  status: "open" | "settled";
};
type CustomItemPayload = {
  category?: string;
  budgetOption?: string;
  budgetAmount?: number;
  desiredComposition?: string;
  preferredCut?: string;
  fatPreference?: string;
  packagingRequest?: string;
  otherRequest?: string;
};
type CreatePayload = {
  idempotencyKey?: string;
  buyerName?: string;
  buyerPhone?: string;
  fulfillmentType?: "pickup" | "shipping";
  pickupDate?: string;
  pickupTime?: string;
  shipDate?: string;
  recipientName?: string;
  recipientPhone?: string;
  postalCode?: string;
  roadAddr?: string;
  roadAddrReference?: string;
  jibunAddr?: string;
  detailAddr?: string;
  note?: string;
  items?: { productId?: string; quantity?: number }[];
  customItem?: CustomItemPayload | null;
};

const runtimeEnv = env as typeof env & {
  DB: D1Database;
  OPERATOR_USER_IDS?: string;
  OPERATOR_EMAILS?: string;
};
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const customCategories = new Set(["진공세트", "프리미엄", "O'meat", "LA갈비", "뼈세트"]);
const orderChangeEventTypes = new Set(["order_changed", "order_updated", "items_changed", "fulfillment_changed", "schedule_changed"]);

function configured(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}
function isOperator(user: { userId: string; email: string }) {
  return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId)
    || configured(runtimeEnv.OPERATOR_EMAILS)
      .map((value) => value.toLowerCase())
      .includes(user.email.toLowerCase());
}
function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}
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
function validIsoDate(value: string) {
  if (!isoDatePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}
function validPickupTime(value: string) {
  const match = /^(\d{2}):(00|30)$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  return hour >= 8 && hour <= 21 && (hour < 21 || match[2] === "00");
}
function koreanDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${month}월 ${day}일 (${weekdays[date.getUTCDay()]})`;
}
function createOrderNo() {
  const date = todayInSeoul().replaceAll("-", "").slice(2);
  return `JI-${date}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}
function fulfillmentScheduleLabel(fulfillment: FulfillmentRow) {
  if (fulfillment.pickup_at) {
    const [date, timePart] = fulfillment.pickup_at.split("T");
    return `${koreanDate(date)} · ${timePart.slice(0, 5)}`;
  }
  if (fulfillment.ship_date) return `${koreanDate(fulfillment.ship_date)} 발송 예정`;
  return "일정 미지정";
}
function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

async function serializeOrders(rows: OrderRow[]) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(",");
  const [itemResult, packageResult, fulfillmentResult, customizationResult, paymentResult, creditResult, eventResult] =
    await Promise.all([
      runtimeEnv.DB
        .prepare(`SELECT id,order_id,product_id,product_name_snapshot,quantity,sale_unit_price FROM order_items WHERE order_id IN (${placeholders})`)
        .bind(...ids)
        .all<ItemRow>(),
      runtimeEnv.DB
        .prepare(`SELECT order_id,package_code,package_status FROM packages WHERE order_id IN (${placeholders}) AND package_status!='voided'`)
        .bind(...ids)
        .all<PackageRow>(),
      runtimeEnv.DB
        .prepare(`SELECT id,order_id,fulfillment_type,pickup_at,ship_date,recipient_name,recipient_phone,postal_code,road_addr,road_addr_reference,jibun_addr,detail_addr,customer_arrived,note FROM fulfillments WHERE order_id IN (${placeholders})`)
        .bind(...ids)
        .all<FulfillmentRow>(),
      runtimeEnv.DB
        .prepare(`SELECT c.order_item_id,c.category,c.budget_option,c.desired_composition,c.preferred_cut,c.fat_preference,c.packaging_request,c.other_request FROM order_item_customizations c JOIN order_items i ON i.id=c.order_item_id WHERE i.order_id IN (${placeholders})`)
        .bind(...ids)
        .all<CustomizationRow>(),
      runtimeEnv.DB
        .prepare(`SELECT id,order_id,type,method,amount,paid_at,recorded_by,memo FROM payments WHERE order_id IN (${placeholders}) ORDER BY paid_at,id`)
        .bind(...ids)
        .all<PaymentRow>(),
      runtimeEnv.DB
        .prepare(`SELECT order_id,outstanding_amount,due_date,memo,status FROM order_credit_terms WHERE order_id IN (${placeholders}) ORDER BY created_at DESC`)
        .bind(...ids)
        .all<CreditRow>(),
      runtimeEnv.DB
        .prepare(`SELECT id,order_id,event_type,reason,created_at FROM order_events WHERE order_id IN (${placeholders}) ORDER BY created_at DESC,id DESC`)
        .bind(...ids)
        .all<EventRow>(),
    ]);

  return rows.map((row) => {
    const fulfillment = fulfillmentResult.results.find((item) => item.order_id === row.id);
    const payments = paymentResult.results.filter((payment) => payment.order_id === row.id);
    const paidAmount = payments.reduce((sum, payment) => {
      if (payment.type === "refund") return sum - payment.amount;
      return sum + payment.amount;
    }, 0);
    const balance = Math.max(0, row.total_amount - paidAmount);
    const credit = creditResult.results.find(
      (item) => item.order_id === row.id && item.status === "open",
    );
    const packages = packageResult.results.filter((item) => item.order_id === row.id);
    const events = eventResult.results.filter((event) => event.order_id === row.id);
    const acknowledgedAt = events.find((event) => event.event_type === "change_acknowledged")?.created_at ?? "";
    const hasUnacknowledgedChange = events.some(
      (event) =>
        orderChangeEventTypes.has(event.event_type)
        && (!acknowledgedAt || event.created_at > acknowledgedAt),
    );
    const paymentStatus = balance === 0
      ? "paid"
      : credit
        ? "credit"
        : paidAmount > 0
          ? "partial"
          : "unpaid";

    return {
      id: row.id,
      orderNo: row.order_no,
      buyerName: row.buyer_name_snapshot,
      buyerPhone: row.buyer_phone_snapshot,
      status: row.order_status,
      fulfillmentType: fulfillment?.fulfillment_type ?? row.fulfillment_type,
      scheduleLabel: fulfillment ? fulfillmentScheduleLabel(fulfillment) : "일정 미지정 · 기존 주문",
      fulfillmentId: fulfillment?.id ?? null,
      pickupAt: fulfillment?.pickup_at ?? null,
      shipDate: fulfillment?.ship_date ?? null,
      recipientName: fulfillment?.recipient_name ?? row.recipient_name,
      recipientPhone: fulfillment?.recipient_phone ?? row.recipient_phone,
      postalCode: fulfillment?.postal_code ?? null,
      roadAddress: fulfillment?.road_addr ?? row.road_address,
      roadAddrReference: fulfillment?.road_addr_reference ?? null,
      jibunAddr: fulfillment?.jibun_addr ?? null,
      detailAddress: fulfillment?.detail_addr ?? row.detail_address,
      customerArrived: Boolean(fulfillment?.customer_arrived),
      note: fulfillment?.note ?? row.customer_note,
      totalAmount: row.total_amount,
      paidAmount,
      balance,
      paymentStatus,
      creditDueDate: credit?.due_date ?? null,
      creditMemo: credit?.memo ?? null,
      version: row.version,
      submittedAt: row.submitted_at,
      items: itemResult.results
        .filter((item) => item.order_id === row.id)
        .map((item) => {
          const customization = customizationResult.results.find(
            (value) => value.order_item_id === item.id,
          );
          return {
            id: item.id,
            productId: item.product_id,
            name: item.product_name_snapshot,
            quantity: item.quantity,
            unitPrice: item.sale_unit_price,
            customization: customization
              ? {
                  category: customization.category,
                  budgetOption: customization.budget_option,
                  budgetAmount: item.sale_unit_price,
                  desiredComposition: customization.desired_composition,
                  preferredCut: customization.preferred_cut,
                  fatPreference: customization.fat_preference,
                  packagingRequest: customization.packaging_request,
                  otherRequest: customization.other_request,
                }
              : null,
          };
        }),
      payments: payments.map((payment) => ({
        id: payment.id,
        type: payment.type,
        method: payment.method,
        amount: payment.amount,
        paidAt: payment.paid_at,
        recordedBy: payment.recorded_by,
        memo: payment.memo,
      })),
      packageCodes: packages.map((item) => item.package_code),
      packageTotal: packages.length,
      packageCompleted: packages.filter((item) =>
        item.package_status === "completed" || item.package_status === "handed_over").length,
      hasUnacknowledgedChange,
      events: events.map((event) => ({
        id: event.id,
        type: event.event_type,
        reason: event.reason,
        createdAt: event.created_at,
      })),
    };
  });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user)) return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });
  try {
    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim() ?? "";
    const date = params.get("date")?.trim() ?? "";
    const like = `%${q}%`;
    if (date && !validIsoDate(date)) {
      return Response.json({ error: "조회 날짜 형식을 확인해주세요." }, { status: 400 });
    }
    let result: D1Result<OrderRow>;
    if (q && date) {
      result = await runtimeEnv.DB
        .prepare(SALES_DATE_SEARCH_ORDERS_SQL)
        .bind(date, date, like, like, like, like, like)
        .all<OrderRow>();
    } else if (date) {
      result = await runtimeEnv.DB
        .prepare(SALES_DATE_ORDERS_SQL)
        .bind(date, date)
        .all<OrderRow>();
    } else if (q) {
      result = await runtimeEnv.DB
        .prepare(SALES_SEARCH_ORDERS_SQL)
        .bind(like, like, like, like, like)
        .all<OrderRow>();
    } else {
      result = await runtimeEnv.DB
        .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500")
        .all<OrderRow>();
    }
    return Response.json(
      { orders: await serializeOrders(result.results) },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "주문을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let idempotencyKey = "";
  try {
    const payload = await request.json() as CreatePayload;
    idempotencyKey = clean(payload.idempotencyKey);
    const buyer = clean(payload.buyerName);
    const phone = normalizePhone(payload.buyerPhone ?? "");
    const items = (payload.items ?? []).filter(
      (item) => item.productId && Number.isInteger(item.quantity) && (item.quantity ?? 0) > 0,
    );
    const custom = payload.customItem;
    const customAmount = Number(custom?.budgetAmount ?? 0);
    const customValid = Boolean(
      custom
      && customCategories.has(clean(custom.category))
      && clean(custom.budgetOption)
      && Number.isInteger(customAmount)
      && customAmount >= 200_000,
    );
    if (
      !idempotencyKey
      || !buyer
      || phone.length < 10
      || !payload.fulfillmentType
      || (!items.length && !customValid)
    ) {
      return Response.json({ error: "주문자와 상품 정보를 확인해주세요." }, { status: 400 });
    }
    if (custom && !customValid) {
      return Response.json({ error: "맞춤주문은 카테고리와 20만원 이상의 예산이 필요합니다." }, { status: 400 });
    }

    const existing = await runtimeEnv.DB
      .prepare("SELECT * FROM orders WHERE idempotency_key=?")
      .bind(idempotencyKey)
      .first<OrderRow>();
    if (existing) {
      const [order] = await serializeOrders([existing]);
      return Response.json({ order, duplicate: true });
    }

    const season = await runtimeEnv.DB
      .prepare("SELECT id,sales_start_date,sales_end_date,active FROM sales_seasons WHERE active=1 ORDER BY sales_start_date DESC LIMIT 1")
      .first<SeasonRow>();
    if (!season) {
      return Response.json({ error: "현재 예약 가능한 판매 시즌이 없습니다." }, { status: 409 });
    }
    const today = todayInSeoul();
    const scheduleDate = payload.fulfillmentType === "pickup"
      ? clean(payload.pickupDate)
      : clean(payload.shipDate);
    if (
      !validIsoDate(scheduleDate)
      || scheduleDate < today
      || scheduleDate < season.sales_start_date
      || scheduleDate > season.sales_end_date
    ) {
      return Response.json({ error: "예약 가능한 날짜를 다시 선택해주세요." }, { status: 400 });
    }
    if (
      payload.fulfillmentType === "pickup"
      && !validPickupTime(clean(payload.pickupTime))
    ) {
      return Response.json(
        { error: "방문 시간을 08:00부터 21:00 사이에서 선택해주세요." },
        { status: 400 },
      );
    }

    const recipientName = clean(payload.recipientName);
    const recipientPhone = normalizePhone(payload.recipientPhone ?? "");
    const postalCode = (payload.postalCode ?? "").replace(/\D/g, "");
    const roadAddr = clean(payload.roadAddr);
    const detailAddr = clean(payload.detailAddr);
    if (
      payload.fulfillmentType === "shipping"
      && (!recipientName || recipientPhone.length < 10 || postalCode.length !== 5 || roadAddr.length < 5 || !detailAddr)
    ) {
      return Response.json(
        { error: "받는 분, 우편번호, 배송주소와 상세주소를 확인해주세요." },
        { status: 400 },
      );
    }

    const productIds = [...new Set(items.map((item) => item.productId as string))];
    let productRows: ProductRow[] = [];
    let limitedProductIds = new Set<string>();
    if (productIds.length) {
      const placeholders = productIds.map(() => "?").join(",");
      const [productResult, limitResult] = await Promise.all([
        runtimeEnv.DB
          .prepare(`SELECT id,name,price,active FROM products WHERE id IN (${placeholders})`)
          .bind(...productIds)
          .all<ProductRow>(),
        runtimeEnv.DB
          .prepare(`SELECT product_id FROM product_daily_limits WHERE active=1 AND product_id IN (${placeholders})`)
          .bind(...productIds)
          .all<{ product_id: string }>(),
      ]);
      productRows = productResult.results;
      limitedProductIds = new Set(limitResult.results.map((row) => row.product_id));
      if (productRows.length !== productIds.length || productRows.some((product) => !product.active)) {
        return Response.json(
          { error: "현재 주문할 수 없는 상품이 포함되어 있습니다." },
          { status: 409 },
        );
      }
    }

    const orderId = crypto.randomUUID();
    const fulfillmentId = crypto.randomUUID();
    const orderNo = createOrderNo();
    const now = new Date().toISOString();
    const pickupTime = clean(payload.pickupTime);
    const pickupAt = payload.fulfillmentType === "pickup"
      ? `${scheduleDate}T${pickupTime}:00+09:00`
      : null;
    const shipDate = payload.fulfillmentType === "shipping" ? scheduleDate : null;
    const scheduleLabel = payload.fulfillmentType === "pickup"
      ? `${koreanDate(scheduleDate)} · ${pickupTime}`
      : `${koreanDate(scheduleDate)} 발송 예정`;

    const pricedItems = items.map((item) => {
      const product = productRows.find((value) => value.id === item.productId)!;
      return {
        id: crypto.randomUUID(),
        product,
        quantity: item.quantity as number,
        lineTotal: product.price * (item.quantity as number),
      };
    });
    const customOrderItem = customValid && custom
      ? {
          id: crypto.randomUUID(),
          product: { id: "custom-order", name: `맞춤주문 · ${clean(custom.category)}`, price: customAmount },
          quantity: 1,
          lineTotal: customAmount,
        }
      : null;
    const allItems = customOrderItem ? [...pricedItems, customOrderItem] : pricedItems;
    const total = allItems.reduce((sum, item) => sum + item.lineTotal, 0);

    const statements: D1PreparedStatement[] = [
      runtimeEnv.DB
        .prepare(`INSERT INTO orders(id,order_no,season_id,buyer_name_snapshot,buyer_phone_snapshot,order_status,fulfillment_type,schedule_label,recipient_name,recipient_phone,road_address,detail_address,customer_note,total_amount,idempotency_key,version,submitted_at,created_at,updated_at) VALUES(?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,?,1,?,?,?)`)
        .bind(
          orderId,
          orderNo,
          season.id,
          buyer,
          phone,
          payload.fulfillmentType,
          scheduleLabel,
          recipientName || null,
          recipientPhone || null,
          roadAddr || null,
          detailAddr || null,
          clean(payload.note),
          total,
          idempotencyKey,
          now,
          now,
          now,
        ),
      ...allItems.map((item) =>
        runtimeEnv.DB
          .prepare(`INSERT INTO order_items(id,order_id,product_id,product_name_snapshot,list_price_snapshot,sale_unit_price,quantity,line_total,created_at) VALUES(?,?,?,?,?,?,?,?,?)`)
          .bind(
            item.id,
            orderId,
            item.product.id,
            item.product.name,
            item.product.price,
            item.product.price,
            item.quantity,
            item.lineTotal,
            now,
          )),
      runtimeEnv.DB
        .prepare(`INSERT INTO fulfillments(id,order_id,fulfillment_type,pickup_at,ship_date,recipient_name,recipient_phone,postal_code,road_addr,road_addr_reference,jibun_addr,detail_addr,status,customer_arrived,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'scheduled',0,?,?,?)`)
        .bind(
          fulfillmentId,
          orderId,
          payload.fulfillmentType,
          pickupAt,
          shipDate,
          recipientName || null,
          recipientPhone || null,
          postalCode || null,
          roadAddr || null,
          clean(payload.roadAddrReference) || null,
          clean(payload.jibunAddr) || null,
          detailAddr || null,
          clean(payload.note),
          now,
          now,
        ),
      ...allItems.map((item) =>
        runtimeEnv.DB
          .prepare("INSERT INTO fulfillment_items(id,fulfillment_id,order_item_id,quantity,created_at) VALUES(?,?,?,?,?)")
          .bind(crypto.randomUUID(), fulfillmentId, item.id, item.quantity, now)),
      ...pricedItems
        .filter((item) => limitedProductIds.has(item.product.id))
        .map((item) =>
          runtimeEnv.DB
            .prepare(`INSERT INTO product_daily_reservations(
              id,order_id,order_item_id,product_id,reserve_date,quantity,status,created_at
            )
            SELECT ?,?,?,?,?,CASE
              WHEN (
                COALESCE((
                  SELECT SUM(quantity)
                  FROM product_daily_reservations
                  WHERE product_id=? AND reserve_date=? AND status='active'
                ),0) + ?
              ) <= (
                SELECT daily_limit
                FROM product_daily_limits
                WHERE product_id=? AND active=1
              )
              THEN ?
              ELSE 0
            END,'active',?`)
            .bind(
              crypto.randomUUID(),
              orderId,
              item.id,
              item.product.id,
              scheduleDate,
              item.product.id,
              scheduleDate,
              item.quantity,
              item.product.id,
              item.quantity,
              now,
            )),
    ];

    if (customOrderItem && custom) {
      statements.push(
        runtimeEnv.DB
          .prepare(`INSERT INTO order_item_customizations(id,order_item_id,category,budget_option,desired_composition,preferred_cut,fat_preference,packaging_request,other_request,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
          .bind(
            crypto.randomUUID(),
            customOrderItem.id,
            clean(custom.category),
            clean(custom.budgetOption),
            clean(custom.desiredComposition),
            clean(custom.preferredCut),
            clean(custom.fatPreference),
            clean(custom.packagingRequest),
            clean(custom.otherRequest),
            now,
          ),
      );
    }
    statements.push(
      runtimeEnv.DB
        .prepare("INSERT INTO order_events(id,order_id,event_type,after_data,created_at) VALUES(?,?,'order_submitted',?,?)")
        .bind(
          crypto.randomUUID(),
          orderId,
          JSON.stringify({
            fulfillmentType: payload.fulfillmentType,
            totalAmount: total,
            pickupAt,
            shipDate,
            customOrder: Boolean(customOrderItem),
          }),
          now,
        ),
    );

    await runtimeEnv.DB.batch(statements);
    console.info("order_created", {
      orderId,
      orderNo,
      idempotencyKey,
      fulfillmentId,
      fulfillmentType: payload.fulfillmentType,
      scheduleDate,
      createdAt: now,
    });
    const created = await runtimeEnv.DB
      .prepare("SELECT * FROM orders WHERE id=?")
      .bind(orderId)
      .first<OrderRow>();
    const [order] = await serializeOrders(created ? [created] : []);
    return Response.json({ order }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "주문을 접수하지 못했습니다.";
    if ((message.includes("UNIQUE") || message.includes("idempotency")) && idempotencyKey) {
      const existing = await runtimeEnv.DB
        .prepare("SELECT * FROM orders WHERE idempotency_key=?")
        .bind(idempotencyKey)
        .first<OrderRow>();
      if (existing) {
        const [order] = await serializeOrders([existing]);
        return Response.json({ order, duplicate: true });
      }
    }
    if (
      message.includes("daily product limit exceeded")
      || message.includes("product_daily_reservations_quantity_positive")
    ) {
      return Response.json(
        { error: "선택한 날짜의 한정수량이 마감되었습니다. 수량 또는 날짜를 다시 확인해주세요." },
        { status: 409 },
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

/// <reference types="vite/client" />
import { env } from "cloudflare:workers";
import { validateAndGroupBulkOrderRows, todayInSeoul, type BulkOrderGroup, type BulkOrderRowInput } from "../../../lib/bulk-order-import";
import { OPERATOR_ACTOR, requireOperatorApi } from "../../../lib/operator-session";
import { nextOrderNo, orderNumberPrefix } from "../../../lib/order-number";

type ProductRow = {
  id: string;
  code: string;
  name: string;
  price: number;
  daily_limit: number | null;
  active: number;
};

type ExistingOrderRow = {
  idempotency_key: string;
  order_no: string;
};

type ReservedRow = {
  product_id: string;
  schedule_date: string;
  quantity: number;
};

type ImportResult = {
  groupKey: string;
  status: "created" | "existing" | "failed";
  orderNo?: string;
  message?: string;
};

const runtimeEnv = env as typeof env & { DB: D1Database };

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(",");
}

function idempotencyKey(fileHash: string, groupKey: string) {
  return `bulk-xlsx:${fileHash}:${groupKey}`;
}

function dueAtFor(group: BulkOrderGroup) {
  return group.fulfillmentType === "pickup"
    ? `${group.scheduleDate}T${group.pickupTime}:00+09:00`
    : `${group.scheduleDate}T00:00:00+09:00`;
}

function deliveryMethodFor(group: BulkOrderGroup) {
  return group.fulfillmentType === "pickup" ? "onsite_reservation" as const : "delivery" as const;
}

async function existingOrders(keys: string[]) {
  if (!keys.length) return [] as ExistingOrderRow[];
  const result = await runtimeEnv.DB.prepare(`
    SELECT idempotency_key,order_no
    FROM orders
    WHERE idempotency_key IN (${placeholders(keys)})
  `).bind(...keys).all<ExistingOrderRow>();
  return result.results;
}

async function catalogForCodes(codes: string[]) {
  if (!codes.length) return [] as ProductRow[];
  const result = await runtimeEnv.DB.prepare(`
    SELECT id,code,name,price,daily_limit,active
    FROM products
    WHERE code IN (${placeholders(codes)})
  `).bind(...codes).all<ProductRow>();
  return result.results;
}

async function reservedForDates(dates: string[]) {
  if (!dates.length) return [] as ReservedRow[];
  const result = await runtimeEnv.DB.prepare(`
    SELECT product_id,date(due_at) AS schedule_date,SUM(quantity) AS quantity
    FROM work_items
    WHERE date(due_at) IN (${placeholders(dates)})
      AND work_status!='cancelled'
    GROUP BY product_id,date(due_at)
  `).bind(...dates).all<ReservedRow>();
  return result.results;
}

async function allocatedOrderNumbers(count: number) {
  const today = todayInSeoul();
  const prefix = orderNumberPrefix(today);
  const current = await runtimeEnv.DB.prepare(`
    SELECT order_no
    FROM orders
    WHERE order_no LIKE ?
  `).bind(`${prefix}%`).all<{ order_no: string }>();
  const values = current.results.map((row) => row.order_no);
  return Array.from({ length: count }, () => {
    const next = nextOrderNo(today, values);
    values.push(next);
    return next;
  });
}

function workItemStatements(
  group: BulkOrderGroup,
  productsByCode: Map<string, ProductRow>,
  orderId: string,
  now: string,
) {
  const dueAt = dueAtFor(group);
  const deliveryMethod = deliveryMethodFor(group);
  const shipping = group.fulfillmentType === "shipping";
  return group.items.flatMap((item) => {
    const product = productsByCode.get(item.productCode)!;
    const workItemId = crypto.randomUUID();
    const lineTotal = product.price * item.quantity;
    return [
      runtimeEnv.DB.prepare(`
        INSERT INTO work_items(
          id,order_id,product_id,product_name_snapshot,unit_price_snapshot,quantity,line_total,
          delivery_method,due_at,work_status,recipient_name,recipient_phone,postal_code,
          road_addr,road_addr_reference,jibun_addr,detail_addr,customization_json,note,
          version,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,'received',?,?,?,?,?,?,?,?,?,1,?,?)
      `).bind(
        workItemId,
        orderId,
        product.id,
        product.name,
        product.price,
        item.quantity,
        lineTotal,
        deliveryMethod,
        dueAt,
        shipping ? group.recipientName : null,
        shipping ? group.recipientPhone : null,
        shipping ? group.postalCode : null,
        shipping ? group.roadAddr : null,
        shipping ? group.roadAddrReference || null : null,
        shipping ? group.jibunAddr || null : null,
        shipping ? group.detailAddr : null,
        null,
        group.note,
        now,
        now,
      ),
      runtimeEnv.DB.prepare(`
        INSERT INTO work_item_events(
          id,work_item_id,order_id,event_type,from_value,to_value,actor,created_at
        ) VALUES(?,?,?,'work_item_created',NULL,?,?,?)
      `).bind(
        crypto.randomUUID(),
        workItemId,
        orderId,
        JSON.stringify({
          deliveryMethod,
          dueAt,
          workStatus: "received",
          source: "bulk_xlsx",
        }),
        OPERATOR_ACTOR,
        now,
      ),
    ];
  });
}

export async function POST(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  let payload: { fileHash?: unknown; rows?: unknown };
  try {
    payload = await request.json() as { fileHash?: unknown; rows?: unknown };
  } catch {
    return Response.json({ error: "업로드 요청을 읽지 못했습니다." }, { status: 400 });
  }

  const fileHash = typeof payload.fileHash === "string" ? payload.fileHash.trim().toLowerCase() : "";
  if (!/^[a-f0-9]{64}$/.test(fileHash) || !Array.isArray(payload.rows)) {
    return Response.json({ error: "엑셀 파일 정보와 주문 행을 확인해주세요." }, { status: 400 });
  }

  const validation = validateAndGroupBulkOrderRows(payload.rows as BulkOrderRowInput[], todayInSeoul());
  if (validation.errors.length) {
    return Response.json({ error: "엑셀 입력값을 확인해주세요.", errors: validation.errors }, { status: 400 });
  }

  try {
    const groupKeys = validation.groups.map((group) => idempotencyKey(fileHash, group.groupKey));
    const existing = await existingOrders(groupKeys);
    const existingByKey = new Map(existing.map((order) => [order.idempotency_key, order]));
    const pending = validation.groups.filter((group) => !existingByKey.has(idempotencyKey(fileHash, group.groupKey)));
    const codes = [...new Set(pending.flatMap((group) => group.items.map((item) => item.productCode)))];
    const products = await catalogForCodes(codes);
    const productsByCode = new Map(products.map((product) => [product.code.toUpperCase(), product]));
    const productErrors = pending.flatMap((group) => group.items.flatMap((item) => {
      const product = productsByCode.get(item.productCode);
      if (product?.active) return [];
      return item.rowNumbers.map((rowNumber) => ({
        rowNumber,
        field: "상품코드",
        message: product ? "현재 주문할 수 없는 상품입니다." : "상품코드표에 없는 상품입니다.",
      }));
    }));
    if (productErrors.length) {
      return Response.json({ error: "상품코드를 확인해주세요.", errors: productErrors }, { status: 409 });
    }

    const dates = [...new Set(pending.map((group) => group.scheduleDate))];
    const reserved = await reservedForDates(dates);
    const reservedByProductDate = new Map(reserved.map((row) => [`${row.schedule_date}\u0000${row.product_id}`, row.quantity]));
    const requestedByProductDate = new Map<string, { quantity: number; groups: Set<string>; product: ProductRow; date: string }>();
    for (const group of pending) {
      for (const item of group.items) {
        const product = productsByCode.get(item.productCode)!;
        const key = `${group.scheduleDate}\u0000${product.id}`;
        const current = requestedByProductDate.get(key) ?? { quantity: 0, groups: new Set<string>(), product, date: group.scheduleDate };
        current.quantity += item.quantity;
        current.groups.add(group.groupKey);
        requestedByProductDate.set(key, current);
      }
    }
    const capacityErrors = [...requestedByProductDate.entries()].flatMap(([key, value]) => {
      const reservedQuantity = reservedByProductDate.get(key) ?? 0;
      if (value.product.daily_limit === null || reservedQuantity + value.quantity <= value.product.daily_limit) return [];
      return [...value.groups].map((groupKey) => ({
        rowNumber: null,
        field: "수량",
        message: `${groupKey} 주문: ${value.date} ${value.product.name} 한정수량을 초과합니다.`,
      }));
    });
    if (capacityErrors.length) {
      return Response.json({ error: "일정별 한정수량을 확인해주세요.", errors: capacityErrors }, { status: 409 });
    }

    const orderNumbers = await allocatedOrderNumbers(pending.length);
    const results: ImportResult[] = validation.groups
      .filter((group) => existingByKey.has(idempotencyKey(fileHash, group.groupKey)))
      .map((group) => ({
        groupKey: group.groupKey,
        status: "existing",
        orderNo: existingByKey.get(idempotencyKey(fileHash, group.groupKey))!.order_no,
      }));

    for (const [index, group] of pending.entries()) {
      const key = idempotencyKey(fileHash, group.groupKey);
      const orderId = crypto.randomUUID();
      const orderNo = orderNumbers[index];
      const now = new Date().toISOString();
      const totalAmount = group.items.reduce((sum, item) => sum + productsByCode.get(item.productCode)!.price * item.quantity, 0);
      const statements: D1PreparedStatement[] = [
        runtimeEnv.DB.prepare(`
          INSERT INTO orders(
            id,order_no,buyer_name,buyer_phone,payment_status,paid_amount,total_amount,
            customer_arrived_at,customer_note,idempotency_key,version,created_at,updated_at
          ) VALUES(?,?,?,?,'unpaid',0,?,NULL,?,?,1,?,?)
        `).bind(
          orderId,
          orderNo,
          group.buyerName,
          group.buyerPhone,
          totalAmount,
          group.note,
          key,
          now,
          now,
        ),
        runtimeEnv.DB.prepare(`
          INSERT INTO work_item_events(
            id,work_item_id,order_id,event_type,from_value,to_value,actor,created_at
          ) VALUES(?,NULL,?,'order_created',NULL,?,?,?)
        `).bind(
          crypto.randomUUID(),
          orderId,
          JSON.stringify({
            source: "bulk_xlsx",
            fulfillmentType: group.fulfillmentType,
            itemCount: group.items.length,
            rowCount: group.rowNumbers.length,
            redactedFields: ["buyerName", "buyerPhone", "recipientName", "recipientPhone", "address"],
          }),
          OPERATOR_ACTOR,
          now,
        ),
        ...workItemStatements(group, productsByCode, orderId, now),
      ];
      try {
        await runtimeEnv.DB.batch(statements);
        results.push({ groupKey: group.groupKey, status: "created", orderNo });
      } catch {
        const concurrent = await existingOrders([key]);
        if (concurrent[0]) {
          results.push({ groupKey: group.groupKey, status: "existing", orderNo: concurrent[0].order_no });
        } else {
          results.push({ groupKey: group.groupKey, status: "failed", message: "주문을 저장하지 못했습니다. 파일을 다시 업로드하면 저장되지 않은 주문만 재시도합니다." });
        }
      }
    }

    const createdCount = results.filter((result) => result.status === "created").length;
    const existingCount = results.filter((result) => result.status === "existing").length;
    const failedCount = results.filter((result) => result.status === "failed").length;
    return Response.json(
      { summary: { createdCount, existingCount, failedCount }, results },
      { status: failedCount ? 207 : 201 },
    );
  } catch {
    return Response.json({ error: "대량 주문을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}

import { getDb } from "../../../../db";
import { validateAndGroupBulkOrderRows, todayInSeoul, type BulkOrderGroup, type BulkOrderRowInput } from "../../../lib/bulk-order-import";
import { normalizeCustomerName, primaryCustomerAccountId } from "../../../lib/customer-ledger-domain";
import { latestProductAvailability } from "../../../lib/product-availability";
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

type ProductAvailabilityRow = { id: string; entity_id: string; after_data: string | null };
type ExistingOrderRow = { idempotency_key: string; order_no: string };
type ReservedRow = { product_id: string; reserve_date: string; quantity: number };
type SeasonRow = { id: string; sales_start_date: string; sales_end_date: string };
type ImportResult = {
  groupKey: string;
  status: "created" | "existing" | "failed";
  orderNo?: string;
  message?: string;
};

const runtimeEnv = { DB: getDb() };

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(",");
}

function idempotencyKey(fileHash: string, groupKey: string) {
  return `bulk-xlsx:${fileHash}:${groupKey}`;
}

function scheduleLabel(group: BulkOrderGroup) {
  return group.fulfillmentType === "pickup"
    ? `${group.scheduleDate} · ${group.pickupTime}`
    : `${group.scheduleDate} 발송 예정`;
}

async function existingOrders(keys: string[]) {
  if (!keys.length) return [] as ExistingOrderRow[];
  const result = await runtimeEnv.DB.prepare(`
    SELECT idempotency_key,order_no FROM orders
    WHERE idempotency_key IN (${placeholders(keys)})
  `).bind(...keys).all<ExistingOrderRow>();
  return result.results;
}

async function catalogForCodes(codes: string[]) {
  if (!codes.length) return [] as ProductRow[];
  const result = await runtimeEnv.DB.prepare(`
    SELECT p.id,p.code,p.name,p.price,p.active,COALESCE(p.daily_limit,l.daily_limit) AS daily_limit
    FROM products p
    LEFT JOIN product_daily_limits l ON l.product_id=p.id AND l.active=1
    WHERE p.code IN (${placeholders(codes)})
  `).bind(...codes).all<ProductRow>();
  return result.results;
}

async function soldOutProductIds(productIds: string[]) {
  if (!productIds.length) return new Set<string>();
  const result = await runtimeEnv.DB.prepare(`
    SELECT id,entity_id,after_data
    FROM configuration_events
    WHERE entity_type='product_availability'
      AND entity_id IN (${placeholders(productIds)})
    ORDER BY created_at DESC,id DESC
  `).bind(...productIds).all<ProductAvailabilityRow>();
  const latest = latestProductAvailability(result.results.map((row) => ({
    id: row.id,
    entityId: row.entity_id,
    afterData: row.after_data,
  })));
  return new Set([...latest].filter(([, value]) => value.soldOut).map(([productId]) => productId));
}

async function reservedForDates(dates: string[]) {
  if (!dates.length) return [] as ReservedRow[];
  const result = await runtimeEnv.DB.prepare(`
    SELECT product_id,date(due_at) AS reserve_date,SUM(quantity) AS quantity
    FROM work_items
    WHERE date(due_at) IN (${placeholders(dates)}) AND work_status!='cancelled'
    GROUP BY product_id,date(due_at)
  `).bind(...dates).all<ReservedRow>();
  return result.results;
}

async function allocatedOrderNumbers(count: number) {
  const today = todayInSeoul();
  const prefix = orderNumberPrefix(today);
  const current = await runtimeEnv.DB.prepare(`
    SELECT order_no FROM orders WHERE order_no LIKE ?
  `).bind(`${prefix}%`).all<{ order_no: string }>();
  const values = current.results.map((row) => row.order_no);
  return Array.from({ length: count }, () => {
    const next = nextOrderNo(today, values);
    values.push(next);
    return next;
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
    const season = await runtimeEnv.DB.prepare(`
      SELECT id,sales_start_date,sales_end_date
      FROM sales_seasons WHERE active=1
      ORDER BY sales_start_date DESC LIMIT 1
    `).first<SeasonRow>();
    if (!season) return Response.json({ error: "현재 예약 가능한 판매 시즌이 없습니다." }, { status: 409 });

    const seasonErrors = validation.groups.flatMap((group) => (
      group.scheduleDate < season.sales_start_date || group.scheduleDate > season.sales_end_date
        ? [{ rowNumber: group.rowNumbers[0] ?? null, field: "수령/발송일", message: "현재 판매 시즌의 예약 가능 기간을 벗어났습니다." }]
        : []
    ));
    if (seasonErrors.length) {
      return Response.json({ error: "예약 가능한 날짜를 확인해주세요.", errors: seasonErrors }, { status: 400 });
    }

    const groupKeys = validation.groups.map((group) => idempotencyKey(fileHash, group.groupKey));
    const existing = await existingOrders(groupKeys);
    const existingByKey = new Map(existing.map((order) => [order.idempotency_key, order]));
    const pending = validation.groups.filter((group) => !existingByKey.has(idempotencyKey(fileHash, group.groupKey)));
    const codes = [...new Set(pending.flatMap((group) => group.items.map((item) => item.productCode)))];
    const products = await catalogForCodes(codes);
    const productsByCode = new Map(products.map((product) => [product.code.toUpperCase(), product]));
    const soldOutIds = await soldOutProductIds(products.map((product) => product.id));
    const productErrors = pending.flatMap((group) => group.items.flatMap((item) => {
      const product = productsByCode.get(item.productCode);
      if (product?.active && !soldOutIds.has(product.id)) return [];
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
    const reservedByProductDate = new Map(reserved.map((row) => [`${row.reserve_date}\u0000${row.product_id}`, row.quantity]));
    const requested = new Map<string, { quantity: number; groups: Set<string>; product: ProductRow; date: string }>();
    for (const group of pending) {
      for (const item of group.items) {
        const product = productsByCode.get(item.productCode)!;
        const key = `${group.scheduleDate}\u0000${product.id}`;
        const current = requested.get(key) ?? { quantity: 0, groups: new Set<string>(), product, date: group.scheduleDate };
        current.quantity += item.quantity;
        current.groups.add(group.groupKey);
        requested.set(key, current);
      }
    }
    const capacityErrors = [...requested.entries()].flatMap(([key, value]) => {
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
      const fulfillmentId = crypto.randomUUID();
      const orderNo = orderNumbers[index];
      const now = new Date().toISOString();
      const pricedItems = group.items.map((item) => {
        const product = productsByCode.get(item.productCode)!;
        return { id: crypto.randomUUID(), product, quantity: item.quantity, lineTotal: product.price * item.quantity };
      });
      const totalAmount = pricedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const normalizedName = normalizeCustomerName(group.buyerName);
      const existingCustomer = await runtimeEnv.DB.prepare(`
        SELECT id FROM customer_accounts
        WHERE normalized_name=? AND normalized_phone=? AND is_primary=1
        ORDER BY ledger_sequence LIMIT 1
      `).bind(normalizedName, group.buyerPhone).first<{ id: string }>();
      const customerAccountId = existingCustomer?.id ?? await primaryCustomerAccountId(normalizedName, group.buyerPhone);
      const pickupAt = group.fulfillmentType === "pickup"
        ? `${group.scheduleDate}T${group.pickupTime}:00+09:00`
        : null;
      const shipDate = group.fulfillmentType === "shipping" ? group.scheduleDate : null;
      const dueAt = pickupAt ?? `${group.scheduleDate}T00:00:00+09:00`;
      const deliveryMethod = group.fulfillmentType === "shipping" ? "delivery" : "onsite_reservation";
      const shipping = group.fulfillmentType === "shipping";
      const statements: D1PreparedStatement[] = [
        runtimeEnv.DB.prepare(`
          INSERT OR IGNORE INTO customer_accounts(
            id,normalized_name,normalized_phone,display_name,display_phone,ledger_sequence,
            ledger_label,is_primary,created_at,updated_at
          ) VALUES(?,?,?,?,?,1,'',1,?,?)
        `).bind(customerAccountId, normalizedName, group.buyerPhone, group.buyerName, group.buyerPhone, now, now),
        runtimeEnv.DB.prepare(`
          INSERT INTO orders(
            id,order_no,season_id,buyer_name_snapshot,buyer_phone_snapshot,order_status,
            fulfillment_type,schedule_label,recipient_name,recipient_phone,road_address,
            detail_address,buyer_name,buyer_phone,payment_status,paid_amount,customer_arrived_at,
            customer_note,total_amount,idempotency_key,version,submitted_at,created_at,updated_at
          ) VALUES(?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,'unpaid',0,NULL,?,?,?,1,?,?,?)
        `).bind(
          orderId, orderNo, season.id, group.buyerName, group.buyerPhone,
          group.fulfillmentType, scheduleLabel(group), shipping ? group.recipientName : null,
          shipping ? group.recipientPhone : null, shipping ? group.roadAddr : null,
          shipping ? group.detailAddr : null, group.buyerName, group.buyerPhone,
          group.note, totalAmount, key, now, now, now,
        ),
        runtimeEnv.DB.prepare(`
          INSERT INTO order_customer_accounts(order_id,customer_account_id,linked_at,linked_by,link_reason)
          VALUES(?,?,?,?,'bulk_xlsx')
        `).bind(orderId, customerAccountId, now, OPERATOR_ACTOR),
        ...pricedItems.map((item) => runtimeEnv.DB.prepare(`
          INSERT INTO order_items(
            id,order_id,product_id,product_name_snapshot,list_price_snapshot,
            sale_unit_price,quantity,line_total,created_at
          ) VALUES(?,?,?,?,?,?,?,?,?)
        `).bind(item.id, orderId, item.product.id, item.product.name, item.product.price, item.product.price, item.quantity, item.lineTotal, now)),
        ...pricedItems.map((item) => runtimeEnv.DB.prepare(`
          INSERT INTO work_items(
            id,order_id,product_id,product_name_snapshot,unit_price_snapshot,quantity,line_total,
            delivery_method,due_at,work_status,recipient_name,recipient_phone,postal_code,
            road_addr,road_addr_reference,jibun_addr,detail_addr,customization_json,note,
            version,created_at,updated_at
          ) VALUES(?,?,?,?,?,?,?, ?,?,'received',?,?,?,?,?,?,?,?,?,1,?,?)
        `).bind(
          item.id,
          orderId,
          item.product.id,
          item.product.name,
          item.product.price,
          item.quantity,
          item.lineTotal,
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
        )),
        ...pricedItems.map((item) => runtimeEnv.DB.prepare(`
          INSERT INTO work_item_events(
            id,work_item_id,order_id,event_type,from_value,to_value,actor,created_at
          ) VALUES(?,?,?,'work_item_created',NULL,?,?,?)
        `).bind(
          crypto.randomUUID(),
          item.id,
          orderId,
          JSON.stringify({ source: "bulk_xlsx", deliveryMethod, dueAt }),
          OPERATOR_ACTOR,
          now,
        )),
        runtimeEnv.DB.prepare(`
          INSERT INTO fulfillments(
            id,order_id,fulfillment_type,pickup_at,ship_date,recipient_name,recipient_phone,
            postal_code,road_addr,road_addr_reference,jibun_addr,detail_addr,status,
            customer_arrived,note,created_at,updated_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'scheduled',0,?,?,?)
        `).bind(
          fulfillmentId, orderId, group.fulfillmentType, pickupAt, shipDate,
          shipping ? group.recipientName : null, shipping ? group.recipientPhone : null,
          shipping ? group.postalCode : null, shipping ? group.roadAddr : null,
          shipping ? group.roadAddrReference || null : null, shipping ? group.jibunAddr || null : null,
          shipping ? group.detailAddr : null, group.note, now, now,
        ),
        ...pricedItems.map((item) => runtimeEnv.DB.prepare(`
          INSERT INTO fulfillment_items(id,fulfillment_id,order_item_id,quantity,created_at)
          VALUES(?,?,?,?,?)
        `).bind(crypto.randomUUID(), fulfillmentId, item.id, item.quantity, now)),
        ...pricedItems.filter((item) => item.product.daily_limit !== null).map((item) => runtimeEnv.DB.prepare(`
          INSERT INTO product_daily_reservations(
            id,order_id,order_item_id,product_id,reserve_date,quantity,status,created_at
          ) SELECT ?,?,?,?,?,CASE WHEN (
            COALESCE((SELECT SUM(quantity) FROM product_daily_reservations
              WHERE product_id=? AND reserve_date=? AND status='active'),0) + ?
          ) <= ? THEN ? ELSE 0 END,'active',?
        `).bind(
          crypto.randomUUID(), orderId, item.id, item.product.id, group.scheduleDate,
          item.product.id, group.scheduleDate, item.quantity, item.product.daily_limit,
          item.quantity, now,
        )),
        runtimeEnv.DB.prepare(`
          INSERT INTO order_events(id,order_id,event_type,after_data,actor_id,created_at)
          VALUES(?,?,'order_submitted',?,?,?)
        `).bind(
          crypto.randomUUID(), orderId,
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

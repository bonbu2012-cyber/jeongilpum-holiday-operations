import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import fs from "node:fs";
import { getDb } from "../db/index.ts";
import { readBulkOrderWorkbook } from "../app/lib/xlsx-order-reader.ts";
import { validateAndGroupBulkOrderRows, type BulkOrderGroup } from "../app/lib/bulk-order-import.ts";
import { normalizeCustomerName, primaryCustomerAccountId } from "../app/lib/customer-ledger-domain.ts";
import { nextOrderNo, orderNumberPrefix } from "../app/lib/order-number.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function sha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function scheduleLabel(group: BulkOrderGroup) {
  return group.fulfillmentType === "pickup"
    ? `${group.scheduleDate} · ${group.pickupTime || "10:00"}`
    : `${group.scheduleDate} 발송`;
}

async function main() {
  console.log("=== 1. Locating Desktop Excel File ===");
  const desktopDir = "C:\\Users\\LG\\Desktop";
  const files = fs.readdirSync(desktopDir);
  const fileName = files.find((f) => f.startsWith("명절예약 전체") && f.endsWith(".xlsx"));

  if (!fileName) {
    console.error("No '명절예약 전체*.xlsx' file found on Desktop.");
    process.exit(1);
  }

  const filePath = resolve(desktopDir, fileName);
  console.log(`Found: ${filePath}`);

  const fileBuffer = await readFile(filePath);
  const fileHash = sha256(fileBuffer);
  console.log(`File hash: ${fileHash.slice(0, 16)}...`);

  console.log("\n=== 2. Parsing Excel Rows ===");
  const rawRows = await readBulkOrderWorkbook(fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength));
  console.log(`Extracted ${rawRows.length} order rows from sheet.`);

  console.log("\n=== 3. Validating & Grouping ===");
  const validation = validateAndGroupBulkOrderRows(rawRows, "2026-08-01");
  if (validation.errors.length > 0) {
    console.error("Validation failed with errors:", validation.errors);
    process.exit(1);
  }

  console.log(`Grouped into ${validation.groups.length} distinct orders with 0 errors!`);

  const db = getDb();
  const season = await db.prepare(
    "SELECT id, sales_start_date, sales_end_date FROM sales_seasons WHERE active=1 ORDER BY sales_start_date DESC LIMIT 1"
  ).first<{ id: string; sales_start_date: string; sales_end_date: string }>();

  if (!season) {
    console.error("No active sales season found in database.");
    process.exit(1);
  }
  console.log(`Target sales season: ${season.id} (${season.sales_start_date} ~ ${season.sales_end_date})`);

  const catalogProducts = await db.prepare("SELECT id, code, name, price, active FROM products").all<{
    id: string;
    code: string;
    name: string;
    price: number;
    active: number;
  }>();
  const productsByCode = new Map(catalogProducts.results.map((p) => [p.code.toUpperCase(), p]));
  if (!productsByCode.has("CUSTOM")) {
    productsByCode.set("CUSTOM", {
      id: "custom-order",
      code: "CUSTOM",
      name: "맞춤주문",
      price: 0,
      active: 1,
    });
  }

  console.log("\n=== 4. Importing Orders into Database ===");

  const existingOrders = await db.prepare("SELECT order_no FROM orders").all<{ order_no: string }>();
  const usedOrderNos = new Set(existingOrders.results.map((o) => o.order_no));

  let importedCount = 0;
  for (const [idx, group] of validation.groups.entries()) {
    const orderId = crypto.randomUUID();
    const fulfillmentId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Generate date-based order number: JI-YYMMDD-XXXX
    const dateParts = group.scheduleDate.slice(2).replace(/-/g, ""); // e.g. 260904
    const prefix = `JI-${dateParts}-`;
    let seq = 1;
    let orderNo = `${prefix}${String(seq).padStart(4, "0")}`;
    while (usedOrderNos.has(orderNo)) {
      seq++;
      orderNo = `${prefix}${String(seq).padStart(4, "0")}`;
    }
    usedOrderNos.add(orderNo);

    const idempotencyKey = `bulk-excel:${fileHash}:${group.groupKey}`;

    const pricedItems = group.items.map((item) => {
      const product = productsByCode.get(item.productCode) || {
        id: "custom-order",
        code: "CUSTOM",
        name: item.productName || "맞춤주문",
        price: item.unitPrice || 0,
        active: 1,
      };
      const unitPrice = typeof item.unitPrice === "number" && item.unitPrice > 0 ? item.unitPrice : product.price;
      const lineTotal = typeof item.lineTotal === "number" && item.lineTotal > 0 ? item.lineTotal : unitPrice * item.quantity;
      const productName = item.productName || product.name;
      return {
        id: crypto.randomUUID(),
        product,
        productName,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
        isCustom: item.productCode === "CUSTOM" || item.isCustom,
      };
    });

    const totalAmount = group.totalAmount > 0 ? group.totalAmount : pricedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const paymentStatus = group.paymentStatus || "unpaid";
    const paidAmount = paymentStatus === "paid" ? totalAmount : 0;

    const normalizedName = normalizeCustomerName(group.buyerName);
    const customerAccountId = `cust_${normalizedName}_${group.buyerPhone || "01000000000"}`;

    const pickupAt = group.fulfillmentType === "pickup"
      ? `${group.scheduleDate}T${group.pickupTime || "10:00"}:00+09:00`
      : null;
    const shipDate = group.fulfillmentType === "shipping" ? group.scheduleDate : null;
    const dueAt = pickupAt ?? `${group.scheduleDate}T00:00:00+09:00`;
    const deliveryMethod = group.deliveryMethod || (group.fulfillmentType === "shipping" ? "delivery" : "onsite_reservation");
    const shipping = group.fulfillmentType === "shipping";

    // 1. Customer Account
    await db.prepare(`
      INSERT INTO customer_accounts(
        id, normalized_name, normalized_phone, display_name, display_phone,
        ledger_sequence, ledger_label, is_primary, created_at, updated_at
      ) VALUES(?,?,?,?,?,1,'',true,?,?)
      ON CONFLICT DO NOTHING
    `).bind(customerAccountId, normalizedName, group.buyerPhone, group.buyerName, group.buyerPhone, now, now).run();

    // 2. Order
    await db.prepare(`
      INSERT INTO orders(
        id, order_no, season_id, buyer_name_snapshot, buyer_phone_snapshot, order_status,
        fulfillment_type, schedule_label, recipient_name, recipient_phone, road_address,
        detail_address, buyer_name, buyer_phone, payment_status, paid_amount, customer_arrived_at,
        customer_note, total_amount, idempotency_key, version, submitted_at, created_at, updated_at
      ) VALUES(?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,?,?,NULL,?,?,?,1,?,?,?)
      ON CONFLICT (order_no) DO NOTHING
    `).bind(
      orderId, orderNo, season.id, group.buyerName, group.buyerPhone,
      group.fulfillmentType, scheduleLabel(group),
      shipping ? (group.recipientName || group.buyerName) : null,
      shipping ? (group.recipientPhone || group.buyerPhone) : null,
      shipping ? group.roadAddr : null,
      shipping ? group.detailAddr : null,
      group.buyerName, group.buyerPhone,
      paymentStatus, paidAmount,
      group.note, totalAmount, idempotencyKey,
      now, now, now
    ).run();

    // 3. Order Customer Account Link
    await db.prepare(`
      INSERT INTO order_customer_accounts(order_id, customer_account_id, linked_at, linked_by, link_reason)
      VALUES(?,?,?,'operator','bulk_xlsx')
      ON CONFLICT DO NOTHING
    `).bind(orderId, customerAccountId, now).run();

    // 4. Order Items & Work Items
    for (const item of pricedItems) {
      await db.prepare(`
        INSERT INTO order_items(
          id, order_id, product_id, product_name_snapshot, list_price_snapshot,
          sale_unit_price, quantity, line_total, created_at
        ) VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT DO NOTHING
      `).bind(
        item.id, orderId, item.product.id, item.productName,
        item.unitPrice, item.unitPrice, item.quantity, item.lineTotal, now
      ).run();

      await db.prepare(`
        INSERT INTO work_items(
          id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total,
          delivery_method, due_at, work_status, recipient_name, recipient_phone, postal_code,
          road_addr, road_addr_reference, jibun_addr, detail_addr, customization_json, note,
          version, created_at, updated_at
        ) VALUES(?,?,?,?,?,?,?, ?,?,'received',?,?,?,?,?,?,?,?,?,1,?,?)
        ON CONFLICT DO NOTHING
      `).bind(
        item.id, orderId, item.product.id, item.productName, item.unitPrice,
        item.quantity, item.lineTotal, deliveryMethod, dueAt,
        shipping ? (group.recipientName || group.buyerName) : null,
        shipping ? (group.recipientPhone || group.buyerPhone) : null,
        shipping ? group.postalCode : null,
        shipping ? group.roadAddr : null,
        shipping ? group.roadAddrReference || null : null,
        shipping ? group.jibunAddr || null : null,
        shipping ? group.detailAddr : null,
        item.isCustom ? item.productName : null,
        group.note, now, now
      ).run();

      await db.prepare(`
        INSERT INTO work_item_events(
          id, work_item_id, order_id, event_type, from_value, to_value, actor, created_at
        ) VALUES(?,?,?,'work_item_created',NULL,?,'operator',?)
      `).bind(
        crypto.randomUUID(), item.id, orderId,
        JSON.stringify({ source: "bulk_xlsx", deliveryMethod, dueAt }),
        now
      ).run();
    }

    // 5. Fulfillment & Fulfillment Items
    await db.prepare(`
      INSERT INTO fulfillments(
        id, order_id, fulfillment_type, pickup_at, ship_date, recipient_name, recipient_phone,
        postal_code, road_addr, road_addr_reference, jibun_addr, detail_addr, status,
        customer_arrived, note, created_at, updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'scheduled',false,?,?,?)
      ON CONFLICT DO NOTHING
    `).bind(
      fulfillmentId, orderId, group.fulfillmentType, pickupAt, shipDate,
      shipping ? (group.recipientName || group.buyerName) : null,
      shipping ? (group.recipientPhone || group.buyerPhone) : null,
      shipping ? group.postalCode : null,
      shipping ? group.roadAddr : null,
      shipping ? group.roadAddrReference || null : null,
      shipping ? group.jibunAddr || null : null,
      shipping ? group.detailAddr : null,
      group.note, now, now
    ).run();

    for (const item of pricedItems) {
      await db.prepare(`
        INSERT INTO fulfillment_items(id, fulfillment_id, order_item_id, quantity, created_at)
        VALUES(?,?,?,?,?)
        ON CONFLICT DO NOTHING
      `).bind(crypto.randomUUID(), fulfillmentId, item.id, item.quantity, now).run();
    }

    // 6. Order Event
    await db.prepare(`
      INSERT INTO order_events(id, order_id, event_type, after_data, actor_id, created_at)
      VALUES(?,?,'order_submitted',?,'operator',?)
    `).bind(
      crypto.randomUUID(), orderId,
      JSON.stringify({
        source: "bulk_xlsx",
        fulfillmentType: group.fulfillmentType,
        itemCount: pricedItems.length,
        paymentStatus,
        totalAmount,
      }),
      now
    ).run();

    importedCount++;
    console.log(`[${importedCount}/${validation.groups.length}] ${orderNo} | ${group.scheduleDate} | ${group.buyerName} | ${group.fulfillmentType === "pickup" ? "현장수령" : "택배"} | ${paymentStatus === "paid" ? "결제완료" : "미결제"} | ${totalAmount.toLocaleString()}원`);
  }

  console.log(`\n=== 5. Verification ===`);
  const finalOrders = await db.prepare("SELECT count(*) as c FROM orders").first<{ c: number }>();
  const finalItems = await db.prepare("SELECT count(*) as c FROM order_items").first<{ c: number }>();
  const finalWork = await db.prepare("SELECT count(*) as c FROM work_items").first<{ c: number }>();
  const finalFulfill = await db.prepare("SELECT count(*) as c FROM fulfillments").first<{ c: number }>();

  console.log(`- Orders in DB: ${finalOrders?.c}`);
  console.log(`- Order Items in DB: ${finalItems?.c}`);
  console.log(`- Work Items in DB: ${finalWork?.c}`);
  console.log(`- Fulfillments in DB: ${finalFulfill?.c}`);

  console.log(`\n>>> [SUCCESS] Successfully registered all ${importedCount} holiday orders into the system! <<<`);
}

main().catch(console.error);

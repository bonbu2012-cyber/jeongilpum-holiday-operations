import { getDb } from "../db";
import { parseLegacyOrderRows } from "../app/lib/legacy-order-csv-importer";
import { normalizeCustomerName } from "../app/lib/customer-ledger-domain";

export const RAW_LEGACY_CSV = `"주문번호","출고일","시간","주문자","상품","수량","단가","수령방식","받는사람","받는사람 전화번호","받는주소","합계금액","결제상태","결제금액","출고상태","검수상태"
"ORD-037","2026-09-04","","봉황정","사골×우족 49000","1","미정","현장수령","","","","49000","미결제","0","수령완료","검수대기"
"ORD-027","2026-09-08","","한화손해보험","LA갈비 95,000원 세트","26","미정","택배","","","","2470000","결제완료","2470000","출고완료","검수대기"
"ORD-019","2026-09-09","","정종철","팔영세트","4","300000","택배","","","","1200000","결제완료","1200000","출고완료","검수대기"
"ORD-021","2026-09-09","","봉황정","사골×우족 4만원 세트","6","미정","현장수령","","","","240000","미결제","0","출고예정","검수대기"
"ORD-022","2026-09-09","","류현석","봉황세트","9","미정","택배","","","","1800000","결제완료","1800000","출고완료","검수대기"
"ORD-026","2026-09-09","","정원기","프리미엄 진 세트","1","미정","택배","","","","320000","결제완료","320000","출고완료","검수대기"
"ORD-028","2026-09-09","","한화손해보험","LA갈비 95,000원 세트","1","미정","택배","","","","95000","결제완료","95000","출고완료","검수대기"
"ORD-033","2026-09-09","","김형문(k푸드)","팔영세트","1","미정","택배","","","","300000","결제완료","300000","출고완료","검수대기"
"ORD-058","2026-09-09","","봉황정","사골우족세트 49000","1","미정","현장수령","","","","49000","미결제","0","출고예정","검수대기"
"ORD-056","2026-09-10","","봉황정","사골우족세트 4만원","1","미정","택배","","","","40000","미결제","0","출고예정","검수대기"
"ORD-051","2026-09-11","","류현석","봉황세트","1","미정","현장수령","","","","200000","결제완료","200000","출고완료","검수대기"
"ORD-052","2026-09-11","","박신자","구이용 15만원(세트x)","1","미정","택배","","","","150000","결제완료","150000","출고완료","검수대기"
"ORD-053","2026-09-11","","성지민 (오다솜 지인)","LA갈비 2호","1","미정","택배","","","","148000","미결제","0","출고완료","검수대기"
"ORD-055","2026-09-11","","봉황정","사골우족세트 4만원","3","미정","현장수령","","","","120000","미결제","0","출고예정","검수대기"
"ORD-057","2026-09-12","","봉황정","사골우족세트 4만원","3","미정","배달","","","","120000","미결제","0","출고예정","검수대기"
"ORD-030","2026-09-14","","하옥 고객","상품 미정","1","미정","택배","","","","미정","미결제","0","출고예정","검수대기"
"ORD-032","2026-09-14","","송하국","프리미엄 진 세트","미정","미정","택배","","","","300000","미결제","0","출고예정","검수대기"
"ORD-059","2026-09-14","","류승범","프리미엄 미","1","220000","택배","류성훈","01044481000","광주광역시 서구 풍암순환로 135-1, 203동 903호 (한국아델리움 아파트)","220000","결제완료","220000","출고예정","검수대기"
"ORD-060","2026-09-14","","류승범","프리미엄 미","1","220000","택배","류상수","01036250007","광주광역시 북구 서강로 104-3, 1810호(운암동 운암프라자)","220000","결제완료","220000","출고예정","검수대기"
"ORD-068","2026-09-14","","권창근(부산)","LA갈비 1호","1","99000","택배","이정순","01049159649","부산광역시 북구 덕천로 234번길7, 동원아파트 104동 311호","99000","결제완료","99000","출고예정","검수대기"
"ORD-069","2026-09-14","","권창근","LA갈비 1호, 국거리 1만원, 한우구이용 7만원x2","1","249000","택배","권창근","01083819134","부산광역시 진구 엄광로 208번길 13, 성심빌라 202호","249000","결제완료","249000","출고예정","검수대기"
"ORD-070","2026-09-14","","김경철","오미트 시그니처","1","288000","택배","조희라","01086285971","광주광역시 북구 저불로80, 용봉동 현대아파트 3차 302동 1307호","288000","결제완료","288000","출고예정","검수대기"
"ORD-023","2026-09-16","","김보름","봉황세트","1","미정","택배","","","","미정","결제완료","미정","출고예정","검수대기"
"ORD-066","2026-09-17","오후 7시","함형구","프리미엄 선","6","270000","현장수령","","","","1620000","미결제","0","출고예정","검수대기"
"ORD-062","2026-09-18","","허성수","봉황세트","1","200000","택배","김민정","01064742194","경기도 안산시 단원구 광덕2로 32, 14단지 아파트 1415동 203호","200000","미결제","0","출고예정","검수대기"
"ORD-065","2026-09-19","","이슬비","la갈비 20만원/ 불고기 20만원","1","400000","택배","여수 ","","","400000","미결제","0","출고예정","검수대기"
"ORD-061","2026-09-20","","발대와 지게","프리미엄 미","4","220000","현장수령","","","","880000","미결제","0","출고예정","검수대기"
"ORD-031","2026-09-22","","하옥 고객","상품 미정","1","미정","현장수령","","","","미정","미결제","0","출고예정","검수대기"
"ORD-024","2026-09-22","15:00","김보름","실속세트","1","미정","현장수령","","","","144000","결제완료","144000","출고예정","검수대기"
"ORD-035","2026-09-23","","김문식(구암)","팔영세트 1개","1","미정","배달","","","","300000","결제완료","300000","출고예정","검수대기"
"ORD-054","2026-09-23","","김문식(구암)","LA갈비 700,000원(세트x)","1","미정","현장수령","","","","700000","결제완료","700000","출고예정","검수대기"
"ORD-071","2026-09-23","","김경철","오미트 시그니처","2","288000","현장수령","","","","576000","결제완료","576000","출고예정","검수대기"
"ORD-064","2026-09-24","오전","풍양 단골","30만원 (선물세트 x)","1","300000","현장수령","","","","300000","미결제","0","출고예정","검수대기"
"ORD-063","2026-09-25","","정승묵","40만원 프리미엄 세트","1","400000","현장수령","","","","400000","미결제","0","출고예정","검수대기"
"ORD-067","2026-09-25","","박윤규","프리미엄 미","1","220000","배달","","","","220000","결제완료","220000","출고예정","검수대기"
"ORD-072","2026-09-25","","박윤규","프리미엄 미","1","220000","배달","","","","220000","결제완료","220000","출고예정","검수대기"
"ORD-029","2026-09-25","오전","유한나","프리미엄 진 세트","1","미정","현장수령","","","","미정","결제완료","미정","출고예정","검수대기"
"ORD-042","2026-09-26","10:00","김보름","프리미엄 미 세트","1","미정","현장수령","","","","220000","결제완료","220000","출고예정","검수대기"`;

async function main() {
  const db = getDb();
  console.log("Parsing legacy CSV orders...");
  const { orders, errors } = parseLegacyOrderRows(RAW_LEGACY_CSV);
  if (errors.length > 0) {
    console.error("Parse errors:", errors);
    process.exit(1);
  }
  console.log(`Parsed ${orders.length} orders successfully.`);

  const season = await db.prepare(
    "SELECT id FROM sales_seasons WHERE active=1 ORDER BY sales_start_date DESC LIMIT 1"
  ).first<{ id: string }>();

  if (!season) {
    console.error("No active sales season found!");
    process.exit(1);
  }
  const seasonId = season.id;
  console.log(`Using season: ${seasonId}`);

  let importedCount = 0;
  for (const order of orders) {
    const orderId = crypto.randomUUID();
    const orderItemId = crypto.randomUUID();
    const fulfillmentId = crypto.randomUUID();
    const now = new Date().toISOString();
    const idempotencyKey = `legacy-import:${order.orderNo}`;

    const isPickup = order.fulfillmentType === "pickup";
    const pickupAt = isPickup ? `${order.scheduleDate}T${order.pickupTime || "10:00"}:00+09:00` : null;
    const shipDate = !isPickup ? order.scheduleDate : null;
    const dueAt = pickupAt ?? `${order.scheduleDate}T00:00:00+09:00`;
    const scheduleLabel = isPickup
      ? `${order.scheduleDate} · ${order.pickupTime || "10:00"}`
      : `${order.scheduleDate} 발송 예정`;

    const normalizedName = normalizeCustomerName(order.buyerName);
    const customerAccountId = `cust_${normalizedName}_${order.buyerPhone || "01000000000"}`;

    // Customer account
    await db.prepare(`
      INSERT INTO customer_accounts(
        id, normalized_name, normalized_phone, display_name, display_phone, ledger_sequence,
        ledger_label, is_primary, created_at, updated_at
      ) VALUES(?,?,?,?,?,1,'',true,?,?)
      ON CONFLICT DO NOTHING
    `).bind(
      customerAccountId,
      normalizedName,
      order.buyerPhone,
      order.buyerName,
      order.buyerPhone,
      now,
      now
    ).run();

    // Order
    await db.prepare(`
      INSERT INTO orders(
        id, order_no, season_id, buyer_name_snapshot, buyer_phone_snapshot, order_status,
        fulfillment_type, schedule_label, recipient_name, recipient_phone, road_address,
        detail_address, buyer_name, buyer_phone, payment_status, paid_amount, customer_arrived_at,
        customer_note, total_amount, idempotency_key, version, submitted_at, created_at, updated_at
      ) VALUES(?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,?,?,NULL,?,?,?,1,?,?,?)
      ON CONFLICT (order_no) DO NOTHING
    `).bind(
      orderId,
      order.orderNo,
      seasonId,
      order.buyerName,
      order.buyerPhone,
      order.fulfillmentType,
      scheduleLabel,
      order.recipientName || null,
      order.recipientPhone || null,
      order.roadAddr || null,
      order.detailAddr || null,
      order.buyerName,
      order.buyerPhone,
      order.paymentStatus,
      order.paidAmount,
      order.note,
      order.totalAmount,
      idempotencyKey,
      now,
      now,
      now
    ).run();

    // Check if inserted
    const inserted = await db.prepare("SELECT id FROM orders WHERE order_no = ?").bind(order.orderNo).first<{ id: string }>();
    if (!inserted) {
      console.log(`Order ${order.orderNo} already exists, skipping.`);
      continue;
    }
    const realOrderId = inserted.id;

    // Order item
    await db.prepare(`
      INSERT INTO order_items(
        id, order_id, product_id, product_name_snapshot, list_price_snapshot,
        sale_unit_price, quantity, line_total, created_at
      ) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT DO NOTHING
    `).bind(
      orderItemId,
      realOrderId,
      order.productId,
      order.productName,
      order.unitPrice,
      order.unitPrice,
      order.quantity,
      order.lineTotal,
      now
    ).run();

    // Work item
    await db.prepare(`
      INSERT INTO work_items(
        id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total,
        delivery_method, due_at, work_status, recipient_name, recipient_phone, postal_code,
        road_addr, road_addr_reference, jibun_addr, detail_addr, customization_json, note,
        version, created_at, updated_at
      ) VALUES(?,?,?,?,?,?,?, ?,?, ?,?,?,?,?,?,?,?,?,?,1,?,?)
      ON CONFLICT DO NOTHING
    `).bind(
      orderItemId,
      realOrderId,
      order.productId,
      order.productName,
      order.unitPrice,
      order.quantity,
      order.lineTotal,
      order.deliveryMethod,
      dueAt,
      order.workStatus,
      order.recipientName || null,
      order.recipientPhone || null,
      null, // postal_code
      order.roadAddr || null,
      null, // road_addr_reference
      null, // jibun_addr
      order.detailAddr || null,
      order.productId === "custom-order" ? order.rawProduct : null,
      order.note,
      now,
      now
    ).run();

    // Fulfillment
    await db.prepare(`
      INSERT INTO fulfillments(
        id, order_id, fulfillment_type, pickup_at, ship_date, recipient_name, recipient_phone,
        postal_code, road_addr, road_addr_reference, jibun_addr, detail_addr, status,
        customer_arrived, note, created_at, updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'scheduled',false,?,?,?)
      ON CONFLICT DO NOTHING
    `).bind(
      fulfillmentId,
      realOrderId,
      order.fulfillmentType,
      pickupAt,
      shipDate,
      order.recipientName || null,
      order.recipientPhone || null,
      null,
      order.roadAddr || null,
      null,
      null,
      order.detailAddr || null,
      order.note,
      now,
      now
    ).run();

    // Fulfillment item
    await db.prepare(`
      INSERT INTO fulfillment_items(id, fulfillment_id, order_item_id, quantity, created_at)
      VALUES(?,?,?,?,?)
      ON CONFLICT DO NOTHING
    `).bind(crypto.randomUUID(), fulfillmentId, orderItemId, order.quantity, now).run();

    // Work item event
    await db.prepare(`
      INSERT INTO work_item_events(
        id, work_item_id, order_id, event_type, from_value, to_value, actor, created_at
      ) VALUES(?,?,?,'work_item_created',NULL,?,'legacy_import',?)
    `).bind(
      crypto.randomUUID(),
      orderItemId,
      realOrderId,
      JSON.stringify({ source: "legacy_csv", orderNo: order.orderNo }),
      now
    ).run();

    importedCount++;
    console.log(`[${importedCount}/${orders.length}] Imported ${order.orderNo} (${order.buyerName}, ${order.scheduleDate}, ${order.productName})`);
  }

  console.log(`Successfully imported ${importedCount} orders!`);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

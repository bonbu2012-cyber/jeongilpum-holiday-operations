import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vpyedzjycmphoutztxnr.supabase.co").replace(/^\uFEFF/, "").trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweWVkemp5Y21waG91dHp0eG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY4NjgsImV4cCI6MjA5OTExMjg2OH0.u0iUtRnlIUoi8nzrYH1xMLSWIk5f1xGxJ_--pCX9Qo0").replace(/^\uFEFF/, "").trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey).replace(/^\uFEFF/, "").trim();

const client = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 운영 테이블 목록 (읽기 전용 백업 대상)
const OPERATIONAL_TABLES = [
  "orders",
  "order_items",
  "order_item_customizations",
  "fulfillments",
  "fulfillment_items",
  "payments",
  "order_credit_terms",
  "customer_accounts",
  "order_customer_accounts",
  "customer_ledger_transactions",
  "customer_ledger_consultations",
  "customer_ledger_consultation_orders",
  "customer_ledger_events",
  "work_items",
  "work_item_events",
  "product_daily_reservations",
  "order_events",
  "packages",
  "package_skin_packs",
  "package_labels",
  "package_assignment_history",
  "skin_packs",
  "skin_pack_labels",
  "production_batches",
  "traceability_records",
  "operational_alerts",
];

const MASTER_TABLES = [
  "categories",
  "products",
  "product_components",
  "sales_seasons",
  "product_daily_limits",
];

async function main() {
  console.log("=========================================");
  console.log("  [정일품] 안전 데이터 백업 시작 (READ-ONLY)");
  console.log("  * 원본 데이터를 절대 삭제하거나 변경하지 않습니다.");
  console.log("=========================================\n");

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupsDir = resolve(root, "backups");
  await mkdir(backupsDir, { recursive: true });

  const backupData = {
    exportedAt: now.toISOString(),
    sourceUrl: supabaseUrl,
    tables: {},
  };

  const allTables = [...OPERATIONAL_TABLES, ...MASTER_TABLES];

  console.log("[1/3] Supabase 테이블 데이터 수집 중...");
  for (const table of allTables) {
    try {
      const { data, error } = await client.from(table).select("*");
      if (error) {
        // 테이블이 존재하지 않거나 권한이 없는 경우 경고만 표시
        backupData.tables[table] = [];
      } else {
        backupData.tables[table] = data || [];
        if ((data || []).length > 0) {
          console.log(`  ✓ ${table}: ${data.length}건`);
        }
      }
    } catch (e) {
      console.warn(`  ! ${table} 조회 실패:`, e.message);
      backupData.tables[table] = [];
    }
  }

  // 1. JSON 파일 저장
  console.log("\n[2/3] JSON 원본 백업 파일 생성 중...");
  const jsonFilename = `orders_backup_${dateStr}.json`;
  const jsonPath = resolve(backupsDir, jsonFilename);
  await writeFile(jsonPath, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`  ✓ JSON 저장 완료: backups/${jsonFilename}`);

  // 2. 엑셀(XLSX) 요약 파일 생성
  console.log("\n[3/3] 실무용 엑셀(XLSX) 백업 파일 생성 중...");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "정일품 운영시스템";
  workbook.created = now;

  // 시트 1: 주문 목록
  const orders = backupData.tables["orders"] || [];
  const fulfillments = backupData.tables["fulfillments"] || [];
  const orderItems = backupData.tables["order_items"] || [];
  const workItems = backupData.tables["work_items"] || [];

  const fulfillmentMap = new Map();
  for (const f of fulfillments) {
    fulfillmentMap.set(f.order_id, f);
  }

  const itemsMap = new Map();
  for (const item of orderItems) {
    if (!itemsMap.has(item.order_id)) {
      itemsMap.set(item.order_id, []);
    }
    itemsMap.get(item.order_id).push(item);
  }

  const workItemMap = new Map();
  for (const w of workItems) {
    workItemMap.set(w.order_id, w);
  }

  const orderSheet = workbook.addWorksheet("주문 목록");
  orderSheet.columns = [
    { header: "주문번호", key: "order_number", width: 18 },
    { header: "주문일시", key: "created_at", width: 22 },
    { header: "주문자명", key: "customer_name", width: 14 },
    { header: "연락처", key: "customer_phone", width: 16 },
    { header: "수령방법", key: "fulfillment_type", width: 12 },
    { header: "수령/발송일시", key: "schedule", width: 22 },
    { header: "수령인", key: "recipient_name", width: 14 },
    { header: "수령인 연락처", key: "recipient_phone", width: 16 },
    { header: "배송지 주소", key: "address", width: 35 },
    { header: "상세주소", key: "address_detail", width: 20 },
    { header: "주문금액(원)", key: "total_amount", width: 15 },
    { header: "결제상태", key: "payment_status", width: 12 },
    { header: "주문상태", key: "order_status", width: 12 },
    { header: "작업상태", key: "work_status", width: 12 },
    { header: "품목 요약", key: "items_summary", width: 35 },
    { header: "주문메모", key: "memo", width: 25 },
  ];

  orderSheet.getRow(1).font = { bold: true };
  orderSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFEFEF" },
  };

  for (const o of orders) {
    const f = fulfillmentMap.get(o.id);
    const w = workItemMap.get(o.id);
    const items = itemsMap.get(o.id) || [];
    const itemsSummary = items
      .map((it) => `${it.product_name_snapshot || "상품"} (${it.quantity}개)`)
      .join(", ");

    let schedule = "";
    if (f) {
      if (f.fulfillment_type === "pickup") {
        schedule = f.pickup_at ? f.pickup_at.replace("T", " ").slice(0, 16) : "미지정";
      } else if (f.fulfillment_type === "shipping") {
        schedule = f.ship_date ? `${f.ship_date} 발송` : "미지정";
      }
    }

    orderSheet.addRow({
      order_number: o.order_number,
      created_at: o.created_at ? o.created_at.replace("T", " ").slice(0, 19) : "",
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      fulfillment_type: o.fulfillment_type === "pickup" ? "방문수령" : o.fulfillment_type === "shipping" ? "택배배송" : (o.fulfillment_type || "기타"),
      schedule: schedule,
      recipient_name: f?.recipient_name || o.customer_name,
      recipient_phone: f?.recipient_phone || o.customer_phone,
      address: f?.address || "",
      address_detail: f?.address_detail || "",
      total_amount: Number(o.total_amount) || 0,
      payment_status: o.payment_status || "unpaid",
      order_status: o.order_status || "submitted",
      work_status: w?.status || "pending",
      items_summary: itemsSummary,
      memo: o.order_notes || "",
    });
  }

  // 시트 2: 주문 품목 상세
  const itemsSheet = workbook.addWorksheet("주문 품목 상세");
  itemsSheet.columns = [
    { header: "주문번호", key: "order_number", width: 18 },
    { header: "주문자명", key: "customer_name", width: 14 },
    { header: "상품명", key: "product_name", width: 28 },
    { header: "수량", key: "quantity", width: 10 },
    { header: "단가(원)", key: "unit_price", width: 14 },
    { header: "합계금액(원)", key: "total_price", width: 15 },
  ];
  itemsSheet.getRow(1).font = { bold: true };
  itemsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFEFEF" },
  };

  const orderNumberMap = new Map();
  for (const o of orders) {
    orderNumberMap.set(o.id, { number: o.order_number, name: o.customer_name });
  }

  for (const it of orderItems) {
    const oInfo = orderNumberMap.get(it.order_id) || { number: "알수없음", name: "" };
    itemsSheet.addRow({
      order_number: oInfo.number,
      customer_name: oInfo.name,
      product_name: it.product_name_snapshot,
      quantity: it.quantity,
      unit_price: Number(it.unit_price_snapshot) || 0,
      total_price: Number(it.line_total) || ((Number(it.unit_price_snapshot) || 0) * it.quantity),
    });
  }

  // 시트 3: 고객 계정 장부
  const customerAccounts = backupData.tables["customer_accounts"] || [];
  if (customerAccounts.length > 0) {
    const custSheet = workbook.addWorksheet("고객 장부");
    custSheet.columns = [
      { header: "고객명", key: "name", width: 15 },
      { header: "전화번호", key: "phone", width: 18 },
      { header: "고객구분", key: "type", width: 12 },
      { header: "미수 잔액(원)", key: "credit_balance", width: 16 },
      { header: "선수금 잔액(원)", key: "prepayment_balance", width: 16 },
      { header: "등록일", key: "created_at", width: 20 },
    ];
    custSheet.getRow(1).font = { bold: true };
    custSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFEFEF" },
    };

    for (const c of customerAccounts) {
      custSheet.addRow({
        name: c.customer_name,
        phone: c.customer_phone,
        type: c.account_type || "individual",
        credit_balance: Number(c.credit_balance) || 0,
        prepayment_balance: Number(c.prepayment_balance) || 0,
        created_at: c.created_at ? c.created_at.replace("T", " ").slice(0, 19) : "",
      });
    }
  }

  const xlsxFilename = `orders_summary_${dateStr}.xlsx`;
  const xlsxPath = resolve(backupsDir, xlsxFilename);
  await workbook.xlsx.writeFile(xlsxPath);
  console.log(`  ✓ Excel 저장 완료: backups/${xlsxFilename}`);

  console.log("\n=========================================");
  console.log("  [성공] 백업이 안전하게 완료되었습니다!");
  console.log(`  - JSON 전체 원본: backups/${jsonFilename}`);
  console.log(`  - Excel 실무 요약: backups/${xlsxFilename}`);
  console.log("=========================================\n");
}

main().catch((err) => {
  console.error("\n[오류] 백업 중 문제가 발생했습니다:", err);
  process.exit(1);
});

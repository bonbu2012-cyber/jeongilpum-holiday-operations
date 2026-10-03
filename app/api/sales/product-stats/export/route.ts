import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDb } from "../../../../../db";
import { requireOperatorApi } from "../../../../lib/operator-session";
import { resolveProductSummaryMeta } from "../../../../lib/workshop-packing-slip";

type WorkItemRow = {
  product_id: string;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
  customization_json: string | null;
  payment_status: string;
  order_paid_amount: number;
  order_total_amount: number;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_note: string;
  fulfillment_type: string;
  due_at: string;
  due_date: string;
  reception_date: string;
  submitted_at: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  postal_code: string | null;
  road_addr: string | null;
  detail_addr: string | null;
  work_item_note: string;
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

const categoryOrderMap: Record<string, number> = {
  "프리미엄": 1,
  "O'meat": 2,
  "진공세트": 3,
  "LA갈비": 4,
  "뼈세트": 5,
  "맞춤주문": 6,
};

const dayNameList = ["일", "월", "화", "수", "목", "금", "토"];

function getDayOfWeek(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayIndex = new Date(y, m - 1, d).getDay();
  return dayNameList[dayIndex] || "";
}

function formatFulfillmentMethod(method?: string | null): string {
  if (!method) return "기타";
  const lower = method.toLowerCase();
  if (lower.includes("pickup") || lower.includes("onsite_sale") || lower.includes("onsite_reservation") || lower.includes("현장") || lower.includes("방문")) {
    return "방문수령";
  }
  if (lower.includes("delivery") || lower.includes("shipping") || lower.includes("택배")) {
    return "택배배송";
  }
  return method;
}

function formatPaymentStatus(status?: string | null): string {
  if (status === "paid") return "결제완료";
  if (status === "unpaid") return "미결제";
  if (status === "refunded") return "환불완료";
  return status || "미결제";
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireOperatorApi();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const today = todayInSeoul();
  const startDate = searchParams.get("startDate")?.trim() || today;
  const endDate = searchParams.get("endDate")?.trim() || startDate;
  const dateType = searchParams.get("dateType")?.trim() === "reception" ? "reception" : "due";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json({ error: "날짜 형식은 YYYY-MM-DD여야 합니다." }, { status: 400 });
  }

  const dateCol = dateType === "reception" ? "substr(o.submitted_at, 1, 10)" : "substr(w.due_at, 1, 10)";
  const exportQuery = `
    SELECT
      w.product_id,
      w.product_name_snapshot,
      w.unit_price_snapshot,
      w.quantity,
      w.line_total,
      w.customization_json,
      o.payment_status,
      o.paid_amount AS order_paid_amount,
      o.total_amount AS order_total_amount,
      w.order_id,
      o.order_number,
      o.buyer_name_snapshot AS customer_name,
      o.buyer_phone_snapshot AS customer_phone,
      o.customer_note,
      w.delivery_method AS fulfillment_type,
      w.due_at,
      substr(w.due_at, 1, 10) AS due_date,
      substr(o.submitted_at, 1, 10) AS reception_date,
      substr(o.submitted_at, 1, 16) AS submitted_at,
      w.recipient_name,
      w.recipient_phone,
      w.postal_code,
      w.road_addr,
      w.detail_addr,
      w.note AS work_item_note
    FROM work_items w
    JOIN orders o ON o.id = w.order_id
    WHERE ${dateCol} >= ?
      AND ${dateCol} <= ?
      AND w.work_status != 'cancelled'
      AND o.order_status != 'cancelled'
    ORDER BY ${dateCol} ASC, o.submitted_at ASC, w.created_at ASC
  `;

  const db = getDb();
  let rows: WorkItemRow[] = [];

  try {
    const result = await db.prepare(exportQuery).bind(startDate, endDate).all();
    rows = (result.results || []) as WorkItemRow[];
  } catch (err) {
    console.error("[product-stats-export] Query error:", err);
    return NextResponse.json({ error: "판매 통계 데이터를 조회하지 못했습니다." }, { status: 500 });
  }

  // 데이터 집계
  type AggregatedProduct = {
    key: string;
    category: string;
    categoryOrder: number;
    displayName: string;
    unitPrice: number;
    totalQuantity: number;
    totalAmount: number;
    sharePercent: number;
    customDetails: string[];
  };

  const productMap = new Map<string, AggregatedProduct>();
  const orderPayments = new Map<string, { paymentStatus: string; paidAmount: number; totalAmount: number }>();
  let grandTotalQty = 0;
  let grandTotalAmount = 0;

  for (const row of rows) {
    if (!orderPayments.has(row.order_id)) {
      orderPayments.set(row.order_id, {
        paymentStatus: row.payment_status,
        paidAmount: Number(row.order_paid_amount) || 0,
        totalAmount: Number(row.order_total_amount) || 0,
      });
    }

    const qty = Number(row.quantity) || 0;
    const unitPrice = Number(row.unit_price_snapshot) || 0;
    const lineTotal = unitPrice * qty;

    grandTotalQty += qty;
    grandTotalAmount += lineTotal;

    const meta = resolveProductSummaryMeta({
      productId: row.product_id,
      productName: row.product_name_snapshot,
      unitPrice,
    });

    const isCustom = row.product_id === "custom-order" || /맞춤/.test(row.product_name_snapshot);
    const aggKey = isCustom ? `custom-${row.product_name_snapshot}-${unitPrice}` : meta.key;

    if (!productMap.has(aggKey)) {
      productMap.set(aggKey, {
        key: aggKey,
        category: isCustom ? "맞춤주문" : meta.category,
        categoryOrder: isCustom ? 99 : meta.categoryOrder,
        displayName: isCustom ? row.product_name_snapshot : meta.name,
        unitPrice,
        totalQuantity: 0,
        totalAmount: 0,
        sharePercent: 0,
        customDetails: [],
      });
    }

    const target = productMap.get(aggKey)!;
    target.totalQuantity += qty;
    target.totalAmount += lineTotal;
    if (row.customization_json?.trim()) {
      target.customDetails.push(row.customization_json.trim());
    }
  }

  let paidOrders = 0;
  let paidAmount = 0;
  let unpaidOrders = 0;
  let unpaidAmount = 0;

  for (const order of orderPayments.values()) {
    if (order.paymentStatus === "paid") {
      paidOrders += 1;
      paidAmount += order.paidAmount || order.totalAmount;
    } else {
      unpaidOrders += 1;
      unpaidAmount += Math.max(0, order.totalAmount - order.paidAmount);
      if (order.paidAmount > 0) {
        paidAmount += order.paidAmount;
      }
    }
  }

  const soldProducts = Array.from(productMap.values())
    .filter((p) => p.totalQuantity > 0)
    .map((p) => ({
      ...p,
      sharePercent: grandTotalQty > 0 ? (p.totalQuantity / grandTotalQty) : 0,
    }));

  const categoriesMap = new Map<string, {
    categoryName: string;
    categoryOrder: number;
    totalQuantity: number;
    totalAmount: number;
    products: AggregatedProduct[];
  }>();

  for (const p of soldProducts) {
    const catName = p.category;
    const catOrder = categoryOrderMap[catName] || 99;

    if (!categoriesMap.has(catName)) {
      categoriesMap.set(catName, {
        categoryName: catName,
        categoryOrder: catOrder,
        totalQuantity: 0,
        totalAmount: 0,
        products: [],
      });
    }

    const cat = categoriesMap.get(catName)!;
    cat.totalQuantity += p.totalQuantity;
    cat.totalAmount += p.totalAmount;
    cat.products.push(p);
  }

  const categories = Array.from(categoriesMap.values())
    .sort((a, b) => a.categoryOrder - b.categoryOrder)
    .map((cat) => ({
      ...cat,
      products: cat.products.sort((a, b) => b.unitPrice - a.unitPrice || b.totalQuantity - a.totalQuantity),
    }));

  // 일자별 그룹핑
  const rowsByDate = new Map<string, WorkItemRow[]>();
  for (const row of rows) {
    const rowDate = dateType === "reception" ? row.reception_date : row.due_date;
    const safeDate = rowDate && /^\d{4}-\d{2}-\d{2}$/.test(rowDate) ? rowDate : "날짜미지정";
    if (!rowsByDate.has(safeDate)) {
      rowsByDate.set(safeDate, []);
    }
    rowsByDate.get(safeDate)!.push(row);
  }

  const sortedDates = Array.from(rowsByDate.keys()).sort((a, b) => a.localeCompare(b));

  // ExcelJS 워크북 생성
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "정일품 한우 정육식당";
  workbook.created = new Date();

  const dateCriteriaLabel = dateType === "reception" ? "주문 접수일 기준" : "수령·발송 예정일 기준";
  const dateRangeLabel = startDate === endDate ? `${startDate} (하루)` : `${startDate} ~ ${endDate}`;

  // ==========================================
  // 시트 1: 종합_상품별통계
  // ==========================================
  const sheet1 = workbook.addWorksheet("종합_상품별통계");
  sheet1.views = [{ showGridLines: true }];

  // 타이틀
  sheet1.mergeCells("A1:G1");
  const titleCell = sheet1.getCell("A1");
  titleCell.value = "정일품 명절 선물세트 판매 실적 종합 보고서";
  titleCell.font = { name: "Malgun Gothic", size: 16, bold: true, color: { argb: "FF1E293B" } };
  titleCell.alignment = { vertical: "middle" };
  sheet1.getRow(1).height = 32;

  // 부제목 (메타 정보)
  sheet1.mergeCells("A2:G2");
  const subTitleCell = sheet1.getCell("A2");
  subTitleCell.value = `조회 기간: ${dateRangeLabel}  |  집계 기준: ${dateCriteriaLabel}  |  보고서 생성일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`;
  subTitleCell.font = { name: "Malgun Gothic", size: 10, color: { argb: "FF64748B" } };
  sheet1.getRow(2).height = 20;

  // 요약 KPI 블록
  sheet1.mergeCells("A4:B4");
  sheet1.getCell("A4").value = "총 판매 수량";
  sheet1.getCell("A4").font = { name: "Malgun Gothic", size: 9, color: { argb: "FF64748B" } };
  sheet1.mergeCells("A5:B5");
  sheet1.getCell("A5").value = `${grandTotalQty.toLocaleString()} 세트`;
  sheet1.getCell("A5").font = { name: "Malgun Gothic", size: 14, bold: true, color: { argb: "FF0F172A" } };

  sheet1.mergeCells("C4:D4");
  sheet1.getCell("C4").value = "총 판매 금액 (결제무관)";
  sheet1.getCell("C4").font = { name: "Malgun Gothic", size: 9, color: { argb: "FF64748B" } };
  sheet1.mergeCells("C5:D5");
  sheet1.getCell("C5").value = grandTotalAmount;
  sheet1.getCell("C5").numFmt = '#,##0"원"';
  sheet1.getCell("C5").font = { name: "Malgun Gothic", size: 14, bold: true, color: { argb: "FF1E3A8A" } };

  sheet1.getCell("E4").value = "총 주문 건수";
  sheet1.getCell("E4").font = { name: "Malgun Gothic", size: 9, color: { argb: "FF64748B" } };
  sheet1.getCell("E5").value = `${orderPayments.size.toLocaleString()} 건`;
  sheet1.getCell("E5").font = { name: "Malgun Gothic", size: 14, bold: true };

  sheet1.mergeCells("F4:G4");
  sheet1.getCell("F4").value = "결제 현황";
  sheet1.getCell("F4").font = { name: "Malgun Gothic", size: 9, color: { argb: "FF64748B" } };
  sheet1.mergeCells("F5:G5");
  sheet1.getCell("F5").value = `완료 ${paidOrders}건 (${paidAmount.toLocaleString()}원) / 미결제 ${unpaidOrders}건 (${unpaidAmount.toLocaleString()}원)`;
  sheet1.getCell("F5").font = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FF475569" } };

  // 요약 블록 테두리 및 배경
  for (let r = 4; r <= 5; r++) {
    for (let c = 1; c <= 7; c++) {
      const cell = sheet1.getRow(r).getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    }
  }

  // 테이블 헤더 (7행)
  const headers1 = ["카테고리", "상품명", "단가(원)", "판매수량(세트)", "수량점유율", "총 판매금액(원)", "맞춤주문 세부내용"];
  const headerRow1 = sheet1.getRow(7);
  headerRow1.height = 26;
  headers1.forEach((h, idx) => {
    const cell = headerRow1.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.alignment = { vertical: "middle", horizontal: idx >= 2 && idx <= 5 ? "right" : "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0F172A" } },
      bottom: { style: "thin", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  let currentRow1 = 8;
  for (const cat of categories) {
    for (const prod of cat.products) {
      const row = sheet1.getRow(currentRow1);
      row.height = 22;
      row.getCell(1).value = cat.categoryName;
      row.getCell(2).value = prod.displayName;
      row.getCell(3).value = prod.unitPrice;
      row.getCell(3).numFmt = "#,##0";
      row.getCell(4).value = prod.totalQuantity;
      row.getCell(4).numFmt = "#,##0";
      row.getCell(5).value = prod.sharePercent;
      row.getCell(5).numFmt = "0.0%";
      row.getCell(6).value = prod.totalAmount;
      row.getCell(6).numFmt = "#,##0";
      row.getCell(7).value = prod.customDetails.length > 0 ? prod.customDetails.join(" / ") : "";

      for (let c = 1; c <= 7; c++) {
        const cell = row.getCell(c);
        cell.font = { name: "Malgun Gothic", size: 10 };
        cell.alignment = {
          vertical: "middle",
          horizontal: c === 1 ? "center" : c === 2 || c === 7 ? "left" : "right",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      }
      currentRow1++;
    }

    // 카테고리 소계
    const catSubtotalRow = sheet1.getRow(currentRow1);
    catSubtotalRow.height = 24;
    catSubtotalRow.getCell(1).value = `[${cat.categoryName} 소계]`;
    catSubtotalRow.getCell(2).value = "";
    catSubtotalRow.getCell(3).value = "";
    catSubtotalRow.getCell(4).value = cat.totalQuantity;
    catSubtotalRow.getCell(4).numFmt = "#,##0";
    catSubtotalRow.getCell(5).value = grandTotalQty > 0 ? cat.totalQuantity / grandTotalQty : 0;
    catSubtotalRow.getCell(5).numFmt = "0.0%";
    catSubtotalRow.getCell(6).value = cat.totalAmount;
    catSubtotalRow.getCell(6).numFmt = "#,##0";
    catSubtotalRow.getCell(7).value = "";

    for (let c = 1; c <= 7; c++) {
      const cell = catSubtotalRow.getCell(c);
      cell.font = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FF334155" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 1 ? "center" : c >= 4 && c <= 6 ? "right" : "left",
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    }
    currentRow1++;
  }

  // 전체 총합계
  const grandTotalRow1 = sheet1.getRow(currentRow1);
  grandTotalRow1.height = 28;
  grandTotalRow1.getCell(1).value = "전체 총합계";
  grandTotalRow1.getCell(2).value = `${soldProducts.length}개 품목`;
  grandTotalRow1.getCell(3).value = "";
  grandTotalRow1.getCell(4).value = grandTotalQty;
  grandTotalRow1.getCell(4).numFmt = "#,##0";
  grandTotalRow1.getCell(5).value = 1;
  grandTotalRow1.getCell(5).numFmt = "0.0%";
  grandTotalRow1.getCell(6).value = grandTotalAmount;
  grandTotalRow1.getCell(6).numFmt = "#,##0";
  grandTotalRow1.getCell(7).value = "";

  for (let c = 1; c <= 7; c++) {
    const cell = grandTotalRow1.getCell(c);
    cell.font = { name: "Malgun Gothic", size: 11, bold: true, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.alignment = {
      vertical: "middle",
      horizontal: c === 1 || c === 2 ? "center" : c >= 4 && c <= 6 ? "right" : "left",
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0F172A" } },
      bottom: { style: "double", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  }

  // 열 너비 설정
  sheet1.columns = [
    { width: 14 }, // 카테고리
    { width: 24 }, // 상품명
    { width: 15 }, // 단가
    { width: 16 }, // 판매수량
    { width: 14 }, // 점유율
    { width: 18 }, // 총 판매금액
    { width: 40 }, // 맞춤내용
  ];

  // ==========================================
  // 시트 2: 일자별_판매리스트
  // ==========================================
  const sheet2 = workbook.addWorksheet("일자별_판매리스트");
  sheet2.views = [{ showGridLines: true }];

  sheet2.mergeCells("A1:H1");
  const titleCell2 = sheet2.getCell("A1");
  titleCell2.value = "정일품 일자별 판매 현황 리스트 (명절 실적 통계)";
  titleCell2.font = { name: "Malgun Gothic", size: 16, bold: true, color: { argb: "FF1E293B" } };
  titleCell2.alignment = { vertical: "middle" };
  sheet2.getRow(1).height = 32;

  sheet2.mergeCells("A2:H2");
  const subTitleCell2 = sheet2.getCell("A2");
  subTitleCell2.value = `조회 기간: ${dateRangeLabel}  |  기준: ${dateCriteriaLabel}`;
  subTitleCell2.font = { name: "Malgun Gothic", size: 10, color: { argb: "FF64748B" } };
  sheet2.getRow(2).height = 20;

  const headers2 = ["일자", "요일", "카테고리", "상품명", "단가(원)", "판매수량(세트)", "판매금액(원)", "비고/맞춤내용"];
  const headerRow2 = sheet2.getRow(4);
  headerRow2.height = 26;
  headers2.forEach((h, idx) => {
    const cell = headerRow2.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    cell.alignment = { vertical: "middle", horizontal: idx >= 4 && idx <= 6 ? "right" : "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF1E293B" } },
      bottom: { style: "thin", color: { argb: "FF1E293B" } },
      left: { style: "thin", color: { argb: "FF475569" } },
      right: { style: "thin", color: { argb: "FF475569" } },
    };
  });

  let currentRow2 = 5;

  for (const dateStr of sortedDates) {
    const dayRows = rowsByDate.get(dateStr)!;
    const dayOfWeek = getDayOfWeek(dateStr);

    // 날짜별 상품 집계
    const dayProductMap = new Map<string, {
      category: string;
      displayName: string;
      unitPrice: number;
      quantity: number;
      amount: number;
      customDetails: string[];
    }>();

    const dayOrders = new Set<string>();
    let dayTotalQty = 0;
    let dayTotalAmount = 0;

    for (const r of dayRows) {
      dayOrders.add(r.order_id);
      const qty = Number(r.quantity) || 0;
      const unitPrice = Number(r.unit_price_snapshot) || 0;
      const lineTotal = unitPrice * qty;

      dayTotalQty += qty;
      dayTotalAmount += lineTotal;

      const meta = resolveProductSummaryMeta({
        productId: r.product_id,
        productName: r.product_name_snapshot,
        unitPrice,
      });

      const isCustom = r.product_id === "custom-order" || /맞춤/.test(r.product_name_snapshot);
      const key = isCustom ? `custom-${r.product_name_snapshot}-${unitPrice}` : meta.key;

      if (!dayProductMap.has(key)) {
        dayProductMap.set(key, {
          category: isCustom ? "맞춤주문" : meta.category,
          displayName: isCustom ? r.product_name_snapshot : meta.name,
          unitPrice,
          quantity: 0,
          amount: 0,
          customDetails: [],
        });
      }

      const p = dayProductMap.get(key)!;
      p.quantity += qty;
      p.amount += lineTotal;
      if (r.customization_json?.trim()) {
        p.customDetails.push(r.customization_json.trim());
      }
    }

    const dayProducts = Array.from(dayProductMap.values()).sort((a, b) => {
      const orderA = categoryOrderMap[a.category] || 99;
      const orderB = categoryOrderMap[b.category] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return b.unitPrice - a.unitPrice;
    });

    for (const dp of dayProducts) {
      const row = sheet2.getRow(currentRow2);
      row.height = 22;
      row.getCell(1).value = dateStr;
      row.getCell(2).value = dayOfWeek ? `${dayOfWeek}요일` : "";
      row.getCell(3).value = dp.category;
      row.getCell(4).value = dp.displayName;
      row.getCell(5).value = dp.unitPrice;
      row.getCell(5).numFmt = "#,##0";
      row.getCell(6).value = dp.quantity;
      row.getCell(6).numFmt = "#,##0";
      row.getCell(7).value = dp.amount;
      row.getCell(7).numFmt = "#,##0";
      row.getCell(8).value = dp.customDetails.length > 0 ? dp.customDetails.join(" / ") : "";

      for (let c = 1; c <= 8; c++) {
        const cell = row.getCell(c);
        cell.font = { name: "Malgun Gothic", size: 10 };
        cell.alignment = {
          vertical: "middle",
          horizontal: c === 1 || c === 2 || c === 3 ? "center" : c === 4 || c === 8 ? "left" : "right",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      }
      currentRow2++;
    }

    // 날짜 소계 행
    const subtotalRow = sheet2.getRow(currentRow2);
    subtotalRow.height = 24;
    subtotalRow.getCell(1).value = `[${dateStr} (${dayOfWeek}) 소계]`;
    subtotalRow.getCell(2).value = "";
    subtotalRow.getCell(3).value = "";
    subtotalRow.getCell(4).value = `주문 ${dayOrders.size}건`;
    subtotalRow.getCell(5).value = "";
    subtotalRow.getCell(6).value = dayTotalQty;
    subtotalRow.getCell(6).numFmt = "#,##0";
    subtotalRow.getCell(7).value = dayTotalAmount;
    subtotalRow.getCell(7).numFmt = "#,##0";
    subtotalRow.getCell(8).value = "";

    for (let c = 1; c <= 8; c++) {
      const cell = subtotalRow.getCell(c);
      cell.font = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FF1E293B" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 1 ? "center" : c === 4 ? "center" : c >= 6 && c <= 7 ? "right" : "left",
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "thin", color: { argb: "FF94A3B8" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    }
    currentRow2++;
  }

  // 기간 전체 합계 행
  const grandTotalRow2 = sheet2.getRow(currentRow2);
  grandTotalRow2.height = 28;
  grandTotalRow2.getCell(1).value = "기간 전체 합계";
  grandTotalRow2.getCell(2).value = `${sortedDates.length}일간`;
  grandTotalRow2.getCell(3).value = "";
  grandTotalRow2.getCell(4).value = `총 주문 ${orderPayments.size}건`;
  grandTotalRow2.getCell(5).value = "";
  grandTotalRow2.getCell(6).value = grandTotalQty;
  grandTotalRow2.getCell(6).numFmt = "#,##0";
  grandTotalRow2.getCell(7).value = grandTotalAmount;
  grandTotalRow2.getCell(7).numFmt = "#,##0";
  grandTotalRow2.getCell(8).value = "";

  for (let c = 1; c <= 8; c++) {
    const cell = grandTotalRow2.getCell(c);
    cell.font = { name: "Malgun Gothic", size: 11, bold: true, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    cell.alignment = {
      vertical: "middle",
      horizontal: c === 1 || c === 2 || c === 4 ? "center" : c >= 6 && c <= 7 ? "right" : "left",
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FFD97706" } },
      bottom: { style: "double", color: { argb: "FFD97706" } },
      left: { style: "thin", color: { argb: "FFFCD34D" } },
      right: { style: "thin", color: { argb: "FFFCD34D" } },
    };
  }

  sheet2.columns = [
    { width: 14 }, // 일자
    { width: 10 }, // 요일
    { width: 14 }, // 카테고리
    { width: 24 }, // 상품명
    { width: 15 }, // 단가
    { width: 16 }, // 판매수량
    { width: 18 }, // 판매금액
    { width: 35 }, // 비고
  ];

  // ==========================================
  // 시트 3: 주문_상세내역
  // ==========================================
  const sheet3 = workbook.addWorksheet("주문_상세내역");
  sheet3.views = [{ showGridLines: true }];

  sheet3.mergeCells("A1:R1");
  const titleCell3 = sheet3.getCell("A1");
  titleCell3.value = "정일품 주문별 접수 및 출고 상세 내역 (차기 명절 준비 참고용)";
  titleCell3.font = { name: "Malgun Gothic", size: 16, bold: true, color: { argb: "FF1E293B" } };
  titleCell3.alignment = { vertical: "middle" };
  sheet3.getRow(1).height = 32;

  sheet3.mergeCells("A2:R2");
  const subTitleCell3 = sheet3.getCell("A2");
  subTitleCell3.value = `조회 기간: ${dateRangeLabel}  |  기준: ${dateCriteriaLabel}  |  총 주문 건수: ${orderPayments.size}건  |  총 상품 수량: ${grandTotalQty}세트`;
  subTitleCell3.font = { name: "Malgun Gothic", size: 10, color: { argb: "FF64748B" } };
  sheet3.getRow(2).height = 20;

  const headers3 = [
    "기준일자",
    "접수일시",
    "주문번호",
    "주문자명",
    "주문자연락처",
    "수령방법",
    "수령·발송예정일시",
    "받는사람",
    "받는사람연락처",
    "우편번호",
    "배송주소",
    "상품명",
    "단가(원)",
    "수량",
    "품목금액(원)",
    "결제상태",
    "고객요청메모",
    "맞춤구성/작업메모",
  ];

  const headerRow3 = sheet3.getRow(4);
  headerRow3.height = 26;
  headers3.forEach((h, idx) => {
    const cell = headerRow3.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { vertical: "middle", horizontal: idx >= 12 && idx <= 14 ? "right" : "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  let currentRow3 = 5;
  for (const r of rows) {
    const row = sheet3.getRow(currentRow3);
    row.height = 20;

    const baseDate = dateType === "reception" ? r.reception_date : r.due_date;
    const fullAddress = [r.road_addr, r.detail_addr].filter(Boolean).join(" ");
    const memoNotes = [r.customization_json, r.work_item_note].filter(Boolean).join(" / ");
    const qty = Number(r.quantity) || 0;
    const unitPrice = Number(r.unit_price_snapshot) || 0;
    const lineTotal = Number(r.line_total) || (unitPrice * qty);

    row.getCell(1).value = baseDate || "";
    row.getCell(2).value = r.submitted_at ? r.submitted_at.replace("T", " ") : "";
    row.getCell(3).value = r.order_number || "";
    row.getCell(4).value = r.customer_name || "";
    row.getCell(5).value = r.customer_phone || "";
    row.getCell(6).value = formatFulfillmentMethod(r.fulfillment_type);
    row.getCell(7).value = r.due_at ? r.due_at.replace("T", " ") : "";
    row.getCell(8).value = r.recipient_name || r.customer_name || "";
    row.getCell(9).value = r.recipient_phone || r.customer_phone || "";
    row.getCell(10).value = r.postal_code || "";
    row.getCell(11).value = fullAddress;
    row.getCell(12).value = r.product_name_snapshot || "";
    row.getCell(13).value = unitPrice;
    row.getCell(13).numFmt = "#,##0";
    row.getCell(14).value = qty;
    row.getCell(14).numFmt = "#,##0";
    row.getCell(15).value = lineTotal;
    row.getCell(15).numFmt = "#,##0";
    row.getCell(16).value = formatPaymentStatus(r.payment_status);
    row.getCell(17).value = r.customer_note || "";
    row.getCell(18).value = memoNotes;

    for (let c = 1; c <= 18; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Malgun Gothic", size: 9 };
      cell.alignment = {
        vertical: "middle",
        horizontal: c >= 13 && c <= 15 ? "right" : [1, 2, 3, 5, 6, 7, 9, 10, 16].includes(c) ? "center" : "left",
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    }
    currentRow3++;
  }

  sheet3.columns = [
    { width: 13 }, // 기준일자
    { width: 17 }, // 접수일시
    { width: 18 }, // 주문번호
    { width: 12 }, // 주문자명
    { width: 15 }, // 연락처
    { width: 12 }, // 수령방법
    { width: 17 }, // 수령일시
    { width: 12 }, // 받는사람
    { width: 15 }, // 받는사람연락처
    { width: 10 }, // 우편번호
    { width: 35 }, // 배송주소
    { width: 22 }, // 상품명
    { width: 13 }, // 단가
    { width: 8 },  // 수량
    { width: 14 }, // 품목금액
    { width: 11 }, // 결제상태
    { width: 25 }, // 고객메모
    { width: 30 }, // 맞춤구성/작업메모
  ];

  // 엑셀 파일 버퍼 쓰기
  const buffer = await workbook.xlsx.writeBuffer();
  const fileDateStr = startDate === endDate ? startDate : `${startDate}_${endDate}`;
  const filename = `정일품_판매통계_일자별리스트_${fileDateStr}.xlsx`;
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
    },
  });
}

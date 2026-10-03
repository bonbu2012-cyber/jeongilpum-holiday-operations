import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { requireOperatorApi } from "../../../lib/operator-session";
import { resolveProductSummaryMeta } from "../../../lib/workshop-packing-slip";

type WorkItemStatRow = {
  product_id: string;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  customization_json: string | null;
  payment_status: string;
  order_paid_amount: number;
  order_total_amount: number;
  order_id: string;
  due_date: string;
  reception_date: string;
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
  const statsQuery = `
    SELECT
      w.product_id,
      w.product_name_snapshot,
      w.unit_price_snapshot,
      w.quantity,
      w.customization_json,
      o.payment_status,
      o.paid_amount AS order_paid_amount,
      o.total_amount AS order_total_amount,
      w.order_id,
      substr(w.due_at, 1, 10) AS due_date,
      substr(o.submitted_at, 1, 10) AS reception_date
    FROM work_items w
    JOIN orders o ON o.id = w.order_id
    WHERE ${dateCol} >= ?
      AND ${dateCol} <= ?
      AND w.work_status != 'cancelled'
      AND o.order_status != 'cancelled'
    ORDER BY ${dateCol} ASC, w.created_at ASC
  `;

  const db = getDb();
  let rows: WorkItemStatRow[] = [];

  try {
    const result = await db.prepare(statsQuery).bind(startDate, endDate).all();
    rows = (result.results || []) as WorkItemStatRow[];
  } catch (err) {
    console.error("[product-stats] Query error:", err);
    return NextResponse.json({ error: "상품 판매 통계를 조회하지 못했습니다." }, { status: 500 });
  }

  // 카테고리별 정렬 순서 정의
  const categoryOrderMap: Record<string, number> = {
    "프리미엄": 1,
    "O'meat": 2,
    "진공세트": 3,
    "LA갈비": 4,
    "뼈세트": 5,
    "맞춤주문": 6,
  };

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

  type CategoryStat = {
    categoryName: string;
    categoryOrder: number;
    totalQuantity: number;
    totalAmount: number;
    products: AggregatedProduct[];
  };

  function processRows(rowList: WorkItemStatRow[], referenceTotalQty?: number) {
    const productMap = new Map<string, AggregatedProduct>();
    const orderPayments = new Map<string, { paymentStatus: string; paidAmount: number; totalAmount: number }>();
    let grandTotalQty = 0;
    let grandTotalAmount = 0;

    for (const row of rowList) {
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

    const baseQty = referenceTotalQty ?? grandTotalQty;
    const soldProducts = Array.from(productMap.values())
      .filter((p) => p.totalQuantity > 0)
      .map((p) => ({
        ...p,
        sharePercent: baseQty > 0 ? Math.round((p.totalQuantity / baseQty) * 100) : 0,
      }));

    const categoriesMap = new Map<string, CategoryStat>();
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

    return {
      orderCount: orderPayments.size,
      productKinds: soldProducts.length,
      totalQuantity: grandTotalQty,
      totalAmount: grandTotalAmount,
      paidOrders,
      paidAmount,
      unpaidOrders,
      unpaidAmount,
      soldProducts,
      categories,
    };
  }

  // 1. 전체 기간 종합 집계
  const overall = processRows(rows);

  // 2. 일자별 그룹핑 및 집계
  const dayNameList = ["일", "월", "화", "수", "목", "금", "토"];
  const rowsByDate = new Map<string, WorkItemStatRow[]>();

  for (const row of rows) {
    const rowDate = dateType === "reception" ? row.reception_date : row.due_date;
    const safeDate = rowDate && /^\d{4}-\d{2}-\d{2}$/.test(rowDate) ? rowDate : "날짜미지정";
    if (!rowsByDate.has(safeDate)) {
      rowsByDate.set(safeDate, []);
    }
    rowsByDate.get(safeDate)!.push(row);
  }

  // 날짜 오름차순 정렬
  const sortedDates = Array.from(rowsByDate.keys()).sort((a, b) => a.localeCompare(b));
  const dailyList = sortedDates.map((dateStr) => {
    const dayRows = rowsByDate.get(dateStr)!;
    const dayAgg = processRows(dayRows);

    let dayOfWeek = "";
    if (dateStr !== "날짜미지정") {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dayIndex = new Date(y, m - 1, d).getDay();
      dayOfWeek = dayNameList[dayIndex] || "";
    }

    return {
      date: dateStr,
      dayOfWeek,
      totalOrders: dayAgg.orderCount,
      totalProductKinds: dayAgg.productKinds,
      totalQuantity: dayAgg.totalQuantity,
      totalAmount: dayAgg.totalAmount,
      paidOrders: dayAgg.paidOrders,
      paidAmount: dayAgg.paidAmount,
      unpaidOrders: dayAgg.unpaidOrders,
      unpaidAmount: dayAgg.unpaidAmount,
      categories: dayAgg.categories,
      products: dayAgg.soldProducts,
    };
  });

  return NextResponse.json({
    startDate,
    endDate,
    dateType,
    isSingleDay: startDate === endDate,
    summary: {
      totalOrders: overall.orderCount,
      totalProductKinds: overall.productKinds,
      totalQuantity: overall.totalQuantity,
      totalAmount: overall.totalAmount,
      paymentBreakdown: {
        paidOrders: overall.paidOrders,
        paidAmount: overall.paidAmount,
        unpaidOrders: overall.unpaidOrders,
        unpaidAmount: overall.unpaidAmount,
      },
    },
    categories: overall.categories,
    dailyList,
  });
}

import assert from "node:assert/strict";
import test from "node:test";
import { resolveProductSummaryMeta } from "../app/lib/workshop-packing-slip.ts";

test("resolveProductSummaryMeta maps products to correct lineups and sets correct sort order", () => {
  const jin = resolveProductSummaryMeta({ productId: "jin", productName: "진" });
  assert.equal(jin.category, "프리미엄");
  assert.equal(jin.name, "프리미엄 진");
  assert.equal(jin.categoryOrder, 1);
  assert.equal(jin.price, 320000);

  const omeat = resolveProductSummaryMeta({ productId: "omeat-prestige", productName: "오미트 프레스티지" });
  assert.equal(omeat.category, "O'meat");
  assert.equal(omeat.categoryOrder, 2);
  assert.equal(omeat.price, 389000);

  const palyeong = resolveProductSummaryMeta({ productId: "palyeong", productName: "팔영세트" });
  assert.equal(palyeong.category, "진공세트");
  assert.equal(palyeong.categoryOrder, 3);
  assert.equal(palyeong.price, 300000);

  const la = resolveProductSummaryMeta({ productId: "la-2", productName: "LA갈비 2호" });
  assert.equal(la.category, "LA갈비");
  assert.equal(la.categoryOrder, 4);

  const bone = resolveProductSummaryMeta({ productId: "bone-1", productName: "사골×우족" });
  assert.equal(bone.category, "뼈세트");
  assert.equal(bone.categoryOrder, 5);
});

test("stats API source file exists and verifies parameter validation, column names, and zero-quantity filtering", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/api/sales/product-stats/route.ts", import.meta.url), "utf8");

  assert.match(source, /startDate/);
  assert.match(source, /endDate/);
  assert.match(source, /dateType/);
  assert.match(source, /o\.order_status != 'cancelled'/);
  assert.match(source, /filter\(\(p\) => p\.totalQuantity > 0\)/);
  assert.match(source, /categoryOrderMap/);
  assert.match(source, /requireOperatorApi/);
  assert.match(source, /grandTotalQty/);
  assert.match(source, /grandTotalAmount/);
  assert.match(source, /paymentBreakdown/);
  assert.match(source, /dailyList/);
  assert.match(source, /dayOfWeek/);
  assert.match(source, /sortedDates/);
});

test("stats export API route exists and verifies ExcelJS workbook with 3 worksheets, styling, and operator auth", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/api/sales/product-stats/export/route.ts", import.meta.url), "utf8");

  assert.match(source, /requireOperatorApi/);
  assert.match(source, /ExcelJS\.Workbook/);
  assert.match(source, /workbook\.addWorksheet\("종합_상품별통계"\)/);
  assert.match(source, /workbook\.addWorksheet\("일자별_판매리스트"\)/);
  assert.match(source, /workbook\.addWorksheet\("주문_상세내역"\)/);
  assert.match(source, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(source, /attachment; filename=/);
  assert.match(source, /w\.work_status != 'cancelled'/);
  assert.match(source, /o\.order_status != 'cancelled'/);
  assert.match(source, /writeBuffer/);
});

test("ProductSalesStatsModal includes daily list tab, date accordion toggle, and Excel download action", async () => {
  const { readFile } = await import("node:fs/promises");
  const modalSource = await readFile(new URL("../app/components/ProductSalesStatsModal.tsx", import.meta.url), "utf8");
  const cssSource = await readFile(new URL("../app/sales/product-stats.css", import.meta.url), "utf8");

  // 모달 탭 및 기능 검증
  assert.match(modalSource, /일자별 판매 리스트/);
  assert.match(modalSource, /downloadExcel/);
  assert.match(modalSource, /\/api\/sales\/product-stats\/export\?/);
  assert.match(modalSource, /product-stats-excel-btn/);
  assert.match(modalSource, /📥 엑셀/);
  assert.match(modalSource, /toggleDateCollapse/);
  assert.match(modalSource, /setAllDatesCollapse/);
  assert.match(modalSource, /기간 전체 누적 합계/);

  // CSS 스타일 검증
  assert.match(cssSource, /\.product-stats-excel-btn/);
  assert.match(cssSource, /\.product-stats-main-tabs/);
  assert.match(cssSource, /\.product-stats-daily-container/);
  assert.match(cssSource, /\.product-stats-daily-card/);
  assert.match(cssSource, /\.product-stats-daily-header/);
  assert.match(cssSource, /\.product-stats-daily-grand-bar/);
});

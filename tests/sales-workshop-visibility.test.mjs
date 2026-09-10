import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("sales floor exposes customer, product work status, payment, and pickup-time workbook", async () => {
  const [page, overview] = await Promise.all([
    read("app/sales/page.tsx"),
    read("app/components/SalesFloorOverview.tsx"),
  ]);

  assert.match(page, /SalesFloorOverview/);
  assert.match(overview, /고객별 상품·결제·작업 상태/);
  assert.match(overview, /WORK_STATUS_LABELS/);
  assert.match(overview, /PAYMENT_STATUS_LABELS/);
  assert.match(overview, /jeongilpum-bulk-orders-pickup-time\.xlsx/);
  assert.match(overview, /3_000/);
});

test("workshop page prioritizes the daily cut board and hides legacy utility links", async () => {
  const [page, board, css, api] = await Promise.all([
    read("app/workshop/page.tsx"),
    read("app/components/WorkshopDailyPrepBoard.tsx"),
    read("app/workshop-daily-prep.css"),
    read("app/api/workshop/daily-skin-packs/route.ts"),
  ]);

  assert.match(page, /WorkshopDailyPrepBoard/);
  assert.match(board, /오늘 스킨팩 작업표/);
  assert.match(board, /부위별 필요 수량/);
  assert.match(board, /5_000/);
  assert.match(css, /\.workshop-page-shell \.workshop-utility-links[\s\S]*display: none/);
  assert.match(api, /o\.order_status!='cancelled'/);
  assert.match(api, /f\.pickup_at/);
  assert.match(api, /f\.ship_date/);
});

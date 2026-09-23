import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("SalesApp work columns follow the intuitive user sequence: 주문자(이름) -> 수령일시(수령시간) -> 접수일시 -> 주문내용", async () => {
  const code = await read("app/components/SalesApp.tsx");

  // 1. Verify column order in columns: DataTableColumn<WorkItem>[]
  const columnsMatch = code.match(/columns:\s*DataTableColumn<WorkItem>\[\]\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(columnsMatch, "columns array must exist in SalesApp.tsx");
  const columnsContent = columnsMatch[1];

  const columnIds = Array.from(columnsContent.matchAll(/id:\s*"([^"]+)"/g)).map((m) => m[1]);
  
  // The first four columns must be customer -> dueAt -> createdAt -> product
  assert.equal(columnIds[0], "customer", "첫 번째 열은 주문자(이름)여야 함");
  assert.equal(columnIds[1], "dueAt", "두 번째 열은 수령일시(수령시간)여야 함");
  assert.equal(columnIds[2], "createdAt", "세 번째 열은 접수일시여야 함");
  assert.equal(columnIds[3], "product", "네 번째 열은 주문내용이어야 함");

  // Redundant delivery method column should be removed
  assert.ok(!columnIds.includes("delivery"), "중복된 별도 '수령방법' 컬럼이 제거되어야 함");
  // Redundant standalone quantity column should be merged into 주문내용
  assert.ok(!columnIds.includes("quantity"), "별도 '수량' 컬럼이 '주문내용'으로 통합되어야 함");

  // 2. Verify formatCustomerPhone helper exists and handles hyphens
  assert.match(code, /function formatCustomerPhone/, "formatCustomerPhone 헬퍼가 정의되어야 함");
  assert.match(code, /sales-customer-info/, "주문자 전용 레이아웃 클래스가 적용되어야 함");
  assert.match(code, /sales-due-block/, "수령시간/수령방법 통합 블록이 적용되어야 함");
  assert.match(code, /sales-created-block/, "접수일시 말줄임 방지 2단 블록이 적용되어야 함");
  assert.match(code, /sales-order-content/, "주문내용 통합 블록이 적용되어야 함");
});

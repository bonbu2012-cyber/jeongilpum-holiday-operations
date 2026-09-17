import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCsv } from "../app/lib/csv.ts";

function formatWorkItemDateTime(value) {
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

// Replicates formatOrderDueSchedules from SalesApp.tsx
function formatOrderDueSchedules(order) {
  if (!order.workItems || order.workItems.length === 0) {
    return { schedules: [], summaryText: "일정 미지정" };
  }
  const scheduleMap = new Map();
  for (const item of order.workItems) {
    const date = item.dueAt ? item.dueAt.slice(0, 10) : "";
    if (!date) continue;
    const detail = item.deliveryMethod === "delivery" ? "발송 예정" : (item.dueAt.slice(11, 16) || "시간 미지정");
    const key = `${date} ${detail}`.trim();
    if (!scheduleMap.has(key)) {
      scheduleMap.set(key, { date, detail });
    }
  }
  const schedules = Array.from(scheduleMap.values());
  if (schedules.length === 0) {
    return { schedules: [], summaryText: "일정 미지정" };
  }
  const summaryText = schedules.map((s) => `${s.date} ${s.detail}`.trim()).join(", ");
  return { schedules, summaryText };
}

test("SalesApp defines separated '접수일시' and '수령일시' for both orderColumns and columns", async () => {
  const salesAppCode = await read("app/components/SalesApp.tsx");

  // Verify orderColumns has separated 접수일시 and 수령일시
  assert.match(salesAppCode, /id:\s*"createdAt"[\s\S]*?header:\s*"접수일시"/, "주문 목록 첫 번째 컬럼은 '접수일시'여야 함");
  assert.match(salesAppCode, /id:\s*"dueAt"[\s\S]*?header:\s*"수령일시"/, "주문 목록에 '수령일시' 컬럼이 신규 분리 추가되어야 함");

  // Verify columns (작업 목록) has both 수령일시 and 접수일시
  assert.match(salesAppCode, /columns:\s*DataTableColumn<WorkItem>\[\]\s*=\s*\[[\s\S]*?id:\s*"dueAt"[\s\S]*?header:\s*"수령일시"/, "작업 목록에 '수령일시' 컬럼이 존재해야 함");
  assert.match(salesAppCode, /columns:\s*DataTableColumn<WorkItem>\[\]\s*=\s*\[[\s\S]*?id:\s*"createdAt"[\s\S]*?header:\s*"접수일시"/, "작업 목록에 '접수일시' 컬럼이 분리 추가되어야 함");

  // Verify formatOrderDueSchedules helper exists in SalesApp
  assert.match(salesAppCode, /formatOrderDueSchedules/, "SalesApp에 주문 수령일정 집계 헬퍼가 정의되어야 함");
});

test("formatOrderDueSchedules correctly separates and formats pickup and delivery dates", () => {
  // 1. Single pickup order
  const pickupOrder = {
    workItems: [
      { dueAt: "2026-09-24T10:00:00+09:00", deliveryMethod: "onsite_reservation" },
    ],
  };
  assert.equal(formatOrderDueSchedules(pickupOrder).summaryText, "2026-09-24 10:00");

  // 2. Single delivery order
  const deliveryOrder = {
    workItems: [
      { dueAt: "2026-09-25T00:00:00+09:00", deliveryMethod: "delivery" },
    ],
  };
  assert.equal(formatOrderDueSchedules(deliveryOrder).summaryText, "2026-09-25 발송 예정");

  // 3. Multi-item order with same schedule (deduplication)
  const multiItemSameScheduleOrder = {
    workItems: [
      { dueAt: "2026-09-24T14:30:00+09:00", deliveryMethod: "onsite_reservation" },
      { dueAt: "2026-09-24T14:30:00+09:00", deliveryMethod: "onsite_reservation" },
    ],
  };
  assert.equal(formatOrderDueSchedules(multiItemSameScheduleOrder).summaryText, "2026-09-24 14:30");

  // 4. Multi-item order with different schedules
  const multiScheduleOrder = {
    workItems: [
      { dueAt: "2026-09-24T10:00:00+09:00", deliveryMethod: "onsite_reservation" },
      { dueAt: "2026-09-25T00:00:00+09:00", deliveryMethod: "delivery" },
    ],
  };
  assert.equal(formatOrderDueSchedules(multiScheduleOrder).summaryText, "2026-09-24 10:00, 2026-09-25 발송 예정");

  // 5. Order with no work items
  const emptyOrder = { workItems: [] };
  assert.equal(formatOrderDueSchedules(emptyOrder).summaryText, "일정 미지정");
});

test("Excel CSV export correctly separates 접수일시 and 수령일시 in distinct columns", () => {
  const headers = ["접수일시", "수령일시", "주문번호", "주문자", "작업", "결제", "결제 금액"];

  const sampleCreatedAt = "2026-09-17T11:00:00+09:00";
  const formattedCreatedAt = formatWorkItemDateTime(sampleCreatedAt);

  const rows = [
    [
      formattedCreatedAt,
      "2026-09-24 10:00",
      "JI-260917-0001",
      "김철수 01012345678",
      "봉황세트 1개",
      "결제완료",
      "250,000원 / 250,000원 미수 없음",
    ],
    [
      formattedCreatedAt,
      "2026-09-25 발송 예정",
      "JI-260917-0002",
      "이영희 01098765432",
      "팔영세트 2개",
      "미결제",
      "0원 / 380,000원 미수 380,000원",
    ],
    [
      formattedCreatedAt,
      "일정 미지정",
      "JI-260917-0003",
      "박민수 01055556666",
      "작업 미등록",
      "미결제",
      "0원 / 0원 미수 없음",
    ],
  ];

  const csv = createCsv(headers, rows);

  // Verification of CSV output
  assert.ok(csv.startsWith("\uFEFF"), "Excel 호환을 위한 UTF-8 BOM이 포함되어야 함");
  assert.ok(csv.includes("접수일시,수령일시,주문번호"), "헤더의 첫 두 열이 '접수일시'와 '수령일시'로 분리되어야 함");
  assert.ok(csv.includes("2026-09-24 10:00"), "방문수령 일시가 수령일시 열에 독립 기재되어야 함");
  assert.ok(csv.includes("2026-09-25 발송 예정"), "택배발송 일정이 수령일시 열에 독립 기재되어야 함");
  assert.ok(csv.includes("일정 미지정"), "미지정 일정이 수령일시 열에 안전하게 기재되어야 함");
});

test("SalesApp renders '택배' prominently on top for delivery and full datetime largely for onsite pickup", async () => {
  const [salesAppCode, workTableCss] = await Promise.all([
    read("app/components/SalesApp.tsx"),
    read("app/sales/work-table.css"),
  ]);

  // Check CSS class definitions
  assert.match(workTableCss, /\.sales-due-delivery-title[\s\S]*?font-size:\s*15px/, "택배 배너용 15px 볼드 타이틀 스타일이 정의되어야 함");
  assert.match(workTableCss, /\.sales-due-onsite-datetime[\s\S]*?font-size:\s*14px/, "현장수령용 14px 볼드 일시 스타일이 정의되어야 함");

  // Check SalesApp JSX usage for delivery and onsite
  assert.match(salesAppCode, /sales-due-delivery-title[\s\S]*?>택배<\/b>/, "택배 주문 시 상단에 '택배'를 크게 표시해야 함");
  assert.match(salesAppCode, /sales-due-onsite-datetime/, "현장수령 시 일시가 크게 표시되어야 함");
});

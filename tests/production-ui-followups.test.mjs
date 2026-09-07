import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { isPastPickupTime, koreanWonText } from "../app/lib/input-format.ts";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx|css)$/.test(entry.name) ? [target] : [];
  });
}

test("금액을 한글 원 단위로 읽는다", () => {
  assert.equal(koreanWonText(0), "영원");
  assert.equal(koreanWonText(125_800), "십이만오천팔백원");
  assert.equal(koreanWonText(100_000_000), "일억원");
});

test("오늘은 현재 분까지의 방문 시간을 막고 다른 날짜는 유지한다", () => {
  const now = new Date("2026-09-06T01:15:00.000Z"); // 서울 10:15
  assert.equal(isPastPickupTime("2026-09-06", "10:00", now), true);
  assert.equal(isPastPickupTime("2026-09-06", "10:15", now), true);
  assert.equal(isPastPickupTime("2026-09-06", "10:30", now), false);
  assert.equal(isPastPickupTime("2026-09-07", "08:00", now), false);
});

test("방문 시간 화면과 주문 API가 지난 시간 선택을 함께 차단한다", () => {
  const kiosk = read("app/components/KioskApp.tsx");
  const api = read("app/api/orders/route.ts");
  const css = read("app/kiosk-flow.css");
  assert.match(kiosk, /setInterval\(\(\)=>setNow\(new Date\(\)\),1_000\)/);
  assert.match(kiosk, /disabled=\{unavailable\}/);
  assert.match(kiosk, /지난 시간/);
  assert.match(api, /isPastPickupTime\(scheduleDate, pickupTime\)/);
  assert.match(api, /이미 지난 방문 시간입니다/);
  assert.match(css, /pickup-time-grid button:disabled/);
});

test("직원 도움 UI와 요청사항 예시 문구가 앱 소스에 남지 않는다", () => {
  const appSource = sourceFiles(path.join(root, "app")).map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(appSource, /직원 도움|StaffHelp|staff-help|help-toast|예: 지방/);
});

test("직접 금액 입력 화면은 공통 MoneyInput을 사용한다", () => {
  assert.match(read("app/components/CustomOrderApp.tsx"), /<MoneyInput/);
  assert.match(read("app/components/CustomerLedgerApp.tsx"), /<MoneyInput/);
  assert.match(read("app/components/SettingsApp.tsx"), /<MoneyInput/);
});

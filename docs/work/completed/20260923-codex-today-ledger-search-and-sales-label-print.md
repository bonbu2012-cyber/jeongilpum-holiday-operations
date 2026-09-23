# Task: 오늘의 장부 검색 기능 추가 및 판매장/작업장 상품정보 라벨 출력 횟수 추적 및 중복 인쇄 방지

- Status: Completed
- Owner: codex
- Branch: codex/today-ledger-search-and-sales-label-print
- Base commit: 0be5d1a
- Started at: 2026-09-23T15:08:00+09:00
- Completed at: 2026-09-23T15:28:00+09:00
- Target environment: Local | Preview | Production
- Related issue/spec: 오늘의 장부 검색 기능 추가 및 판매장/작업장 상품정보 라벨 출력 횟수/중복방지 지원

## Goal

1. **오늘의 장부 (`/today`)**: 주문자명, 전화번호, 수령인, 주소, 상품명, 주문번호 등으로 실시간 검색할 수 있는 직관적인 검색 바 및 결과 필터링 기능 추가.
2. **판매장 (`/sales`) 및 작업장 (`/workshop`) 상품정보 라벨 출력 및 출력횟수 추적**:
   - 판매장에 상품정보 라벨 출력 기능(단건 및 다건 선택 일괄 출력, 전체 출력) 추가.
   - DB `work_item_events` 테이블에 `'label_printed'` 감사 이벤트를 기록하여 라벨 출력 횟수 및 최근 출력 일시 영구 보존.
   - 판매장 및 작업장 테이블의 "라벨" 열에 미출력(`[미출력]`) vs 출력완료(`[출력 N회]`) 시각적 배지 제공.
   - 라벨 출력 모달(`WorkshopLabelModal`) 내에서 각 라벨별 첫 출력/재출력(`[⚠️ 이미 출력됨 (N회)]` vs `[✨ 첫 출력]`) 안내 및 "미출력 라벨만 출력" 필터 버튼을 제공하여 작업자의 중복 인쇄 원천 방지.

## Non-goals

- DB 마이그레이션 변경 없음 (기존 `work_item_events` 테이블 및 D1 `batch()` 활용)
- 운영 데이터 임의 변경 없음

## Modified paths

- `app/lib/today-ledger-search.ts` [NEW]
- `app/today/TodayLedgerApp.tsx`
- `app/today/today-ledger.css`
- `app/api/work-items/labels/print/route.ts` [NEW]
- `app/api/work-items/route.ts`
- `app/api/workshop/orders/route.ts`
- `app/lib/workshop-packing-slip.ts`
- `app/components/WorkshopLabelModal.tsx`
- `app/components/SalesApp.tsx`
- `app/components/WorkshopApp.tsx`
- `app/workshop-flow.css`
- `app/sales/work-table.css`
- `tests/today-ledger.test.mjs`
- `tests/sales-label-print.test.mjs` [NEW]
- `docs/work/completed/20260923-codex-today-ledger-search-and-sales-label-print.md` [NEW]

## Acceptance criteria

- [x] 오늘의 장부 상단에 검색 바가 제공되며, 주문자명/전화번호/수령인/주소/상품명/주문번호 입력 시 실시간으로 방문 및 택배 목록이 필터링됨.
- [x] 오늘의 장부 검색 시 매칭 건수 표시 및 검색어 1클릭 지우기(✕)가 동작함.
- [x] 판매장 작업 테이블에 라벨 출력 버튼 및 출력 횟수 배지(`미출력` / `출력 N회`)가 표시됨.
- [x] 판매장 상단 액션바 및 일괄 처리에서 선택 작업 항목에 대한 일괄 라벨 출력이 가능함.
- [x] 작업장 테이블에서도 라벨 미출력/출력완료 횟수가 직관적으로 표시됨.
- [x] 라벨 인쇄 시 `POST /api/work-items/labels/print`를 통해 `work_item_events`에 기록되고 새로고침/재조회 시에도 출력 횟수가 유지됨.
- [x] 라벨 모달에서 각 카드의 첫 출력/재출력 여부가 표시되고, "미출력 라벨만 출력" 필터를 통해 이미 출력된 라벨을 제외하고 인쇄할 수 있음.
- [x] 단위 테스트 통과 (25/25), `npm run typecheck`, `npm run lint` 통과.

## Test Results

- `npm run typecheck`: Passed (code 0)
- `npm run lint`: Passed (0 errors, 0 warnings)
- `node --test tests/sales-label-print.test.mjs tests/today-ledger.test.mjs tests/workshop-packing-slip-and-labels.test.mjs`: All 25 tests passed

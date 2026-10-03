# Task: 판매장 상품별 통계 일자별 판매리스트 조회 및 엑셀 다운로드 기능 구현

- Status: Completed
- Owner: Codex
- Branch: `codex/sales-product-stats-daily-excel`
- Base commit: `d5a1159`
- Started at: 2026-10-03T13:10:00+09:00
- Completed at: 2026-10-03T13:22:00+09:00
- Target environment: Local | Production
- Related issue/spec: 명절 이후 통계 산출, 특정 기간 지정 일자별 판매리스트 일괄 조회, 기간별 조회 결과값 엑셀(.xlsx) 저장 및 다음 명절 준비 참고 자료 활용

## Goal

판매장 '상품별 판매 통계' 모달에서 특정 기간을 지정하여 한 번에 일자별(날짜별) 판매 리스트(날짜별 판매 품목, 수량, 금액, 주문 건수 등)를 조회할 수 있도록 UI와 API를 확장하고, 조회된 결과(종합 상품별 통계, 일자별 판매 현황, 주문 상세 내역)를 실무 기록 및 차기 명절 준비 참고용 정규 엑셀 파일(`.xlsx`)로 즉시 내려받을 수 있는 기능을 구현한다.

## Non-goals

- DB schema 또는 migration 변경 없음 (기존 D1 orders/work_items/fulfillments 읽기 전용)
- 기존 상품별 종합 통계(카드/테이블 뷰)의 정합성 훼손 없음 (하위 호환성 100% 유지)
- 판매장 메인 테이블 컬럼 레이아웃 변경 없음

## Claimed paths

- `app/api/sales/product-stats/route.ts`
- `app/api/sales/product-stats/export/route.ts`
- `app/components/ProductSalesStatsModal.tsx`
- `app/sales/product-stats.css`
- `tests/sales-product-stats.test.mjs`
- `docs/PAGES_AND_FEATURES.md`
- `docs/API_AND_INTEGRATIONS.md`
- `docs/work/completed/20261003-codex-sales-product-stats-daily-excel.md`

## Shared contracts

- API: `GET /api/sales/product-stats` (반환값에 `dailyList` 추가, 기존 `summary`, `categories` 100% 하위 호환 유지)
- API: `GET /api/sales/product-stats/export` (엑셀 워크북 3시트 스트리밍 다운로드)
- Component: `ProductSalesStatsModal` (일자별 판매 리스트 탭, 아코디언 토글, 엑셀 다운로드 원클릭 버튼 및 푸터 버튼 추가)

## Dependencies

- `exceljs` (^4.4.0): 서버 엑셀 워크북 생성에 사용

## Implementation Details

1. **API 확장 (`app/api/sales/product-stats/route.ts`)**:
   - `processRows` 헬퍼 함수로 전체 종합 집계와 일자별 집계를 일관되게 처리.
   - 반환값에 `dailyList` 추가: 날짜, 한국어 요일, 주문 건수, 판매 수량, 금액, 결제완료/미결제 내역, 카테고리별/품목별 판매 현황을 일자 오름차순으로 제공.
2. **엑셀 다운로드 API (`app/api/sales/product-stats/export/route.ts`)**:
   - 운영자 세션 인증(`requireOperatorApi()`) 게이트 적용.
   - `ExcelJS.Workbook`을 통해 실무 및 차기 명절 준비에 최적화된 3개 워크시트 생성:
     - **시트 1: [종합_상품별통계]**: 타이틀, 조회기간/기준 메타, KPI 박스, 공식 선물세트 라인업 순서 품목별 판매실적, 카테고리 소계, 전체 총계.
     - **시트 2: [일자별_판매리스트]**: 기간 내 모든 날짜별 판매 품목, 단가, 수량, 금액, 일자별 소계(주문건수/수량/금액) 및 기간 전체 누적 합계.
     - **시트 3: [주문_상세내역]**: 기준일자, 접수일시, 주문번호, 고객명, 연락처, 수령방법, 수령일시, 수령인, 배송주소, 품목명, 단가, 수량, 금액, 결제상태, 고객메모, 맞춤작업메모 전수 명단.
     - 천단위 콤마 서식(`#,##0`), 퍼센트 서식(`0.0%`), 헤더 배경색, 테두리선, 컬럼 자동 너비 완벽 적용.
3. **UI 구현 (`ProductSalesStatsModal.tsx`, `product-stats.css`)**:
   - 상단 메인 탭: `[📦 상품별 종합 집계]` vs `[📅 일자별 판매 리스트]`
   - 일자별 판매 리스트 탭:
     - 각 일자별 날짜 뱃지, 주문 건수, 판매 세트 수, 금액, 결제 요약 표시.
     - 날짜별 접기/펼치기 아코디언 및 상단 '모두 펼치기 / 모두 접기' 버튼.
     - 일자별 품목 테이블 및 일자 소계 행 제공.
     - 최하단 기간 전체 누적 합계 배너 제공.
   - `[📥 엑셀 다운로드 (.xlsx)]` 원클릭 버튼: 상단 컨트롤 바 및 모달 푸터에 모두 배치, 다운로드 중 로딩 피드백.
   - 텍스트 복사 시 현재 선택된 탭(종합 집계 or 일자별 리스트)에 맞게 스마트 서식화하여 클립보드 복사.

## Acceptance criteria

- [x] 특정 기간(시작일~종료일)을 지정하여 한 번에 일자별 판매 리스트를 조회할 수 있다.
- [x] 일자별 판매 리스트에서 각 날짜별 주문 건수, 판매 수량, 판매 금액 소계 및 품목별 판매 내역이 정확하게 표시된다.
- [x] '엑셀 다운로드' 버튼 클릭 시 정규 `.xlsx` 파일로 저장되며, 종합 요약/일자별 리스트/주문 상세 시트가 완벽하게 서식화되어 제공된다.
- [x] 기존 일자별(하루)/기간별(범위) 상품별 집계(카드/테이블 뷰)가 이전과 동일하게 완벽히 동작한다.
- [x] 운영자 인증이 적용되어 비인가 접근이 차단된다.

## Validation

- [x] `npm run typecheck`: 0 errors
- [x] `npm run lint`: 0 warnings, 0 errors
- [x] `node --test tests/sales-product-stats.test.mjs`: 4/4 passed
- [x] `node --test tests/sales-product-stats.test.mjs tests/address-and-inline-display.test.mjs tests/today-ledger.test.mjs tests/workshop-packing-slip-and-labels.test.mjs`: 30/30 passed
- [x] `npm run build`: compiled successfully, `/api/sales/product-stats/export` dynamic route registered

## Completion

- Final commit: `b45bedf`
- GitHub remote/branch: `origin/codex/sales-product-stats-daily-excel`
- Push verification: completed
- Completed at: 2026-10-03T13:22:00+09:00

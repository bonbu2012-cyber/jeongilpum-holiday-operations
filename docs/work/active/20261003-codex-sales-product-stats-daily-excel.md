# Task: 판매장 상품별 통계 일자별 판매리스트 조회 및 엑셀 다운로드 기능 구현

- Status: Active
- Owner: Codex
- Branch: `codex/sales-product-stats-daily-excel`
- Base commit: `d5a1159`
- Started at: 2026-10-03T13:10:00+09:00
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
- `docs/work/active/20261003-codex-sales-product-stats-daily-excel.md`

## Shared contracts

- API: `GET /api/sales/product-stats` (반환값에 `dailyList` 추가, 기존 `summary`, `categories` 유지)
- API: `GET /api/sales/product-stats/export` (엑셀 파일 스트리밍 다운로드)
- Component: `ProductSalesStatsModal` (일자별 판매 리스트 뷰 및 엑셀 다운로드 버튼 추가)

## Dependencies

- `exceljs` (^4.4.0): 서버 엑셀 워크북 생성에 사용

## Plan

1. **API 분석 및 확장**:
   - `app/api/sales/product-stats/route.ts`:
     - 기간 내 일자별 그룹핑 로직 추가 (`dailyList`: 날짜별 요약, 카테고리별/상품별 판매 수량 및 금액)
   - `app/api/sales/product-stats/export/route.ts`:
     - 운영자 세션 인증(`requireOperatorApi()`)
     - 기간별 통계 쿼리 실행
     - `ExcelJS.Workbook` 생성:
       - 시트 1: [종합_상품별통계] (조회 메타정보, 주요 지표, 상품별 단가/수량/비중/금액)
       - 시트 2: [일자별_판매리스트] (일자, 요일, 카테고리, 상품명, 수량, 금액, 일자별 소계)
       - 시트 3: [주문_상세내역] (일자, 주문번호, 고객명, 연락처, 수령방법, 수령/발송일시, 상품명, 수량, 금액, 결제상태, 메모)
     - 셀 서식(헤더 스타일, 천단위 콤마, 테두리, 열 자동 너비) 적용 및 스트리밍 응답
2. **UI 구현 (`ProductSalesStatsModal.tsx`, `product-stats.css`)**:
   - 뷰 모드에 '일자별 판매 리스트 (📅 일자별 상세)' 추가
   - 일자별 날짜 헤더(주문 건수, 판매 수량, 판매 금액 소계) 및 해당 일자 판매 품목 표 렌더링
   - `[📥 엑셀 다운로드 (.xlsx)]` 버튼 추가 및 다운로드 진행 피드백
   - 일자별 텍스트 복사 지원
3. **테스트 및 검증**:
   - `tests/sales-product-stats.test.mjs` 확장
   - `npm run typecheck`, `npm run lint`, 관련 test 실행
4. **문서 갱신 및 완료 정리**:
   - `docs/PAGES_AND_FEATURES.md` 갱신
   - active task 완료 처리 및 push

## Acceptance criteria

- [ ] 특정 기간(시작일~종료일)을 지정하여 한 번에 일자별 판매 리스트를 조회할 수 있다.
- [ ] 일자별 판매 리스트에서 각 날짜별 주문 건수, 판매 수량, 판매 금액 소계 및 품목별 판매 내역이 정확하게 표시된다.
- [ ] '엑셀 다운로드' 버튼 클릭 시 정규 `.xlsx` 파일로 저장되며, 종합 요약/일자별 리스트/주문 상세 시트가 완벽하게 서식화되어 제공된다.
- [ ] 기존 일자별(하루)/기간별(범위) 상품별 집계(카드/테이블 뷰)가 이전과 동일하게 완벽히 동작한다.
- [ ] 운영자 인증이 적용되어 비인가 접근이 차단된다.

## Validation

- [ ] lint
- [ ] typecheck
- [ ] related tests
- [ ] build

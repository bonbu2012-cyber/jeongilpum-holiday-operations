# Task: 상품별 통계, 작업장/판매장 한눈에 보기 개선, 판매장 카카오 주소검색, 키오스크 상세주소 선택화

- Status: Completed
- Owner: Codex
- Branch: `codex/sales-stats-and-ui-improvements`
- Base commit: `3c4efd1`
- Completed commit: `1093f12`
- Started at: 2026-09-16
- Completed at: 2026-09-17
- Target environment: Production candidate

## Goal

1. 판매장 상품별 통계 (일자별/기간별, 판매 0건 제외, 선물세트 라인업 순서 정렬)
2. 작업장/판매장 목록에서 클릭 없이 상품명, 메모(고객 요청/관리자 메모), 맞춤주문 세부 구성 즉시 노출
3. 판매장 새 주문 및 작업 수정 시 택배 발송 주소 카카오 도로명주소 검색 연동
4. 키오스크 및 맞춤주문 접수 시 택배 상세주소 필수 검사 해제 (선택 입력화)

## Claimed paths

- `app/components/KioskApp.tsx`
- `app/components/CustomOrderApp.tsx`
- `app/components/WorkItemEditor.tsx`
- `app/components/CustomOrderDetails.tsx`
- `app/components/SalesApp.tsx`
- `app/components/WorkshopApp.tsx`
- `app/components/ProductSalesStatsModal.tsx`
- `app/sales/product-stats.css`
- `app/api/sales/product-stats/route.ts`
- `tests/sales-product-stats.test.mjs`
- `tests/address-and-inline-display.test.mjs`
- `docs/PAGES_AND_FEATURES.md`
- `docs/work/completed/20260916-codex-sales-stats-and-ui-improvements.md`

## Verification

- `npm run lint`: 통과 (0 errors, 0 warnings)
- `npm run typecheck`: 통과 (0 errors)
- `node --test tests/sales-product-stats.test.mjs tests/address-and-inline-display.test.mjs tests/today-ledger.test.mjs tests/workshop-packing-slip-and-labels.test.mjs`: 통과 (24/24 tests pass)
- `npm run build`: 19/19 라우트 빌드 성공 (Code 0)


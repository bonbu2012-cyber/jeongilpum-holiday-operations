# Task: sales-product-stats-fix

- Status: Completed
- Owner: codex
- Branch: codex/sales-product-stats-fix
- Base commit: 7619e96
- Started at: 2026-09-18T05:41:00+09:00
- Completed at: 2026-09-18T05:47:00+09:00
- Target environment: Local | Preview | Production
- Related issue/spec: 일자별/기간별 주문량, 상품별 판매량(결제 여부 무관), 총 금액 통계 조회 및 시각화 개선

## Goal

판매장 '상품별 판매 통계' 모달에서 SQL 컬럼명 오류(`o.status` -> `o.order_status`)로 발생하던 500 오류를 해결하고, 결제 여부와 관계없이 지정 일자/기간 동안의 총 주문량, 상품별 판매량, 총 판매 금액을 한눈에 명확하게 파악할 수 있도록 통계 API 및 UI를 개선한다.

## Non-goals

- DB 마이그레이션 변경 없음
- 주문 생성 및 기존 판매장 목록 테이블 스키마 변경 없음

## Claimed paths

- `app/api/sales/product-stats/route.ts`
- `app/components/ProductSalesStatsModal.tsx`
- `app/sales/product-stats.css`
- `tests/sales-product-stats.test.mjs`
- `docs/API_AND_INTEGRATIONS.md`
- `docs/PAGES_AND_FEATURES.md`

## Shared contracts

- API: `GET /api/sales/product-stats`
- Table: `work_items`, `orders`

## Acceptance criteria

- [x] 상품별 판매 통계 조회 시 500 에러 없이 일자별/기간별 주문량, 상품별 판매량, 총 금액이 정상 표시
- [x] 결제 여부(결제완료/미결제)와 상관없이 모든 유효 주문이 총계에 반영됨을 한눈에 식별 가능
- [x] typecheck 및 린트 통과

## Validation

- `npm run typecheck`: 통과
- `npm run lint`: 통과
- `node --test tests/sales-product-stats.test.mjs tests/sales-payment-summary.test.mjs tests/sales-excel-dates.test.mjs`: 8/8 통과

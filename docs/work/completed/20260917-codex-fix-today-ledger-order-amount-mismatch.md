# Task: 오늘의 장부 주문자별 상품금액과 총 금액/미수금 불일치 해결

- Status: Completed
- Owner: Codex
- Branch: `codex/fix-today-ledger-order-amount-mismatch`
- Base commit: `e5f38e9`
- Completed commit: `1142727`
- Started at: 2026-09-17
- Completed at: 2026-09-17
- Target environment: Production candidate

## Goal

1. 오늘의 장부(`/today`)에서 상품 세부내역(단가 × 수량)과 주문자별 총 금액(`totalAmount`) 및 미수금(`balance`)이 일치하도록 계산 로직 개선
2. 판매장 새 주문 등록 시 상품 단가·수량 변경에 맞춰 주문 금액 자동 합산 동기화
3. 주문 생성 및 결제 API에서 작업 항목 합계를 바탕으로 정확한 금액 무결성 보장
4. 현재 DB 상에 단가만 기록되거나 0으로 기록된 기존 주문 데이터 전수 보정 동기화 (서연이 엄마, 팔영펌프카, 신현석 등)

## Claimed paths

- `app/api/today-ledger/route.ts`
- `app/api/orders/payment/route.ts`
- `app/api/orders/route.ts`
- `app/components/SalesApp.tsx`
- `tests/today-ledger.test.mjs`
- `scripts/sync-order-total-amounts.mjs`
- `docs/work/completed/20260917-codex-fix-today-ledger-order-amount-mismatch.md`

## Verification

- `node scripts/sync-order-total-amounts.mjs`: DB 내 4건 불일치 주문 보정 완료 (모두 동기화됨)
- `node --test tests/today-ledger.test.mjs`: 6/6 tests pass (단가 25만원x3=75만원 불일치 보정 테스트 포함)
- `node --test tests/sales-product-stats.test.mjs tests/address-and-inline-display.test.mjs tests/workshop-packing-slip-and-labels.test.mjs tests/today-ledger.test.mjs`: 25/25 tests pass
- `npm run lint`: 통과 (0 errors, 0 warnings)
- `npm run typecheck`: 통과 (0 errors)
- `npm run build`: 19/19 routes build success (Code 0)


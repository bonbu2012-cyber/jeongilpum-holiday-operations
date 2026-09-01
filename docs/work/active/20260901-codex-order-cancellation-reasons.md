# Task: 테스트 주문 취소 사유와 고객 장부 정리

- Status: Active
- Owner: Codex
- Branch: `codex/order-cancellation-reasons`
- Base commit: `08dda9e85dd25f9b7b735186abfa108f262595bc`
- Started at: 2026-09-01
- Target environment: Production

## Goal

테스트·고객취소 주문을 실제 삭제하지 않고 감사 이력이 남는 취소 상태로 전환한다. 취소 주문은 통계·미수·생산 집계에서 제외하고 구매 검색에서는 유지한다. 사유는 테스트/취소/직접입력 드롭다운으로 받으며, 결제 이력이 없는 취소 전용 고객은 고객 장부 기본 목록에서 숨긴다.

## Claimed paths

- `app/components/SalesOrderDetail.tsx`
- `app/components/SalesApp.tsx`
- `app/api/orders/status/route.ts`
- `app/api/customer-ledger/route.ts`
- `app/sales-flow.css`
- `tests/commerce.test.mjs`
- `tests/sales-operations.test.mjs`
- `docs/PAGES_AND_FEATURES.md`
- `docs/API_AND_INTEGRATIONS.md`

## Shared contracts

- 주문 `cancelled` 상태 전환 payload와 `order_events.reason`
- 고객 장부 기본 목록 노출 조건

## Plan

1. 기존 취소·통계·장부 조회 계약 확인
2. 사유 선택 UI와 서버 검증·감사 기록 구현
3. 취소 전용 무결제 고객의 장부 목록 제외
4. 전체 검사와 Production 배포

## Validation

- [ ] lint
- [ ] typecheck
- [ ] full test
- [ ] build
- [ ] Production smoke

## Completion

- Final implementation commit:
- Sites version:
- Production URL:
- Completed at:
- Remaining TODO:

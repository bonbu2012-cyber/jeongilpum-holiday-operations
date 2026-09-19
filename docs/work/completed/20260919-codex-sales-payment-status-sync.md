# Task: 새 주문 추가 및 주문 수정 결제 정보-작업항목 연동

- Status: Completed
- Owner: codex
- Branch: codex/sync-sales-order-payment-status
- Base commit: 936baa0 docs: complete production deploy task for product stats fix
- Started at: 2026-09-19T11:06:00+09:00
- Completed at: 2026-09-19T11:10:00+09:00
- Target environment: Local | Preview | Production
- Related issue/spec: 새 주문 추가 시 작업항목 결제 여부 선택 후 저장 시 미결제 저장 및 결제 상태/금액 미연동 문제

## Goal

새 주문 추가(`NewOrderEditor`) 및 주문 정보 수정(`OrderEditor`) 모달에서 작업 항목의 결제 여부(`paymentStatus`, 결제완료/미결제)와 상단 주문 정보의 결제 상태(`paymentStatus`) 및 결제 금액(`paidAmount`)이 양방향으로 실시간 연동되도록 수정하고, 저장 시 DB에 결제 상태와 결제 금액이 올바르게 반영되도록 한다.

## Non-goals

- DB migration 생성 (기존 `orders.payment_status`, `orders.paid_amount` 스키마 유지)
- 결제 수단 추가 또는 PG 결제 연동
- 판매장 메인 테이블 구조 변경

## Claimed paths

- `app/components/SalesApp.tsx`
- `app/api/orders/route.ts`
- `tests/sales-order-payment-sync.test.mjs`
- `docs/PAGES_AND_FEATURES.md`

## Shared contracts

- API route/field: `/api/orders` (manual-create POST, PATCH), `paymentStatus`, `paidAmount`
- DB table/column: `orders.payment_status`, `orders.paid_amount`
- shared type/event/status: `PaymentStatus`

## Dependencies

- 먼저 병합되어야 하는 task/commit: 없음 (936baa0 기준)
- 이 작업을 기다리는 task: 없음

## Plan

1. active task 등록 및 branch 생성
2. `SalesApp.tsx`의 `OrderFields` 결제 상태 필드를 `FieldSelect`로 개선
3. `NewOrderEditor`에서 `updateWorkItem`, `updateOrder`, `calculateTotal`, `submit` 간 양방향 결제 정보 연동 구현
4. `OrderEditor`에서 초기 `paymentStatus` 바인딩 및 작업 항목 변경 시 상단 결제 정보 동기화
5. `app/api/orders/route.ts`에서 `createManualOrder` 시 작업 항목 기반 결제 상태 방어 처리
6. typecheck, lint, 단위 테스트 및 회귀 검증
7. 관련 문서 갱신 및 Git push

## Acceptance criteria

- [x] 작업 항목에서 결제완료 선택 시 상단 결제 상태가 '결제완료'로 변경되고 결제 금액이 주문 총액으로 자동 입력됨
- [x] 작업 항목에서 미결제 선택 시 상단 결제 상태가 '미결제'로 변경되고 결제 금액이 0원으로 변경됨
- [x] 상단 결제 상태에서 결제완료/미결제 선택 시 모든 작업 항목의 결제 여부가 동기화됨
- [x] 결제완료 상태에서 상품 단가/수량 변경 시 결제 금액이 변경된 총액으로 자동 갱신됨
- [x] 작업 항목 추가 시 현재 주문의 결제 여부를 기본값으로 계승함
- [x] 저장 시 서버 DB에 결제 상태(paid)와 결제 금액이 올바르게 생성/수정됨
- [x] 기존 주문 수정 모달에서도 동일하게 양방향 연동됨

## Validation

- [x] lint (`npm run lint` 통과 - 0 error)
- [x] typecheck (`npm run typecheck` 통과 - 0 error)
- [x] unit test (`node --test tests/sales-order-payment-sync.test.mjs` 4/4 통과)
- [x] regression test (`node --test tests/sales-payment-summary.test.mjs` 2/2 통과)

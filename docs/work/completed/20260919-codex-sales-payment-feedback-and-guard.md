# Task: 새 주문/주문 수정 결제 상태 피드백 메시지 명확화 및 서버 결제완료 방어 강화

- Status: Completed
- Owner: codex
- Branch: codex/sales-payment-feedback-and-guard
- Base commit: 6175c1f docs: record production deploy in sales payment sync task
- Started at: 2026-09-19T12:00:00+09:00
- Completed at: 2026-09-19T12:03:00+09:00
- Target environment: Local | Preview | Production
- Related issue/spec: 새 주문 입력 시 결제완료 피드백 메시지 부재 및 서버 payload.paymentStatus 방어 로직 강화

## Goal

1. `app/api/orders/route.ts`의 `createManualOrder`에서 `payload.paymentStatus`가 `unpaid`이더라도 작업 항목(`items`) 중 하나라도 `paid`이면 확실하게 `paid`로 판정되도록 방어 로직을 강화한다.
2. `app/components/SalesApp.tsx`에서 새 주문 등록(`createOrder`), 주문 수정(`saveOrder`), 작업 행 수정(`saveWorkItem`) 완료 토스트 알림에 결제 상태(결제완료/미결제/부분결제 및 수납 금액)를 명확히 포함하여 사용자에게 즉각적인 시각적 피드백을 제공한다.
3. 검사 통과 후 프로덕션(Vercel)에 즉시 배포하여 라이브 반영한다.

## Claimed paths

- `app/api/orders/route.ts`
- `app/components/SalesApp.tsx`
- `tests/sales-order-payment-sync.test.mjs`

## Plan

1. `app/api/orders/route.ts`의 paymentStatus 결정 로직 수정 (`(hasPaidItem || requestedStatus === "paid") ? "paid" : ...`)
2. `SalesApp.tsx`에서 `createOrder`, `saveOrder`, `saveWorkItem` 토스트 메시지에 결제 상태와 수납 금액 텍스트 추가
3. 테스트 추가 및 실행 (`tests/sales-order-payment-sync.test.mjs`)
4. typecheck, lint, build 검증
5. 커밋, main 병합, Vercel Production 배포

## Validation

- [x] unit test (`node --test tests/sales-order-payment-sync.test.mjs` 5/5 통과)
- [x] regression test (`node --test tests/sales-payment-summary.test.mjs` 2/2 통과)
- [x] typecheck (`npm run typecheck` 통과)
- [x] lint (`npm run lint` 통과)
- [x] build (`npm run build` 통과)


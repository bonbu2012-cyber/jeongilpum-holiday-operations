# Task: 작업장 작업 행 수정 결제 여부 변경 기능 추가 및 기결제 주문 동기화

## Owner
- Codex

## Date
- 2026-09-14

## Target Paths
- `app/components/WorkItemEditor.tsx`
- `app/components/WorkshopApp.tsx`
- `app/components/SalesApp.tsx`
- `app/api/work-items/route.ts`
- `app/lib/workshop-packing-slip.ts`
- `tests/workshop-packing-slip-and-labels.test.mjs`

## Description
1. 결제 완료된 수령일 외 예약 건(`260914-001`, `260914-002`, `260914-003` 등)에 대해 결제완료(`paid`) 상태 동기화 처리 (`paid_amount = total_amount`).
2. `WorkItemEditor`에 `paymentStatus` 필드(`결제 여부`: 미결제 / 결제완료)를 추가하여 작업장 "작업 행 수정" 모달에서 직접 결제 여부를 조회 및 변경할 수 있도록 지원.
3. `PATCH /api/work-items` 엔드포인트에서 `changes.paymentStatus`를 수신하여 `orders.payment_status` 및 `orders.paid_amount`를 원자적으로 갱신하고 `payment_changed` 감사 이벤트를 기록하도록 처리.
4. `WorkshopApp.tsx` 작업장 현장 및 택배 작업 테이블 컬럼에 `결제` 배지(`결제완료`/`미결제`)를 추가하여 작업자가 직관적으로 결제 여부를 확인할 수 있도록 개선.
5. `app/lib/workshop-packing-slip.ts`의 `WorkItemLike` 및 `formatPaymentStatus`에서 `paymentStatus: string | null | undefined`를 안전하게 허용하여 타입 일관성 보장.

## Verification Results
- `npm run typecheck`: 통과 (0 errors)
- `npm run lint`: 통과 (0 errors)
- `node --test tests/workshop-packing-slip-and-labels.test.mjs`: 통과 (7/7 tests passed)
- `npm run build`: 통과 (전체 18개 라우트 정상 빌드)

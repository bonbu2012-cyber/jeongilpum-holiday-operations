# Task: 작업장 주문 미반영 문제 원인 분석, 해결 및 프로덕션 배포

- Status: In Progress
- Owner: Codex
- Branch: `codex/fix-workshop-orders-sync`
- Base commit: `3a9ca5302a84e14906c98cfdc068fecce8e6dfc4`
- Started at: 2026-09-12
- Target environment: Vercel Production + Supabase DB

## Goal

키오스크(`/kiosk`)나 판매장(`/sales`)에서 주문을 접수해도 작업장(`/workshop`) 화면 및 API에 작업 내역이 전혀 표시되지 않는 문제의 근본 원인을 해결하고, Vercel 프로덕션에 배포한다.

## Claimed paths

- `db/index.ts`
- `app/api/workshop/orders/route.ts`
- `app/components/WorkshopApp.tsx`
- `scripts/migrate-postgres.mjs`
- `docs/work/active/20260912-codex-workshop-orders-sync.md`

## Root Cause

1. `db/index.ts`의 `dbWrapper.batch()`에서 `stmt.run`이 `stmt.all`보다 먼저 확인되어, 모든 SELECT 문이 `run()` -> `exec_dml`로 실행되면서 `results: []` 빈 배열을 반환함.
2. `TODAY_ONSITE_WORK_ITEMS_SQL`과 `TODAY_DELIVERY_WORK_ITEMS_SQL`의 `INNER JOIN products`로 인한 상품 누락 방지를 위해 `LEFT JOIN products`로 보강 필요.
3. 현장판매(`onsite_sale`) 주문도 당일 작업장 수령 목록에서 함께 조회될 수 있도록 delivery_method 조건 확장 필요.

## Plan

1. `db/index.ts`: `batch()`에서 `(stmt as any)?.all` 우선 호출로 수정.
2. `app/api/workshop/orders/route.ts`:
   - `DeliveryMethod` 타입에 `"onsite_sale"` 추가
   - `TODAY_ONSITE_WORK_ITEMS_SQL`: `LEFT JOIN products p`, `w.delivery_method IN ('onsite_reservation', 'onsite_sale')`
   - `TODAY_DELIVERY_WORK_ITEMS_SQL`: `LEFT JOIN products p`
3. `app/components/WorkshopApp.tsx`: `WorkItem`의 `deliveryMethod`에 `"onsite_sale"` 추가.
4. `scripts/migrate-postgres.mjs`: ESLint 미사용 변수 에러(`catch (e)`) 수정.
5. typecheck, lint, build 및 API 쿼리 테스트 검증.
6. Commit, push 및 프로덕션 배포 완료.

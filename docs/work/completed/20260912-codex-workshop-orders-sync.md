# Task: 작업장 주문 미반영 문제 원인 분석, 해결 및 프로덕션 배포

- Status: Completed
- Owner: Codex
- Branch: `codex/fix-workshop-orders-sync`
- Base commit: `3a9ca5302a84e14906c98cfdc068fecce8e6dfc4`
- Final commit: `22f3f7a`
- Started at: 2026-09-12
- Completed at: 2026-09-12
- Target environment: Vercel Production + Supabase DB

## Goal

키오스크(`/kiosk`)나 판매장(`/sales`)에서 주문을 접수해도 작업장(`/workshop`) 화면 및 API에 작업 내역이 전혀 표시되지 않는 문제의 근본 원인을 해결하고, Vercel 프로덕션에 배포한다.

## Claimed paths

- `db/index.ts`
- `app/api/workshop/orders/route.ts`
- `app/components/WorkshopApp.tsx`
- `scripts/migrate-postgres.mjs`
- `docs/work/completed/20260912-codex-workshop-orders-sync.md`

## Root Cause

1. `db/index.ts`의 `dbWrapper.batch()`에서 `stmt.run`이 `stmt.all`보다 먼저 확인되어, 모든 SELECT 문이 `run()` -> `exec_dml`로 실행되면서 `results: []` 빈 배열을 반환함.
2. `TODAY_ONSITE_WORK_ITEMS_SQL`과 `TODAY_DELIVERY_WORK_ITEMS_SQL`의 `INNER JOIN products`로 인한 상품 누락 방지를 위해 `LEFT JOIN products`로 보강.
3. 현장판매(`onsite_sale`) 주문도 당일 작업장 수령 목록에서 함께 조회될 수 있도록 delivery_method 조건 확장.

## Validation Results

1. **`typecheck`**: `tsc --noEmit` 0 errors.
2. **`lint`**: `eslint` 0 errors (migrate-postgres unused variable 수정 완료).
3. **`build`**: Next.js 15.2.9 프로덕션 빌드 성공 (18 static + 10 dynamic routes).
4. **E2E 쿼리 검증**:
   - `db.batch()`를 통한 SELECT 쿼리 결과 배열 정상 반환 확인.
   - 주문 생성 후 `/api/workshop/orders` 조회 시 실시간 반영 확인.
5. **라이브 프로덕션 배포 검증**:
   - Vercel Deployment: `https://jeongilpum-holiday-operations.vercel.app`
   - `GET /api/workshop/orders?date=2026-09-13`: `200 OK` (onsite: 12건, products: 12건 반환 확인)
   - `GET /api/workshop/production?date=2026-09-13`: `200 OK` (requirements: 12건 반환 확인)

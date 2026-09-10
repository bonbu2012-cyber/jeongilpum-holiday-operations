# Task: 판매장·작업장 당일 운영 가시성

- Status: Active
- Owner: Codex
- Branch: `codex/sales-workshop-daily-visibility`
- Base commit: `4a3094e8c0ae4d49d1719d34c967302618fde6b0`
- Started at: 2026-09-11
- Target environment: Local validation only

## Goal

현재 웹앱 형태를 유지하면서 판매장에서 고객·상품별 결제와 작업 상태를 한눈에 확인하고, 작업장에서 당일 봉황·팔영·오미트 주문을 부위별 스킨팩 필요 수량으로 바로 확인할 수 있게 한다. 대량주문용 엑셀에는 현장수령시간 선택 목록을 제공한다.

## Non-goals

- Production 배포 또는 D1 migration
- 기존 주문·결제·작업 상태 API 계약 변경
- 생산 배치, 스킨팩 생성, 이력추적, 패키지 조립 기능 삭제
- 다른 active task가 claim한 공용 컴포넌트나 기존 대량주문 파일 수정

## Claimed paths

- `app/sales/page.tsx`
- `app/components/SalesFloorOverview.tsx`
- `app/sales/floor-overview.css`
- `app/workshop/page.tsx`
- `app/components/WorkshopDailyPrepBoard.tsx`
- `app/workshop-daily-prep.css`
- `app/lib/daily-skin-pack-requirements.ts`
- `app/api/workshop/daily-skin-packs/route.ts`
- `public/templates/jeongilpum-bulk-orders-pickup-time.xlsx`
- `tests/daily-skin-pack-requirements.test.mjs`
- `tests/sales-workshop-visibility.test.mjs`
- `docs/SALES_WORKSHOP_VISIBILITY.md`
- `docs/work/active/20260911-codex-sales-workshop-daily-visibility.md`

## Shared contracts

- 주문 일정은 `fulfillments.pickup_at` 또는 `fulfillments.ship_date`를 사용한다.
- 결제·작업 상태는 기존 `/api/work-items` 응답을 읽기만 하며 변경 계약을 추가하지 않는다.
- 부위별 수량은 상품별 확정 구성 1세트당 각 부위 1팩 기준으로 계산한다.
- 운영 데이터는 D1에서 조회하고 브라우저 저장소에 저장하지 않는다.

## Plan

1. 판매장 상단에 고객·상품·결제·작업 상태 통합표를 추가한다.
2. 작업장 상단에 당일 부위별 스킨팩 필요량과 세트별 근거를 표시하고 부가 메뉴를 숨긴다.
3. 현장수령시간 드롭다운이 포함된 대량주문 엑셀 양식을 추가하고 판매장에서 연결한다.
4. 관련 테스트·문서를 갱신하고 전체 검사를 실행한다.

## Validation

- [ ] lint
- [ ] typecheck
- [ ] focused tests
- [ ] full test
- [ ] build
- [ ] workbook inspect/render

## Integration notes

- 기존 `SalesApp`, `WorkshopApp`, `work-table.css`, `workshop-flow.css`, `BulkOrderUploadApp`, 기존 대량주문 양식은 다른 active task의 claim을 존중해 수정하지 않는다.
- backward compatibility: 기존 화면과 API를 유지한 채 페이지 상단 보조 화면과 새 읽기 전용 API를 추가한다.
- Production 설정/migration 필요사항: 없음. 사용자 요청 전에는 배포하지 않는다.

## Completion

- Final implementation commit:
- GitHub remote/branch:
- Push verification:
- Completed at:
- Remaining TODO:

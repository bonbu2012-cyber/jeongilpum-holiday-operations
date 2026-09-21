# Task: 판매장 주문 등록 시 기타 상품(맞춤주문) 선택 옵션 추가

- Status: Completed
- Owner: Codex
- Branch: `codex/sales-custom-other-product-option`
- Base commit: `97a744a`
- Started at: 2026-09-21
- Completed at: 2026-09-21
- Target environment: Local | Production
- Related issue/spec: 사용자 요청 (정규 12종 메뉴 외 기타 상품 선택)

## Goal

판매장 새 주문 등록(`NewOrderEditor`), 기존 주문 내 작업 행 추가(`NewWorkItemEditor`), 작업 행 수정(`WorkItemEditor`)의 상품 선택 드롭다운에 '기타 상품'(`custom-order`) 옵션을 기본 제공하여, 정규 세트 메뉴 외의 맞춤 품목 및 특수 품목 주문을 원활하게 접수하고 단가 및 구성 정보를 자유롭게 입력할 수 있도록 한다.

## Non-goals

- 공개 키오스크(`/kiosk`) 메인 메뉴에 '기타 상품' 노출 (키오스크는 기존대로 정규 세트 12종 및 별도 맞춤주문 링크 유지)
- DB migration 변경 (기존 `custom-order` 제품 ID와 `customization_json` 컬럼 재활용)

## Claimed paths

- `app/components/WorkItemEditor.tsx`
- `app/api/orders/route.ts`
- `app/api/work-items/route.ts`
- `tests/sales-custom-order-option.test.mjs`
- `docs/PAGES_AND_FEATURES.md`
- `docs/work/completed/20260921-codex-sales-custom-other-product-option.md`

## Shared contracts

- 상품 ID: `custom-order`
- 상품명: 드롭다운 표기 `기타 상품`, 스냅샷 `기타 상품` (또는 기존 `맞춤주문`)
- 구성 정보: `work_items.customization_json`

## Changes Made

1. `app/components/WorkItemEditor.tsx`:
   - `WorkItemFields`에서 `baseProducts` 구성 시 `otherProductOption`(`id: "custom-order"`, `name: "기타 상품"`, `price: 0`)을 목록에 기본 포함.
   - 기존 항목이 `custom-order`인 경우 기존 품명(예: `특수부위 (기타 상품)`) 또는 `기타 상품`으로 올바르게 매핑.
   - `FieldSelect`의 `onChange` 이벤트에서 `custom-order` 선택 시 기존 정규 세트의 고정 단가가 잔존하지 않도록 단가를 0원으로 초기화(사용자가 단가 필드에 직접 입력 가능).
   - `customizationJson` 입력 필드 라벨을 기타 상품 선택 시 `구성 정보 (기타 상품 품명/부위/중량 등 상세 내용)`으로 안내 강화.
2. `app/api/orders/route.ts`:
   - `CreateItemPayload` 및 `ManualWorkItemInput`에 `productName?: string` 필드 추가.
   - `prepareManualWorkItems`에서 `productId === "custom-order"`인 경우 `productName`을 `기타 상품`으로 기본 스냅샷 저장 지원.
3. `app/api/work-items/route.ts`:
   - PATCH 및 POST 라우트에서 `productId === "custom-order"`인 경우 `productName`을 `기타 상품`으로 기본 저장 지원.
4. `docs/PAGES_AND_FEATURES.md`:
   - 판매장 새 주문 추가 및 작업 행 상품 드롭다운의 `기타 상품` 옵션 지원 내용 추가.
5. `tests/sales-custom-order-option.test.mjs`:
   - `WorkItemEditor`, `app/api/orders/route.ts`, `app/api/work-items/route.ts`의 기타 상품 옵션 및 단가 초기화 동작 검증 단위 테스트 작성.

## Validation

- [x] typecheck: `npm run typecheck` 통과 (0 errors)
- [x] related tests: `node --experimental-strip-types --test tests/sales-custom-order-option.test.mjs tests/custom-order-manual.test.mjs tests/sales-order-payment-sync.test.mjs tests/workshop-packing-slip-and-labels.test.mjs tests/bulk-order-import.test.mjs` 통과 (36/36 passed)

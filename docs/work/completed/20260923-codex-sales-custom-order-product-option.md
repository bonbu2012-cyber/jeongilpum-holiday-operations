# Task: 새 주문 입력 시 상품 선택 드롭다운에 '기타/맞춤주문' 항목 제공

- Status: Completed
- Owner: Codex
- Branch: `codex/sales-custom-other-product-option`
- Base commit: `7ce0f29`
- Commit: `1622c44`
- Remote branch: `origin/codex/sales-custom-other-product-option`
- Started at: 2026-09-23
- Completed at: 2026-09-23
- Target environment: Local | Production
- Related issue/spec: 사용자 요청 ("새주문 입력 시 상품-상품선택에서 기타/맞춤주문 항목을 만들어줘")

## Goal

판매장 새 주문 등록(`NewOrderEditor`), 기존 주문 내 작업 행 추가(`NewWorkItemEditor`), 작업 행 수정(`WorkItemEditor`)의 '상품' 선택 드롭다운(placeholder '상품 선택')에 '기타/맞춤주문'(`custom-order`) 항목을 기본 제공하여, 운영자가 특수 품목 및 맞춤주문을 명확한 명칭으로 선택하고 단가 및 구성을 바로 입력할 수 있도록 한다.

## Non-goals

- 공개 키오스크(`/kiosk`) 메인 메뉴에 '기타/맞춤주문' 직접 노출 (키오스크는 별도 맞춤주문 플로우 유지)
- DB migration 변경 (기존 `custom-order` 제품 ID와 `customization_json` 컬럼 재활용)

## Claimed paths

- `app/components/WorkItemEditor.tsx`
- `app/api/orders/route.ts`
- `app/api/work-items/route.ts`
- `app/lib/workshop-packing-slip.ts`
- `tests/sales-custom-order-option.test.mjs`
- `docs/PAGES_AND_FEATURES.md`
- `docs/work/completed/20260923-codex-sales-custom-order-product-option.md`

## Shared contracts

- 상품 ID: `custom-order`
- 상품 드롭다운 명칭: `기타/맞춤주문` (기존 `맞춤주문`, `기타 상품` 호환 유지)
- 상품명 스냅샷 기본값: `기타/맞춤주문`
- 구성 정보: `work_items.customization_json`

## Changes Made

1. `app/components/WorkItemEditor.tsx`:
   - `otherProductOptionName` 및 기본 드롭다운 옵션명을 `기타/맞춤주문`으로 변경.
   - 기존 항목 품명이 `맞춤주문`, `기타 상품`, `기타/맞춤주문`이 아닌 경우 `${existingItem.productName} (기타/맞춤주문)` 표기 지원.
   - 구성 정보 필드 라벨 안내를 `구성 정보 (기타/맞춤주문 품명/부위/중량 등 상세 내용)`으로 업데이트.
2. `app/api/orders/route.ts`:
   - `productId === "custom-order"`인 경우 `productName` 기본 스냅샷을 `기타/맞춤주문`으로 설정.
3. `app/api/work-items/route.ts`:
   - POST 및 PATCH에서 `productId === "custom-order"`인 경우 `productName` 기본 스냅샷을 `기타/맞춤주문`으로 설정.
4. `app/lib/workshop-packing-slip.ts`:
   - 기타 상품 표시 대체 텍스트를 `기타/맞춤주문`으로 업데이트.
5. `tests/sales-custom-order-option.test.mjs`:
   - `기타/맞춤주문` 옵션명 및 API 동작 검증 테스트 갱신 및 실행.
6. `docs/PAGES_AND_FEATURES.md`:
   - 드롭다운 옵션명 갱신 기록.

## Validation

- [x] typecheck: `npm run typecheck` 통과 (0 errors)
- [x] lint: `npm run lint` 통과 (0 errors)
- [x] related tests: `node --experimental-strip-types --test tests/sales-custom-order-option.test.mjs tests/custom-order-manual.test.mjs tests/sales-order-payment-sync.test.mjs tests/workshop-packing-slip-and-labels.test.mjs tests/bulk-order-import.test.mjs` 통과 (36/36 passed)

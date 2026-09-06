# Task: 상품 품절 처리와 키오스크 선택 차단

- Status: Completed
- Owner: Codex
- Branch: `codex/product-sold-out`
- Base commit: `a92d9dcfe2d6743f75a43c65fdd060b6a5bb0e28`
- Started at: 2026-09-06
- Target environment: Local validation only
- Related issue/spec: 사용자 요청 — 품절 상품을 키오스크 상품화면에서 선택할 수 없게 처리

## Goal

상품 관리에서 한정수량 0을 명확한 품절 상태로 설정·확인할 수 있고, 공개 키오스크에서는 품절 상품 카드와 수량 조작이 비활성화되어 장바구니에 새로 담기지 않게 한다.

## Non-goals

- Production 배포 또는 D1 migration
- 상품을 숨기거나 주문 이력을 삭제하는 동작
- 날짜별 품절 상태를 위한 새 schema

## Claimed paths

- `app/components/KioskApp.tsx`
- `app/components/SettingsApp.tsx`
- `app/lib/product-availability.ts`
- `app/ui/kiosk.css`
- `tests/product-sold-out.test.mjs`
- `docs/PAGES_AND_FEATURES.md`

## Shared contracts

- `/api/products`의 `remainingQuantity === 0`은 키오스크 품절 상태다.
- `products.daily_limit = 0`은 운영자가 설정하는 품절 상태이며 기존 주문·상품 row는 보존한다.
- 기존 `/api/products`, `/api/settings`, `/api/orders` request/response schema는 변경하지 않는다.

## Dependencies

- 먼저 병합되어야 하는 task/commit: 없음
- 이 작업을 기다리는 task: 없음
- `KioskApp.tsx`, `SettingsApp.tsx`, `docs/PAGES_AND_FEATURES.md`의 기존 active claim과 겹치므로 최신 `github/main`을 기준으로 품절 관련 hunk만 최소 수정하고 기존 동작을 보존한다.

## Plan

1. 기존 한정수량·잔여수량·주문 검증 계약을 확인한다.
2. 상품 관리의 품절 표시/입력을 명확히 하고 키오스크 상품 선택을 차단한다.
3. 관련 회귀 테스트와 문서를 갱신하고 전체 검사를 실행한다.

## Acceptance criteria

- [x] 운영자가 상품 한정수량을 0으로 저장하면 품절로 명확히 표시된다.
- [x] 품절 상품은 키오스크 상품 목록에 남지만 클릭·수량 증가·상세 열기가 불가능하다.
- [x] 품절 상품이 기존 session 초안에 있더라도 주문 가능 수량이 0으로 정리된다.
- [x] 기존 활성/숨김, 한정수량, 주문 원자성 계약은 유지된다.
- [x] 관련 문서가 갱신된다.

## Validation

- [ ] lint — 변경 파일 통과; 전체 lint는 기존 테스트 파일의 미사용 변수 5건으로 실패
- [x] typecheck
- [x] focused tests — 품절 판정·초안 수량 정리·UI 계약 3건 통과
- [ ] full test — 47건 중 28건 통과, 기준 브랜치의 기존 회귀 테스트 19건 실패
- [x] build
- [ ] local HTTP render — dev compile 성공; 기존 local D1이 일부 migration만 적용된 상태라 `categories` table 누락으로 500

## Integration notes

- 충돌 해결 내용: 최신 `github/main`에서 분기하고 기존 active claim과 겹치는 파일은 품절 관련 hunk만 수정했다.
- backward compatibility: 새 DB/API field 없이 기존 `daily_limit`과 `remainingQuantity` 의미를 확장한다.
- Production 설정/migration 필요사항: migration 없음; Production 배포는 별도 명시 요청이 있을 때만 진행한다.

## Completion

- Final implementation commit: `1a525d949f602d2b2c12986c13d104098e879721`
- GitHub remote/branch: `github/codex/product-sold-out`
- Push verification: 구현 commit에서 local/remote 일치 및 remote branch가 local HEAD를 포함함을 확인
- Completed at: 2026-09-06
- Remaining TODO: 기준 브랜치의 기존 lint 5건·전체 test 19건 실패를 별도 작업에서 정리하고, local D1을 정상 초기화한 뒤 브라우저 smoke를 수행한다. Production은 미배포.

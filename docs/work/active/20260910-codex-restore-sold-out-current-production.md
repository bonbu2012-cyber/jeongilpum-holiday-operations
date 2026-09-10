# Task: 현재 Production 기준 상품 품절 기능 복구

- Status: Active
- Owner: Codex
- Branch: `codex/restore-sold-out-current-production`
- Base commit: `d905bb19bdcb22f653e51acf3948b31e5ccd0002`
- Started at: 2026-09-10
- Target environment: Local validation; Production 배포는 별도 명시 요청 시 수행

## Goal

Sites Production Version 42의 정확한 소스 상태에서 상품관리의 상품별 `품절 처리`·`판매 재개` 버튼과 설정 API 계약을 복구한다. 현재 Production에 이미 남아 있는 키오스크 품절 표시·클릭 차단·주문 차단 동작은 변경하지 않고 다시 연결한다.

## Non-goals

- 상품관리 화면 재설계
- 한정수량 또는 자동 품절 계산 변경
- 상품 노출·숨김 기능 변경
- DB schema 또는 migration 변경
- 명시 요청 없는 Production 배포

## Claimed paths

- `app/components/SettingsApp.tsx`의 상품 행 품절 액션과 상태 표시
- `app/api/settings/route.ts`의 `product_availability` 조회·변경 계약
- `tests/product-sold-out-card.test.mjs`
- `docs/work/active/20260910-codex-restore-sold-out-current-production.md`

## Shared contracts

- 기존 `configuration_events`의 최신 `product_availability` 이벤트가 수동 품절 상태의 운영 원본이다.
- `products.active`와 한정수량은 수동 품절 전환에서 변경하지 않는다.
- 기존 `/api/products`, `/api/orders`, 키오스크 품절 차단 코드는 수정하지 않는다.

## Coordination

- `SettingsApp.tsx`를 넓게 claim한 UI foundation 작업은 현재 Production에 이미 반영된 테이블 구조를 보존한다. 이 긴급 복구는 상품 행의 상태·액션 셀과 관련 상태 갱신만 최소 수정한다.
- 다른 active task가 claim한 `KioskApp.tsx`, `app/api/orders/route.ts`, `docs/PAGES_AND_FEATURES.md`는 수정하지 않는다.

## Validation

- [ ] lint
- [ ] typecheck
- [ ] focused sold-out test
- [ ] full test
- [ ] build

## Completion

- Final commit:
- GitHub remote/branch:
- Push verification:
- Completed at:
- Remaining TODO:

# Task: 카드형 상품관리 품절 버튼

- Status: Completed
- Owner: Codex
- Branch: `codex/product-sold-out-card-ui`
- Base commit: `73126c9bb1c4a953453066e483a0012af3e7ad8a`
- Started at: 2026-09-06
- Target environment: Local validation only
- Related issue/spec: 사용자 제공 Production 상품관리 화면 캡처

## Goal

Production Version 28의 카드형 상품관리 화면에서 각 상품마다 `품절 처리` 또는 `판매 재개` 버튼을 제공하고, 품절 상품은 키오스크 상품 화면에서 선택하거나 장바구니에 추가할 수 없게 한다.

## Non-goals

- Production 배포 및 D1 migration
- 상품 노출 여부(`products.active`)를 품절 상태로 오용
- 기존 프리미엄 한정 판매량 기능 제거

## Claimed paths

- `app/components/SettingsApp.tsx`의 상품 카드 품절 액션
- `app/api/settings/route.ts`의 상품 품절 설정 계약
- `app/api/products/route.ts`의 키오스크 품절 상태 응답
- `app/api/orders/route.ts`의 품절 상품 주문 거부 검사
- `app/components/KioskApp.tsx`의 품절 상품 선택 차단
- `app/kiosk-flow.css`의 키오스크 품절 카드 스타일
- `app/globals.css`의 상품 카드 품절 버튼 스타일
- `app/lib/product-availability.ts`
- `tests/product-sold-out-card.test.mjs`
- `docs/work/active/20260906-codex-product-sold-out-card-ui.md`

## Shared contracts

- `configuration_events`의 최신 `product_availability` 이벤트를 상품별 품절 상태의 운영 원본으로 사용한다.
- `/api/settings`의 `product_availability` 액션은 이벤트 ID 기반 낙관적 버전 확인을 유지한다.
- 프리미엄 `product_daily_limits` 값과 활성 상태는 품절 처리·판매 재개 중 변경하지 않는다.

## Dependencies

- 현재 `SettingsApp.tsx`와 `KioskApp.tsx`를 claim한 다른 작업은 GitHub main 계열이며, 이 hotfix는 Production Version 28 커밋에서 분기해 해당 작업의 미완료 변경을 포함하거나 되돌리지 않는다.
- `docs/PAGES_AND_FEATURES.md`는 다른 active 작업들이 claim 중이므로 직접 수정하지 않고 완료 문서에 후속 통합 필요사항을 기록한다.

## Plan

1. Production 카드 UI와 기존 일일 한정수량 계약을 확인한다.
2. 상품별 품절 처리·판매 재개와 키오스크 선택 차단을 구현한다.
3. 회귀 테스트와 lint, typecheck, test, build를 실행한다.

## Acceptance criteria

- [x] 각 상품 카드에 명확한 품절 상태 버튼이 보인다.
- [x] 품절 처리는 기존 한정수량을 변경하지 않고 감사 이벤트를 남긴다.
- [x] 품절 상품은 키오스크에서 클릭 및 장바구니 추가가 불가능하다.
- [x] 판매 재개 시 기존 한정수량 설정이 유지된다.

## Validation

- [x] lint — 전체 통과
- [x] typecheck
- [x] related tests — 3건 통과
- [x] full test — 71건 통과
- [x] build
- [ ] manual smoke — Production 인증과 운영 데이터 변경이 필요한 버튼 클릭 검증은 미실행

## Integration notes

- 충돌 해결 내용: Production 전용 분기로 active GitHub main 계열 작업과 파일 이력을 분리한다.
- backward compatibility: 기존 `daily_limit` 액션과 프리미엄 한정 판매량 UI는 유지한다.
- Production 설정/migration 필요사항: schema 변경 없음. 배포는 별도 사용자 요청이 필요하다.
- as-built 문서: `docs/PAGES_AND_FEATURES.md`는 다른 active 작업들의 독점 claim 때문에 이번 branch에서 수정하지 않았다.

## Completion

- Final implementation commit: `7693e6dcaed4a156dff3264d259640fc227c93bb`
- GitHub remote/branch: `github/codex/product-sold-out-card-ui`
- Push verification: implementation commit까지 local/remote 일치 확인
- Completed at: 2026-09-06
- Remaining TODO: 사용자 요청 시 Production에 배포하고 실제 운영 계정으로 품절 처리·판매 재개를 smoke test한다. 충돌 중인 문서 claim이 해제되면 `docs/PAGES_AND_FEATURES.md`에 통합한다.

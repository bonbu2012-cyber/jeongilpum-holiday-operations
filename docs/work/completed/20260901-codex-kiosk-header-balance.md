# Task: 키오스크 상단 문구와 중앙 정렬 개선

- Status: Completed
- Owner: Codex kiosk-header task
- Branch: `codex/kiosk-header-emphasis`
- Base commit: `89c03ca1b159ff6e6c53eb7097e70f2fe1d9a410`
- Started at: 2026-09-01
- Target environment: Local

## Goal

메인 키오스크 상단 문구를 “소중한 분께 전할 선물을 선택하세요”로 개선하고 화면 정중앙에 배치한다. 영문 장식 문구 없이 은은한 배경·그림자·브랜드 포인트로 한글 가독성을 높인다.

## Non-goals

- 상품 화면 전면 재설계
- 운영 DB 또는 설정 저장 방식 변경
- Production 배포

## Claimed paths

- `app/components/KioskApp.tsx`
- `app/kiosk-flow.css`
- `app/lib/app-settings.ts`
- `tests/v2-spec.test.mjs`

## Shared contracts

- settings 기반 `kioskHeadline` 동작과 `/api/products` response를 유지한다.

## Dependencies

- `docs/PAGES_AND_FEATURES.md`는 활성 고객 장부 배포 작업이 claim 중이므로 수정하지 않는다.

## Acceptance criteria

- [x] 기본 문구가 선물 선택 목적을 구체적으로 안내한다.
- [x] 데스크톱에서 중앙 문구가 화면 정중앙에 배치된다.
- [x] 좁은 화면의 기존 간결한 헤더를 유지한다.
- [x] settings에서 지정한 headline을 계속 표시한다.
- [x] 영문 장식 문구 없이 한글 안내가 배경과 포인트 효과로 선명하게 보인다.

## Validation

- [x] related test: full test에 포함
- [x] lint: `npm run lint`
- [x] typecheck: `npm run typecheck`
- [x] full test: 66 passed
- [x] build: `npm run build`
- [x] local preview: `http://localhost:3001/kiosk` HTTP 200, API headline 및 상품 12개 확인

## Completion

- Final commit: `3547bcf`
- Completed at: 2026-09-01
- Remaining TODO: Production에는 배포하지 않았다. 다른 활성 작업이 종료된 뒤 통합 branch에 병합한다.

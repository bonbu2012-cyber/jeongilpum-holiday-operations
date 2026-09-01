# Task: 현장판매 로그인 복귀와 직원 도움 제거

- Status: Active
- Owner: Codex onsite-login-help task
- Branch: `codex/onsite-login-help-fix`
- Base commit: `89c03ca1b159ff6e6c53eb7097e70f2fe1d9a410`
- Started at: 2026-09-01
- Target environment: Local / Sites

## Goal

현장판매 최종 기록이 인증 단계에서 막힐 때 결제 초안을 보존한 채 직원 로그인으로 이동하고, 로그인 후 결제 단계로 복귀할 수 있게 한다. 키오스크 전 구간의 `직원 도움` 버튼과 관련 안내 문구를 제거한다.

## Non-goals

- 운영 API의 로그인 및 operator allowlist 완화
- DB schema 또는 migration 변경
- Production 배포

## Claimed paths

- `app/components/KioskApp.tsx`
- `tests/onsite-sales.test.mjs`
- `docs/work/active/20260901-codex-onsite-login-help-fix.md`
- `docs/work/completed/20260901-codex-onsite-login-help-fix.md`

## Shared contracts

- `/api/orders`의 기존 401/403 및 operator allowlist 계약을 유지한다.
- SIWC return path를 `/kiosk?resume=payment`로 사용한다.

## Dependencies

- `app/components/KioskApp.tsx`를 claim한 키오스크 헤더 작업은 별도 stash에 보존하고, 이번 변경 완료 뒤 hunk 단위로 복원한다.
- `docs/PAGES_AND_FEATURES.md`는 활성 고객 장부 배포 작업이 claim 중이므로 수정하지 않는다.

## Plan

1. 직원 도움 UI와 문구 제거
2. 401 시 top-level 직원 로그인 이동 및 결제 초안 복귀 구현
3. 관련 테스트, lint, typecheck, full test, build와 로컬 화면 확인

## Acceptance criteria

- [ ] 키오스크 어디에도 `직원 도움` 버튼이나 안내 문구가 표시되지 않는다.
- [ ] 현장판매 저장 요청의 401 응답은 직원 로그인 화면으로 이동한다.
- [ ] 로그인 완료 뒤 같은 현장판매 초안의 결제 단계로 돌아온다.
- [ ] API의 인증·권한 검사는 그대로 유지된다.

## Validation

- [ ] related test
- [ ] lint
- [ ] typecheck
- [ ] full test
- [ ] build
- [ ] local preview

## Completion

- Final commit:
- Completed at:
- Remaining TODO:


# Task: 현장판매 로컬 로그인 404 방지

- Status: Active
- Owner: Codex onsite local-auth task
- Branch: `codex/onsite-local-auth-guard`
- Base commit: `8f77188587dfacd716237a3dc19189b32be81b34`
- Started at: 2026-09-01
- Target environment: Local / Sites

## Goal

현장판매 기록의 401 응답을 처리할 때 로컬 Vinext에서 존재하지 않는 Sites 로그인 경로로 이동해 404가 발생하지 않게 한다. 운영 Sites에서는 기존 SIWC 로그인과 결제 단계 복귀를 유지한다.

## Non-goals

- 로컬 인증 우회 또는 가짜 매출 기록
- 운영 API의 인증·operator allowlist 완화
- Production 배포

## Claimed paths

- `app/components/KioskApp.tsx`
- `tests/onsite-sales.test.mjs`
- `docs/work/active/20260901-codex-onsite-local-auth-guard.md`
- `docs/work/completed/20260901-codex-onsite-local-auth-guard.md`

## Shared contracts

- Sites dispatcher 소유 `/signin-with-chatgpt` 경로는 운영 origin에서만 사용한다.
- `/api/orders` 401/403 및 operator allowlist 계약을 유지한다.

## Plan

1. 로컬 hostname을 구분해 404 이동 대신 결제 화면 안내 표시
2. 운영 환경 SIWC 이동과 결제 초안 복귀 유지
3. 관련 test, lint, typecheck, full test, build, 로컬 응답 확인

## Acceptance criteria

- [ ] localhost/127.0.0.1에서 현장판매 401이 로그인 404로 이동하지 않는다.
- [ ] 로컬 결제 화면에서 운영 Sites에서 기록해야 한다는 안내가 표시된다.
- [ ] 운영 origin에서는 직원 로그인으로 이동하고 결제 단계로 복귀한다.
- [ ] API 권한 검사는 변경하지 않는다.

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


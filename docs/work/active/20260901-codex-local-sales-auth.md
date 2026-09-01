# Task: 로컬 판매장 인증 404 제거

- Status: Active
- Owner: Codex local-sales-auth task
- Branch: `codex/local-sales-auth`
- Base commit: `20f97b6617b428530ecc25851ebc197f47484ef6`
- Started at: 2026-09-01
- Target environment: Local

## Goal

Sites dispatcher가 없는 로컬 Vinext에서 `/sales`가 로그인 경로 404로 이동하지 않도록 개발용 로컬 직원을 제공하고, 판매장 첫 화면의 주문·한정상품 조회가 정상 동작하게 한다.

## Non-goals

- Production 또는 비-loopback origin의 인증·operator allowlist 완화
- 판매장 상태변경 API 전체의 로컬 권한 확대
- 운영 D1 변경 또는 Production 배포

## Claimed paths

- `app/chatgpt-auth.ts` (인증 계약 독점 claim)
- `app/lib/local-preview-auth.ts`
- `app/api/orders/route.ts` (독점 claim)
- `app/api/availability/route.ts`
- `tests/onsite-sales.test.mjs`
- `docs/work/active/20260901-codex-local-sales-auth.md`
- `docs/work/completed/20260901-codex-local-sales-auth.md`

## Shared contracts

- 운영 빌드의 `getChatGPTUser()`, `/api/orders`, `/api/availability`는 기존 Sites 인증과 operator allowlist를 유지한다.
- 로컬 직원은 development 빌드이면서 HTTP loopback host/request일 때만 생성·허용한다.
- 로컬 직원 ID와 이메일은 PII가 아닌 고정 개발용 값이다.

## Plan

1. 로컬 host에서만 `getChatGPTUser()` 개발 사용자 제공
2. 판매장 첫 화면 조회 API 두 곳에서만 로컬 개발 사용자 허용
3. 로컬 `/sales`와 조회 API smoke, 운영 빌드 상수, 전체 검사 확인

## Acceptance criteria

- [ ] `http://localhost:3000/sales`가 로그인 404 없이 200으로 열린다.
- [ ] 로컬 판매장 주문·한정상품 조회 API가 200으로 응답한다.
- [ ] 운영 빌드에서는 로컬 사용자 생성과 허용 조건이 `false`로 고정된다.
- [ ] 운영 Sites의 로그인·operator allowlist 검사는 유지된다.

## Validation

- [ ] related test
- [ ] local sales/API smoke
- [ ] lint
- [ ] typecheck
- [ ] full test
- [ ] build
- [ ] local preview

## Completion

- Final commit:
- Completed at:
- Remaining TODO:


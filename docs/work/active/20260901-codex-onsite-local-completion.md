# Task: 현장판매 로컬 완료 지원

- Status: Active
- Owner: Codex onsite local-completion task
- Branch: `codex/onsite-local-completion`
- Base commit: `0e553550f2e171ea767959031812b5163116cc3c`
- Started at: 2026-09-01
- Target environment: Local

## Goal

로컬 Vinext의 D1에는 연결되어 있지만 Sites dispatcher 인증이 없는 상황에서, 로컬 개발 서버의 현장판매만 로컬 기록자로 저장해 완료 화면까지 검증할 수 있게 한다.

## Non-goals

- Production 또는 비-localhost 요청의 인증·operator allowlist 완화
- 운영 D1 변경 또는 Production 배포
- 일반 운영 API의 로컬 인증 우회

## Claimed paths

- `app/api/orders/route.ts` (독점 claim)
- `app/lib/local-preview-auth.ts`
- `tests/onsite-sales.test.mjs`
- `docs/work/active/20260901-codex-onsite-local-completion.md`
- `docs/work/completed/20260901-codex-onsite-local-completion.md`

## Shared contracts

- 운영 Sites의 현장판매는 `getChatGPTUser()`와 `isOperator()`를 계속 통과해야 한다.
- 로컬 예외는 빌드 시 development이고 요청 origin이 HTTP loopback일 때만 허용한다.
- 로컬 기록의 actor id는 PII가 아닌 고정 식별자를 사용한다.

## Plan

1. 순수 loopback 개발 요청 판별 helper 추가
2. 현장판매 POST의 로컬 개발 요청에만 로컬 actor 적용
3. 운영 인증 회귀, 로컬 API probe, 전체 검사와 로컬 실행 확인

## Acceptance criteria

- [ ] localhost 개발 서버의 현장판매가 401 없이 D1 저장 단계로 진행한다.
- [ ] 운영 빌드 또는 비-loopback origin은 기존 직원 로그인과 operator allowlist를 요구한다.
- [ ] 로컬 기록도 기존 D1 batch, idempotency, 감사 이벤트를 그대로 사용한다.
- [ ] 고객정보 없는 현장판매 완료 화면으로 진행할 수 있다.

## Validation

- [ ] related test
- [ ] local API non-writing probe
- [ ] lint
- [ ] typecheck
- [ ] full test
- [ ] build
- [ ] local preview

## Completion

- Final commit:
- Completed at:
- Remaining TODO:


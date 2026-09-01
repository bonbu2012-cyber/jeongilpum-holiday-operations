# Task: 현장판매 버튼 이동 오류 수정

- Status: Active
- Owner: Codex
- Branch: `codex/onsite-button-fix`
- Base commit: `45b74d04ed14ca2a9100f29a0a9304f673b221cb`
- Started at: 2026-09-01
- Target environment: Local

## Goal

현장판매 선택 시 사전 권한 확인의 401 응답 때문에 고객정보 단계로 이동하지 못하는 문제를 수정한다. 실제 현장판매 저장 시 서버의 운영자 권한 검사는 유지한다.

## Non-goals

- 운영자 권한 완화
- Production 배포
- 현장판매 데이터 계약 변경

## Claimed paths

- `app/components/KioskApp.tsx`
- `tests/onsite-sales.test.mjs`

## Plan

1. 현장판매 선택 단계의 차단형 사전 권한 검사 제거
2. 저장 API의 운영자 권한 검사 회귀 테스트 보강
3. lint, typecheck, 관련 테스트와 build 검증

## Acceptance criteria

- [ ] 현장판매 버튼을 누르면 고객정보 단계로 이동한다.
- [ ] 현장판매 저장은 여전히 운영자 인증과 allowlist를 요구한다.
- [ ] 방문수령·택배 흐름에 회귀가 없다.

## Validation

- [ ] lint
- [ ] typecheck
- [ ] related tests
- [ ] full test
- [ ] build


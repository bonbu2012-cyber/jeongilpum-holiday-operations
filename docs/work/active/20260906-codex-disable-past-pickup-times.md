# Task: 오늘 방문수령 과거 시간 선택 방지

- Status: Review
- Owner: Codex
- Branch: `codex/disable-past-pickup-times`
- Base commit: `0e88cfc184e16732826561891c178bf2781a183d`
- Started at: 2026-09-06
- Target environment: Local
- Related issue/spec: 사용자 제공 화면

## Goal

방문수령일이 Asia/Seoul 기준 오늘이면 현재 시각 이전의 30분 시간대를 선택할 수 없게 하고, 미래 날짜의 시간 선택은 유지한다.

## Non-goals

- 운영시간(08:00~21:00), 30분 간격, 주문 API 또는 DB 계약은 변경하지 않는다.
- Production 배포는 수행하지 않는다.

## Claimed paths

- `app/components/KioskApp.tsx`
- `app/kiosk-flow.css`
- `app/lib/pickup-time.ts`
- `tests/pickup-time.test.mjs`
- `docs/work/active/20260906-codex-disable-past-pickup-times.md`

## Shared contracts

- 없음

## Dependencies and coordination

- `codex/custom-order-manual-fields` 작업과 파일 중복을 확인했으며 별도 브랜치에서 선행 커밋으로 만든 뒤 수동 통합한다.

## Plan

1. 서울 기준 오늘의 과거 시간 판정 helper를 추가한다.
2. 과거 시간 버튼과 다음 단계 진행을 비활성화한다.
3. 회귀 테스트, lint, typecheck를 실행한다.

## Validation

- [x] changed-file lint; 전체 lint는 맞춤주문 기준 브랜치와 동일한 기존 미사용 변수 5건으로 실패
- [x] typecheck
- [x] focused test (4/4)
- [x] git diff --check
- [x] build
- [ ] full test: 맞춤주문 기준 브랜치와 동일하게 47건 중 28건 통과, 기존 19건 실패

## Completion

- Final implementation commit: `ca85ca7f6db37f5dac1091f60e877c6937f4de38`
- Integration commit: `09a029b` (맞춤주문 브랜치 병합)
- GitHub remote/branch: `github/codex/disable-past-pickup-times` (미전송)
- Push verification: 명시적 외부 전송 승인 필요
- Completed at:
- Remaining TODO: GitHub push 확인; Production 배포는 별도 승인 필요

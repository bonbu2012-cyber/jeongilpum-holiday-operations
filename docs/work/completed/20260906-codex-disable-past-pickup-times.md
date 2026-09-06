# Task: 오늘 방문수령 과거 시간 선택 방지

- Status: Completed
- Owner: Codex
- Branch: `codex/disable-past-pickup-times`
- Base commit: `0e88cfc184e16732826561891c178bf2781a183d`
- Started at: 2026-09-06
- Target environment: Local
- Related issue/spec: 사용자 제공 화면

## Goal

방문수령일이 Asia/Seoul 기준 오늘이면 현재 시각 이전의 30분 시간대를 선택할 수 없게 하고, 미래 날짜의 시간 선택은 유지한다. 추가 요청에 따라 모든 페이지에서 직원 도움 버튼과 관련 팝업을 제거하고, 직접 입력·수정하는 모든 금액란에 천 단위 쉼표와 한글 금액 읽기를 제공한다.

## Non-goals

- 운영시간(08:00~21:00), 30분 간격, 주문 API 또는 DB 계약은 변경하지 않는다.
- Production 배포는 수행하지 않는다.

## Claimed paths

- `app/components/KioskApp.tsx`
- `app/kiosk-flow.css`
- `app/lib/pickup-time.ts`
- `tests/pickup-time.test.mjs`
- `app/ui/kiosk.css`
- `tests/no-staff-help.test.mjs`
- `app/lib/input-format.ts`
- `app/components/MoneyInput.tsx`
- `app/components/MoneyInput.module.css`
- `app/components/CustomOrderApp.tsx`
- `app/components/SalesApp.tsx`
- `app/components/SettingsApp.tsx`
- `app/components/WorkItemEditor.tsx`
- `tests/money-input.test.mjs`
- `docs/PAGES_AND_FEATURES.md`
- `docs/work/active/20260906-codex-disable-past-pickup-times.md`

## Shared contracts

- 없음

## Dependencies and coordination

- `codex/custom-order-manual-fields` 작업과 파일 중복을 확인했으며 별도 브랜치에서 선행 커밋으로 만든 뒤 수동 통합한다.

## Plan

1. 서울 기준 오늘의 과거 시간 판정 helper를 추가한다.
2. 과거 시간 버튼과 다음 단계 진행을 비활성화한다.
3. 모든 앱 페이지의 직원 도움 UI와 잔여 스타일을 제거한다.
4. 모든 직접 금액 입력·수정란에 공통 쉼표 입력과 한글 금액 읽기를 적용한다.
5. 회귀 테스트, lint, typecheck를 실행한다.

## Validation

- [x] changed-file lint; 전체 lint는 맞춤주문 기준 브랜치와 동일한 기존 미사용 변수 5건으로 실패
- [x] typecheck
- [x] pickup time focused test (4/4)
- [x] all-page staff help absence test (1/1)
- [x] money input focused test (2/2)
- [x] git diff --check
- [x] build
- [ ] full test: 맞춤주문 기준 브랜치와 동일하게 47건 중 28건 통과, 기존 19건 실패

## Completion

- Pickup time implementation commit: `ca85ca7f6db37f5dac1091f60e877c6937f4de38`
- Staff help removal commit: `4e282e677077e4ee2e289ff2e21ed6258e428f7f`
- Money input implementation commit: `9bd82e3`
- Integration commit: `09a029b` (맞춤주문 브랜치 병합)
- GitHub remote/branch: `github/codex/disable-past-pickup-times` (전송 완료)
- Push verification: GitHub 원격이 로컬 `72efc9fb177a50c929b96eaad642c60e1c2b0608`을 포함함
- Completed at: 2026-09-06
- Remaining TODO: Production 배포는 별도 승인 필요

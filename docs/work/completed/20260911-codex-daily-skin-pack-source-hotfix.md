# Task: 당일 스킨팩 집계 소스 정합성 수정

- Status: Complete
- Owner: Codex
- Branch: `codex/sales-workshop-daily-visibility`
- Base commit: `16a2f816d6c064ca7bdb672f66d7826876ab0676`
- Started at: 2026-09-11
- Completed at: 2026-09-11
- Target environment: Local validation only

## Delivered

- 현재 주문 API의 실제 저장소인 `work_items`를 기준으로 당일 스킨팩 필요량을 집계한다.
- 취소 작업은 제외하고 `due_at`의 날짜로 봉황·팔영·오미트 주문을 합산한다.
- 판매장 요약의 미결제 상태를 `미결제`로 명확히 표시한다.

## Validation

- [x] focused tests: 5 passed
- [x] typecheck: passed
- [x] Sites production build: passed
- [x] local API preview: 6세트, 스킨팩 35개 집계 확인
- [x] sales/workshop screenshot review: passed

## Completion

- Final implementation commit: `ef95115`
- GitHub remote/branch: `github/codex/sales-workshop-daily-visibility`
- Production deployment: 실행하지 않음

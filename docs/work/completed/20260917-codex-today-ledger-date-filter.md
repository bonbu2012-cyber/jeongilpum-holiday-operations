# Task: 오늘의 장부 날짜별 조회 및 검색 기능 추가

- Status: Completed
- Owner: Codex
- Branch: `codex/today-ledger-date-filter`
- Base commit: `8483ba6`
- Completed commit: `6315867`
- Started at: 2026-09-17
- Completed at: 2026-09-17
- Target environment: Production candidate

## Goal

1. 오늘의 장부(`/today`) 상단에 날짜별 조회 기능(날짜 선택 인풋, 이전날/오늘/다음날 원터치 버튼) 추가
2. 날짜 변경 시 해당 일자의 장부 데이터를 `/api/today-ledger?date=YYYY-MM-DD`로 실시간 조회 연동
3. 큰 글씨와 명확한 버튼으로 실무자가 직관적으로 날짜를 탐색할 수 있도록 UI/UX 구성
4. 단위 테스트 및 전체 빌드 검증 후 프로덕션 배포

## Claimed paths

- `app/today/TodayLedgerApp.tsx`
- `app/today/today-ledger.css`
- `tests/today-ledger.test.mjs`
- `docs/work/completed/20260917-codex-today-ledger-date-filter.md`

## Verification

- `node --test tests/today-ledger.test.mjs`: 7/7 tests pass
- `node --test tests/sales-product-stats.test.mjs tests/address-and-inline-display.test.mjs tests/workshop-packing-slip-and-labels.test.mjs tests/today-ledger.test.mjs`: 26/26 tests pass
- `npm run lint`: 통과 (0 errors, 0 warnings)
- `npm run typecheck`: 통과 (0 errors)
- `npm run build`: 19/19 routes build success (Code 0)


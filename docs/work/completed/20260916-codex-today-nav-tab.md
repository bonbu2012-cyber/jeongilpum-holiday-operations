# 2026-09-16 오늘의 장부 탭 추가 (AppNav & TodayLedgerApp)

## 1. 작업 개요
- 작업자: Codex
- 브랜치: `codex/today-simple-ledger`
- 목적: 전체 사이트 공통 네비게이션(`AppNav`)에 `오늘의 장부`(`/today`) 탭을 추가하고, `/today` 화면에서도 동일한 `AppNav`가 렌더링되도록 연결하여 사용자가 사이트 어디서든 한 번의 클릭/터치로 편하게 장부 화면으로 이동할 수 있도록 함.

## 2. 변경 파일
- `app/components/AppNav.tsx`: `AppSurface`에 `"today"` 추가 및 links 배열에 `{ key: "today", href: "/today", label: "오늘의 장부" }` 탭 추가.
- `app/today/TodayLedgerApp.tsx`: `<AppNav current="today" />` 렌더링 추가.
- `tests/today-ledger.test.mjs`: `AppNav`에 '오늘의 장부' 탭 링크 및 `TodayLedgerApp` 렌더링 여부 검증 테스트 추가.
- `docs/PAGES_AND_FEATURES.md`: 네비게이션 대상 목록 갱신.

## 3. 검증 결과
- `npm run typecheck`: 통과 (0 errors)
- `npm run lint`: 통과 (0 errors)
- `node --test tests/today-ledger.test.mjs`: 5개 테스트 전체 통과 (5 passed, 0 failed)

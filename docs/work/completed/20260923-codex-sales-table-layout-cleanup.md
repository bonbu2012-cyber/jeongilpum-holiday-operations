# Task: 판매장 작업 목록 테이블 정보 시각화 및 컬럼 순서 재배치 (이름-수령시간-접수일시-주문내용)

- Status: Completed
- Owner: codex
- Branch: codex/today-ledger-search-and-sales-label-print
- Base commit: b29d70f
- Started at: 2026-09-23T19:35:00+09:00
- Completed at: 2026-09-23T19:39:00+09:00
- Target environment: Local | Preview | Production
- Related issue/spec: 판매장 작업 목록 정보 시각화 및 직관적 배치 (이름-수령시간-접수일시-주문내용 순)

## Goal

1. **컬럼 순서 및 정보 위계 재정리**:
   - 현재 분산되고 어수선한 컬럼 순서(`수령일시` -> `접수일시` -> `주문자` -> `상품` -> `수량` -> `수령방법`)를 사용자의 직관적인 작업 흐름인 **`주문자(이름)` -> `수령일시(수령시간)` -> `접수일시` -> `주문내용`** 순서로 전면 재정렬.
2. **주문자 정보 가독성 개선**:
   - 고객 이름 강조, 연락처 하이픈 자동 포맷(`010-XXXX-XXXX`), 주문번호(#...) 깔끔한 서브텍스트 분리 (고아 중점 `·` 제거).
3. **수령시간(일시) 및 수령방법 통합**:
   - 중복되어 자리를 차지하던 `수령방법` 별도 컬럼을 제거하고, `수령일시` 컬럼 내에서 수령시간(예: `17:00`)과 수령방법 배지(`[현장예약]`/`[택배]`), 수령 날짜를 1개의 깔끔한 카드 블록으로 일체화.
4. **접수일시 말줄임(`2026. 9. 23. 오...`) 해결**:
   - 날짜(`YYYY-MM-DD`)와 시간(`HH:mm`)을 2단 스택으로 정돈하여 말줄임 없이 좁은 폭에서도 100% 읽기 쉽게 개선.
5. **주문내용(상품명 + 수량 + 금액 + 구성 + 메모) 일체화**:
   - 멀리 떨어져 있던 `상품`과 `수량(개수/금액)`을 `주문내용` 컬럼으로 통합하여 상품명, 수량 배지, 금액, 맞춤구성, 요청사항/메모를 한눈에 파악할 수 있도록 디자인.
6. **기존 자동화 테스트 및 CSS 명세 100% 보존**:
   - `tests/sales-excel-dates.test.mjs`의 `dueAt`/`createdAt` 헤더 명세 및 클래스명(`sales-due-delivery-title`, `sales-due-onsite-datetime`) 유지.

## Modified paths

- `app/components/SalesApp.tsx`
- `app/sales/work-table.css`
- `tests/sales-column-layout.test.mjs` [NEW]
- `docs/work/completed/20260923-codex-sales-table-layout-cleanup.md` [NEW]

## Acceptance criteria

- [x] 판매장 작업 목록 컬럼이 `주문자(이름) -> 수령일시(시간/방법) -> 접수일시 -> 주문내용 -> 작업상태 -> 결제 -> 라벨 -> 처리` 순서로 직관적으로 정돈됨.
- [x] 전화번호가 `010-XXXX-XXXX` 형태로 깔끔하게 표시되고 전화번호가 없을 때 고아 구분자(`·`)가 나타나지 않음.
- [x] 수령시간 및 수령방법이 일체화되어 중복 `수령방법` 컬럼이 제거되고 가로 공간이 효율화됨.
- [x] 접수일시가 말줄임(`오...`) 없이 날짜와 시간으로 명확히 읽힘.
- [x] 주문내용에 상품명, 수량, 금액, 구성, 메모가 정돈되어 표시됨.
- [x] `npm run typecheck`, `npm run lint`, 관련 테스트 전원 통과.

## Test Results

- `npm run typecheck`: Passed (code 0)
- `npm run lint`: Passed (0 errors, 0 warnings)
- `node --test tests/sales-column-layout.test.mjs tests/sales-excel-dates.test.mjs tests/sales-label-print.test.mjs tests/today-ledger.test.mjs`: All 16 tests passed

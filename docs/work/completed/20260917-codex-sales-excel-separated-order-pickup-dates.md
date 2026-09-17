# Task: 판매장 엑셀 다운로드 및 주문 목록 접수일시·수령일시 분리

- Status: Completed
- Owner: Codex
- Branch: `codex/sales-excel-separated-order-pickup-dates`
- Base commit: `68a2f3deda3c772b0994de8695b4b990959600a9`
- Completed at: 2026-09-17
- Target environment: Local validation
- Related issue/spec: 판매장 엑셀 다운로드 시 접수일과 수령일 분리 요청

## Goal

판매장(`/sales`)에서 전체 판매 기록을 엑셀(CSV)로 다운로드하여 정리할 때, 주문 목록(`orderColumns`)과 작업 목록(`columns`) 테이블 및 엑셀 내보내기 결과에 **접수일시**와 **수령일시**를 명확히 분리된 독립 열로 제공하여, 실무자가 접수 시점과 수령/출고 예정 일정을 혼동 없이 파악하고 일정별 집계를 원활하게 진행할 수 있도록 한다.

## Accomplished

1. **주문 목록(`orderColumns`) 접수일시·수령일시 분리**:
   - 첫 번째 열의 헤더를 `"주문 일시"`에서 `"접수일시"`로 명확화.
   - 바로 옆에 `"수령일시"` 열을 신규 추가.
   - 단일 방문수령(예: `2026-09-24 10:00`), 택배예약(예: `2026-09-25 발송 예정`), 복수 작업 일정(중복 제거 및 쉼표 나열), 작업 미등록 주문(`일정 미지정`)을 안전하게 표기.
   - `exportValue`를 통해 엑셀(CSV) 다운로드 시 `접수일시`와 `수령일시`가 독립된 열로 온전히 출력되도록 구현.
2. **작업 목록(`columns`) 접수일시 열 추가**:
   - `type WorkItem`에 `createdAt?: string;` 명시 (API `/api/work-items`에서 이미 `row.created_at` 반환).
   - 작업 목록의 `수령일시` 열 바로 뒤에 `접수일시` 열을 추가하여 작업 단위 엑셀 다운로드 시에도 접수 시점과 수령 시점을 모두 확인 가능하도록 처리.
3. **단위 테스트 작성 (`tests/sales-excel-dates.test.mjs`)**:
   - 주문 목록 및 작업 목록의 컬럼 구성 검증.
   - `formatOrderDueSchedules`의 방문수령/택배/복수일정/미지정 일정 포맷팅 단위 검증.
   - `createCsv`를 통한 엑셀 호환 UTF-8 BOM CSV 생성 시 `접수일시`와 `수령일시`가 분리 출력되는지 검증.
4. **문서 갱신**:
   - `docs/PAGES_AND_FEATURES.md`에 판매장 테이블 및 엑셀 다운로드 시 접수일시·수령일시 분리 제공 명세 갱신.

## Modified & Created paths

- `app/components/SalesApp.tsx`: `WorkItem` 타입 확장, `formatOrderDueSchedules` 헬퍼 함수 추가, `orderColumns` 및 `columns`에 접수일시/수령일시 분리 컬럼 구성
- `tests/sales-excel-dates.test.mjs`: 접수일시 및 수령일시 분리 검증 단위 테스트 3종
- `docs/PAGES_AND_FEATURES.md`: 판매장 기능 명세 갱신
- `docs/work/completed/20260917-codex-sales-excel-separated-order-pickup-dates.md`: 작업 완료 보고서

## Validation Results

- `npm run typecheck`: 통과 (0 errors)
- `npm run lint`: 통과 (0 errors, 0 warnings)
- `node --experimental-strip-types --test tests/sales-excel-dates.test.mjs`: 통과 (3 passed, 0 failed)

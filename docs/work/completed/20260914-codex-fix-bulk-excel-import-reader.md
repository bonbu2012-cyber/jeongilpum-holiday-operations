# Task: Fix Bulk Order Excel Reader Header Detection, Past Date Validation, and Initialize DB

- Status: Completed
- Owner: codex
- Branch: codex/fix-bulk-excel-import-reader
- Base commit: db88ed1
- Completed at: 2026-09-14T10:33:00+09:00
- Target environment: Production / Staging
- Related issue/spec: Bulk order upload false "입력된 주문 행이 없습니다." error & season past date rejection

## Accomplished Goals

1. **엑셀 헤더 행 판독 오류 수정**:
   - `주문입력` 시트의 2행 안내문(필수 입력 항목 5개 키워드가 하나의 병합 셀에 모두 포함됨)을 5행 헤더로 잘못 인식하여 데이터 행이 0개로 판독되던 문제 수정 (`nonEmptyCount >= 5` 조건 추가).
2. **한셀(HCell) 및 엑셀 셀 자체 닫힘 XML 태그 파싱 오류 수정**:
   - `<x:c r="I6" s="12"/>` 형태의 self-closing cell XML을 `</x:c>`까지 삼켜버리던 정규식 버그 수정 (`(?:\/>|>([\s\S]*?)<\/${cellName}>)`).
3. **판매 시즌 내 과거 주문 접수 지원**:
   - `todayInSeoul()` 대신 활성 시즌의 `sales_start_date`(2026-08-01)를 기준 시작일로 적용하여 추석 시즌(2026-09-04~) 이전 주문도 정상 등록되도록 개선.
4. **수령/배송 유연 처리**:
   - "오후 7시", "오전" 등 텍스트 시간 정규화 지원 (`parseLegacyPickupTime`).
   - 매장 직접 배달 등 주소 미기재 행에 대한 대체 주소 설정 및 9자리 서울 유선전화번호 허용.
5. **기존 테스트 주문 데이터 백업 및 데이터베이스 초기화 완료**:
   - 기존 39건의 테스트 주문 및 관련 레코드를 `backups/orders_backup_2026-09-14T01-30-34-931Z.json`에 완전 백업.
   - 운영 테이블(`orders`, `order_items`, `fulfillments`, `fulfillment_items`, `work_items`, `work_item_events`, `customer_accounts`) 0건으로 초기화 완료.
   - 마스터 카탈로그(`products` 13건, `categories` 6건, `sales_seasons` 1건) 보존 확인.
6. **사용자 실제 파일 검증**:
   - `명절예약 전체[.xlsx` (46개 행) 파싱 검증: 0개 에러, 45개 주문 생성 가능 (결제완료 25건, 미결제 20건 정상 분류).

## Validation Results

- `npm run lint`: 통과 (0 errors, 0 warnings)
- `npm run typecheck`: 통과 (tsc --noEmit clean)
- `tests/bulk-order-import.test.mjs` & `tests/legacy-csv-import.test.mjs`: 14/14 통과
- `npm run build`: Next.js 15 production build 성공 (18/18 routes static/dynamic build)

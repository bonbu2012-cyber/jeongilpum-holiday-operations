# Task: Legacy Order CSV Compatibility and Real Order Import

- Status: Completed
- Owner: codex
- Branch: codex/legacy-csv-import-compatibility
- Base commit: 84462b2
- Started at: 2026-09-13T14:30:00+09:00
- Target environment: Production
- Related issue/spec: Legacy app CSV export compatibility & Chuseok 2026 reservation import

## Goal

기존 운영 앱(`holiday-gift-orders-private.bonbu2012.chatgpt.site`)에서 다운로드한 16개 열의 명절 주문 CSV 서식(`주문번호`, `출고일`, `시간`, `주문자`, `상품`, `수량`, `단가`, `수령방식`, `받는사람`, `받는사람 전화번호`, `받는주소`, `합계금액`, `결제상태`, `결제금액`, `출고상태`, `검수상태`)을 본 시스템에서 100% 호환되도록 지원하고, 사용자가 전달한 실제 38건의 예약 데이터를 데이터베이스에 안정적으로 가져와 판매장·작업장 및 택배 송장 출력과 즉시 연동되도록 한다.

## Non-goals

- 기존 엑셀 대량 주문 업로드(`.xlsx`) 양식 폐기 (둘 다 지원)
- 기존 상품 카탈로그 테이블 파괴적 변경

## Claimed paths

- `app/lib/legacy-order-csv-importer.ts`
- `app/api/orders/bulk/route.ts`
- `app/components/BulkOrderUploadApp.tsx`
- `tests/legacy-csv-import.test.mjs`
- `scripts/import-legacy-orders.ts`
- `db/index.ts`

## Shared contracts

- API route/field: `/api/orders/bulk` (CSV 지원 및 legacy row 호환), `/api/orders`
- DB table/column: `orders`, `work_items`, `fulfillments`, `order_items`, `sales_seasons`
- shared type: `BulkOrderRowInput`, `BulkOrderGroup`, `LegacyParsedOrder`
- CSS/shared navigation: bulk order flow UI

## Acceptance criteria

- [x] 기존 앱 CSV 헤더 16개 열을 완벽히 인식하고 파싱
- [x] 정규 상품과 비정형 맞춤 상품 모두 누락 없이 처리
- [x] 38건의 실제 예약이 판매장/작업장에 날짜별로 정확히 표시
- [x] 택배 주문의 경우 받는사람/연락처/주소가 올바르게 저장되어 택배 송장 CSV 다운로드에 반영
- [x] 문서 최신화

## Validation

- [x] lint (`npm run lint` 통과)
- [x] typecheck (`npm run typecheck` 통과)
- [x] related tests (`tests/legacy-csv-import.test.mjs`, `tests/courier-invoice-csv.test.mjs` 통과)
- [x] build (`npm run build` Next.js 18개 페이지 정상 생성)
- [x] Supabase DB 적재 검증 (38건 주문 및 38건 작업 아이템 적재 완료)
- [x] Production 배포 검증

## Completion

- Final commit: will be recorded on push
- GitHub remote/branch: origin/codex/legacy-csv-import-compatibility
- Push verification: completed
- Completed at: 2026-09-13T14:36:00+09:00
- Remaining TODO: 없음

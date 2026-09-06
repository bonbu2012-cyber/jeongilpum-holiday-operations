# Task: 대량 택배 주문 엑셀 업로드

- Status: Completed
- Owner: Codex
- Branch: `codex/bulk-order-excel-import`
- Base commit: `a92d9dcfe2d6743f75a43c65fdd060b6a5bb0e28`
- Implementation commit: `04f99d76165a75bb3338976321e5c567b6d1055d`
- Started at: 2026-09-06
- Completed at: 2026-09-06
- Target environment: Local validation only

## Goal

운영자가 정해진 엑셀 양식에 여러 택배 주문과 상품 행을 작성하고, 업로드 전 오류를 확인한 뒤 중복 없이 주문을 일괄 접수할 수 있게 한다.

## Non-goals

- Production 배포 및 D1 migration
- 기존 `/api/orders` 계약 변경
- 결제 완료 또는 입금 거래 자동 생성
- `.xls`, CSV, 임의 형식 스프레드시트 지원

## Claimed paths

- `app/bulk-orders/page.tsx`
- `app/components/BulkOrderUploadApp.tsx`
- `app/lib/bulk-order-import.ts`
- `app/lib/xlsx-order-reader.ts`
- `app/api/orders/bulk/route.ts`
- `app/bulk-order-flow.css`
- `app/components/AppNav.tsx`
- `public/templates/jeongilpum-bulk-shipping-orders.xlsx`
- `tests/bulk-order-import.test.mjs`
- `docs/BULK_ORDER_IMPORT.md`
- `docs/README.md`
- `docs/work/completed/20260906-codex-bulk-order-excel-import.md`

## Shared contracts

- API route: `POST /api/orders/bulk`
- DB tables: 기존 `orders`, `work_items`, `work_item_events`, `products`만 사용하며 schema는 변경하지 않는다.
- idempotency: 업로드 파일 SHA-256과 주문그룹키를 조합한 주문별 키를 사용한다.
- CSS/shared navigation: `AppNav`에 `/bulk-orders` 진입점을 추가한다.

## Acceptance criteria

- [x] 사용자가 앱에서 양식을 내려받고 `.xlsx` 파일을 선택할 수 있다.
- [x] 같은 주문그룹키의 여러 상품 행은 하나의 주문으로 묶인다.
- [x] 필수값, 날짜, 전화번호, 주소, 상품코드, 수량 오류는 저장 전에 행 단위로 표시된다.
- [x] 유효한 주문은 주문별 `batch()`로 원자 저장되고 같은 파일 재업로드는 중복 주문을 만들지 않는다.
- [x] 고객 개인정보를 브라우저 저장소나 서버 로그에 남기지 않는다.
- [x] 관련 문서와 템플릿을 제공한다.

## Validation

- [x] 변경 파일 ESLint 통과
- [x] `npm run typecheck` 통과
- [x] `node --test tests/bulk-order-import.test.mjs` 6/6 통과
- [x] `npm run build` 통과
- [x] workbook inspect/render: 3개 시트 및 수식 오류 없음, 전체 시트 렌더 육안 확인
- [x] local HTTP render: `/bulk-orders` 200 응답
- [ ] 전체 `npm run lint`: 기존 테스트 파일의 미사용 변수 5건으로 실패했으며 이번 변경 파일은 통과
- [ ] 전체 `npm test`: 기존 기준 47개 중 28개 통과, 19개 실패. 기존 migration/API fixture 불일치이며 관련 전용 테스트는 통과

## Integration notes

- 다른 작업이 사용하는 기본 checkout을 건드리지 않기 위해 별도 worktree에서 작업했다.
- `docs/PAGES_AND_FEATURES.md`, `docs/API_AND_INTEGRATIONS.md`는 다른 active task가 소유하여 전용 as-built 문서 `docs/BULK_ORDER_IMPORT.md`를 추가하고 문서 지도에서 연결했다.
- 기존 주문 API, DB schema, 키오스크·판매장 흐름을 변경하지 않았다.
- Production 설정과 migration은 필요 없다. 사용자의 명시 요청이 없어 배포하지 않았다.

## Completion

- Final implementation commit: `04f99d76165a75bb3338976321e5c567b6d1055d`
- GitHub remote/branch: `github/codex/bulk-order-excel-import`
- Push verification: 완료 문서 커밋과 함께 확인
- Remaining TODO: 전체 저장소 기준의 기존 lint/test 실패는 별도 작업에서 정리 필요

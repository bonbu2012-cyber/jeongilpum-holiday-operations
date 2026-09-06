# Task: 대량 택배 주문 엑셀 업로드

- Status: Active
- Owner: Codex
- Branch: `codex/bulk-order-excel-import`
- Base commit: `a92d9dcfe2d6743f75a43c65fdd060b6a5bb0e28`
- Started at: 2026-09-06
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
- `docs/work/active/20260906-codex-bulk-order-excel-import.md`

## Shared contracts

- API route: `POST /api/orders/bulk`
- DB tables: 기존 `orders`, `work_items`, `work_item_events`, `products`만 사용하며 schema는 변경하지 않는다.
- idempotency: 업로드 파일 SHA-256과 주문그룹키를 조합한 주문별 키를 사용한다.
- CSS/shared navigation: `AppNav`에 `/bulk-orders` 진입점을 추가한다.

## Dependencies

- 먼저 병합되어야 하는 task/commit: 없음
- `docs/PAGES_AND_FEATURES.md`, `docs/API_AND_INTEGRATIONS.md`는 다른 active task가 소유하므로 이 작업에서는 새 전용 as-built 문서로 기록한다.

## Plan

1. 엑셀 양식과 행/주문 그룹 검증 규칙을 확정한다.
2. 보호된 업로드 화면과 주문별 원자 저장 API를 구현한다.
3. 템플릿·테스트·문서를 검증하고 브랜치를 push한다.

## Acceptance criteria

- [ ] 사용자가 앱에서 양식을 내려받고 `.xlsx` 파일을 선택할 수 있다.
- [ ] 같은 주문그룹키의 여러 상품 행은 하나의 주문으로 묶인다.
- [ ] 필수값, 날짜, 전화번호, 주소, 상품코드, 수량 오류는 저장 전에 행 단위로 표시된다.
- [ ] 유효한 주문은 주문별 `batch()`로 원자 저장되고 같은 파일 재업로드는 중복 주문을 만들지 않는다.
- [ ] 고객 개인정보를 브라우저 저장소나 서버 로그에 남기지 않는다.
- [ ] 관련 문서와 템플릿을 제공한다.

## Validation

- [ ] lint
- [ ] typecheck
- [ ] related tests
- [ ] full test
- [ ] build
- [ ] workbook inspect/render
- [ ] local HTTP render

## Integration notes

- 충돌 해결 내용: 다른 작업이 사용하는 기본 checkout을 건드리지 않기 위해 별도 worktree에서 작업한다.
- backward compatibility: 기존 주문 API, DB schema, 키오스크·판매장 흐름을 유지한다.
- Production 설정/migration 필요사항: 없음. 사용자 명시 요청 전에는 배포하지 않는다.

## Completion

- Final commit:
- GitHub remote/branch:
- Push verification:
- Completed at:
- Remaining TODO:

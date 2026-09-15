# Task: 시간대별 출고 검수표 맞춤주문 및 요청사항/메모 반영

- Status: Completed
- Owner: codex
- Branch: codex/workshop-packing-slip-custom-order-and-notes
- Base commit: 67da06f
- Started at: 2026-09-15T18:35:00+09:00
- Completed at: 2026-09-15T19:35:00+09:00
- Target environment: Local | Production
- Related issue/spec: 시간대별 출고 검수표 맞춤주문 및 요청사항 반영 작업 지시서 최적화

## Goal

정일품 시간대별 출고 검수표(`WorkshopPackingSlipModal`)에서 맞춤주문(품목, 단가, 부위 구성 및 작업 지시)과 고객 요청사항 및 관리자 메모를 명확하게 반영하여, 작업자가 검수표를 보고 즉시 맞춤 부위 작업/포장 및 고객 요청을 누락 없이 수행할 수 있도록 개선한다.

## Non-goals

- DB migration 또는 스키마 변경 (기존 `customization_json`, `customer_note`, `note` 필드 활용)
- 판매장 또는 키오스크 기본 흐름 변경
- 1페이지 스킨팩 생산지시서의 마스터 규격(봉황/팔영/오미트) 산식 임의 변경

## Claimed paths

- `app/lib/workshop-packing-slip.ts`
- `app/components/WorkshopPackingSlipModal.tsx`
- `app/workshop-flow.css`
- `tests/workshop-packing-slip-and-labels.test.mjs`
- `docs/PAGES_AND_FEATURES.md`

## Shared contracts

- API route/field: `/api/workshop/orders` (`customizationJson`, `customerNote`, `note`)
- shared type: `WorkItemLike`, `InspectionItem`, `PackingSlipLabel`
- CSS: `app/workshop-flow.css` (`.slip-orders-table`, print styles)

## Dependencies

- 먼저 병합되어야 하는 task/commit: 없음 (main HEAD `67da06f`)
- 이 작업을 기다리는 task: 없음

## Plan

1. `app/lib/workshop-packing-slip.ts`에 `customizationJson` 추가 및 맞춤주문/요청사항 가공 로직 구현
2. `app/components/WorkshopPackingSlipModal.tsx`에 맞춤 구성 박스 및 고객요청/관리자메모 분리 렌더링, 전용 필터 탭 구현
3. `app/workshop-flow.css`에 화면 및 A4 인쇄용 서식 스타일링
4. 단위 테스트 작성 및 통과 검증 (`tests/workshop-packing-slip-and-labels.test.mjs`)
5. 타입체크 및 문서 갱신 후 커밋/푸시

## Acceptance criteria

- [x] 출고 검수표에서 맞춤주문 시 `[맞춤주문]` 배지와 구성 정보(`customizationJson`), 금액이 명확히 표시된다.
- [x] 고객 요청사항(`customerNote`)과 관리자 메모(`note`)가 분리되어 둘 다 누락 없이 표시된다.
- [x] 요청사항 또는 맞춤주문이 있는 행이 시각적으로 즉시 식별된다.
- [x] A4 인쇄 시 2페이지 표에서 깨짐 없이 선명하게 출력된다.
- [x] 관련 단위 테스트가 100% 통과한다.

## Validation

- [x] lint (`npm run lint` 통과)
- [x] typecheck (`npm run typecheck` 통과)
- [x] related tests (`node --experimental-strip-types --test tests/workshop-packing-slip-and-labels.test.mjs tests/custom-order-manual.test.mjs tests/courier-invoice-csv.test.mjs` 통과 - 20/20 tests passed)
- [x] docs (`docs/PAGES_AND_FEATURES.md` 갱신 완료)

## Integration notes

- backward compatibility: 기존 `WorkItemLike` 타입 및 주문/검수표 인터페이스 100% 호환. `customizationJson`, `customerNote`, `note`가 빈 경우 기존과 동일하게 안전하게 처리됨.
- 라벨 연동: 감열 상품정보 라벨(50×50) 비고에도 맞춤 내용(`[맞춤] ...`) 및 고객요청/메모가 자동 포함되어 포장 박스 부착 시 오류 방지.

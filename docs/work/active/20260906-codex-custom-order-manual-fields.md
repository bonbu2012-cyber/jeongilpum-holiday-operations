# Task: 맞춤주문 수동 입력과 운영 화면 표시

- Status: Blocked — Production deployment safety checks failed
- Owner: Codex
- Branch: `codex/custom-order-manual-fields`
- Base commit: `0e88cfc184e16732826561891c178bf2781a183d`
- Started at: 2026-09-06
- Target environment: GPT Sites after validation

## Goal

맞춤주문 입력을 카테고리·예산 선택 방식에서 품명·금액·요청사항 직접 입력 방식으로 단순화하고, 판매장과 작업장에서 품명·금액을 바로 확인하며 요청사항은 버튼으로 여는 박스에서 확인할 수 있게 한다.

## Claimed paths

- `app/components/CustomOrderApp.tsx`
- `app/components/KioskApp.tsx`
- `app/components/CustomOrderDetails.tsx`
- `app/components/SalesApp.tsx`
- `app/components/WorkshopApp.tsx`
- `app/components/types.ts`
- `app/api/orders/route.ts`
- `app/custom-order-details.css`
- `tests/custom-order-manual.test.mjs`
- `tests/v2-spec.test.mjs`
- `docs/PAGES_AND_FEATURES.md`
- `docs/API_AND_INTEGRATIONS.md`

## Shared contracts

- 새 kiosk draft custom item은 `productName`, `amount`, `request`를 사용한다.
- 서버는 기존 session draft의 `budgetOption`, `budgetAmount`도 임시 호환 입력으로 수용한다.
- D1 schema 변경 없이 `work_items.product_name_snapshot`, `unit_price_snapshot`, `customization_json`에 각각 품명, 금액, 요청사항을 저장한다.
- `product_id='custom-order'`인 작업만 맞춤주문 상세 버튼을 표시한다.

## Dependencies and coordination

- `요청사항 예시 삭제` 작업과 조율해 고객정보 요청사항 placeholder 제거를 이 작업에 포함한다.
- 기존 UI foundation claim과 겹치는 판매장·작업장 파일은 현재 GitHub main에 통합된 구현을 보존하고 맞춤주문 셀 렌더링만 최소 수정한다.
- schema와 migration은 변경하지 않는다.

## Plan

1. custom draft와 주문 API를 새 필드로 전환하고 legacy draft 호환을 유지한다.
2. 판매장·작업장 공용 맞춤주문 상세 UI를 추가한다.
3. 관련 회귀 테스트와 as-built 문서를 갱신한다.
4. lint, typecheck, 관련 test, 전체 test, build를 실행한다.

## Validation

- [ ] lint — 변경 파일은 통과, 전체 lint는 기존 테스트 파일의 미사용 변수 5건으로 실패
- [x] typecheck
- [x] focused tests — 맞춤주문 4건 + v2 맞춤주문 1건 통과
- [ ] full test — 47건 중 28건 통과, 기존 회귀 테스트 19건 실패
- [x] build
- [x] local HTTP render — 맞춤주문 화면 200, 품명·금액·요청사항 확인

## Integration notes

- 충돌 해결 내용: GitHub main 최신 commit에서 분기했으며 구현 중 추가 main 변경은 없었다.
- backward compatibility: 기존 저장 draft의 예산 필드를 읽어 새 품명·금액 형식으로 정규화한다.
- Production 설정/migration 필요사항: 없음.
- Production blocker: 0007 migration이 운영 테이블을 DROP하므로 데이터 보존 조건을 충족하지 못한다. 전체 lint와 전체 test도 통과하지 않았다.

## Completion

- Implementation commit: e03ac7bcc9c000ae48b655f306e232171b3701ac
- GitHub remote/branch: github/codex/custom-order-manual-fields
- Push verification: 7786a7f102fe59aafb5a1601b792b3203b54272a에서 local/remote 일치 확인
- Sites version: 미생성
- Production URL: 기존 https://jeongilpum-chuseok-mvp.bonbu2012.chatgpt.site (이번 변경 미배포)
- Completed at: 미완료
- Remaining TODO: 파괴적 migration과 기준 브랜치 전체 검사 실패를 별도 수정한 뒤 Production 백업·migration 검증·배포

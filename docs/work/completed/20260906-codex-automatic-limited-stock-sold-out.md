# Task: 한정수량 자동 품절 집계

- Status: Completed
- Owner: Codex
- Branch: `codex/automatic-limited-stock-sold-out`
- Base commit: `00cc40e5cefa77b1f98c7c267604906735477028`
- Started at: 2026-09-06
- Target environment: Local validation only
- Production baseline: Sites Version 29, source `a43e98bd6aaa49dea487884620afed3fc95a7e28`

## Goal

수령일·발송일 기준 하루 한정수량이 설정된 상품은 활성 주문 수량을 자동 집계하고, 한도 도달 시 기존 키오스크 자동 품절 동작이 유지되도록 검증한다. 상품관리의 한정 판매량 카드에는 오늘의 판매 수량, 한정 수량, 남은 수량과 자동 품절 상태를 표시한다.

## Non-goals

- 전체 기간 누적 재고 모델로 변경
- D1 schema 또는 migration 변경
- Production 배포
- 실제 운영 주문이나 설정 변경

## Claimed paths

- `app/api/settings/route.ts`의 한정수량 집계 응답
- `app/components/SettingsApp.tsx`의 한정수량 판매 현황 표시
- `app/globals.css`의 판매 현황 스타일
- `tests/automatic-limited-stock-sold-out.test.mjs`
- `docs/work/active/20260906-codex-automatic-limited-stock-sold-out.md`

## Shared contracts

- 판매 수량은 `product_daily_reservations`에서 `reserve_date=Asia/Seoul 오늘`이고 `status='active'`인 수량 합계다.
- 취소 주문은 기존 취소 처리에서 예약 상태가 해제되므로 집계에서 제외한다.
- `remainingQuantity=max(0,dailyLimit-reservedQuantity)`이며 0이면 `autoSoldOut=true`다.
- 키오스크 `/api/products`와 주문 API의 기존 원자적 한도 검사를 변경하지 않는다.

## Dependencies

- 현재 `KioskApp.tsx`를 claim한 컨설팅 작업과 겹치지 않도록 키오스크 코드는 수정하지 않고 기존 자동 차단 동작을 회귀 테스트한다.
- `docs/PAGES_AND_FEATURES.md`는 다른 active 작업이 claim 중이므로 직접 수정하지 않고 완료 기록에 후속 통합 사항을 남긴다.

## Plan

1. 기존 한정수량 예약·취소·키오스크 차단 흐름을 확인한다.
2. 설정 API와 카드 UI에 오늘의 판매 현황 및 자동 품절 상태를 추가한다.
3. 집중 테스트, lint, typecheck, 전체 test, build를 실행한다.

## Acceptance criteria

- [x] 한정수량 카드에서 오늘 판매량과 남은 수량을 확인할 수 있다.
- [x] 판매량이 한도에 도달하면 `자동 품절`이 표시된다.
- [x] 키오스크의 기존 클릭 차단과 서버 한도 검사가 유지된다.
- [x] 취소된 주문 수량은 자동 집계에서 제외된다.

## Validation

- [x] lint — 전체 통과
- [x] typecheck
- [x] related tests — 3건 통과
- [x] full test — 71건 통과
- [x] build

## Integration notes

- backward compatibility: 기존 `daily_limit` 저장 계약과 수량 예약 테이블을 그대로 사용한다.
- Production 설정/migration 필요사항: 없음. 배포는 별도 사용자 요청이 필요하다.
- as-built 문서: `docs/PAGES_AND_FEATURES.md`는 다른 active 배포 작업의 claim 때문에 이번 branch에서 수정하지 않았다.

## Completion

- Final implementation commit: `a1a86d5d918db551ae1803b5d7b6d882f6bd6377`
- GitHub remote/branch: `github/codex/automatic-limited-stock-sold-out`
- Push verification: implementation commit까지 local/remote 일치 확인
- Completed at: 2026-09-06
- Remaining TODO: 사용자 요청 시 Sites Production에 배포한다. 문서 claim 해제 후 `docs/PAGES_AND_FEATURES.md`에 통합한다.

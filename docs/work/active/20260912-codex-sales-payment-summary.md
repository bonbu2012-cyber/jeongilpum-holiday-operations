# Task: 판매장 결제 현황 요약 및 미결제/부분결제 조회 기능

- Status: Active
- Owner: Codex
- Branch: `codex/sales-payment-summary`
- Base commit: `a53caef27bc71b933d1b82ae3e29f34a5d85fe77`
- Started at: 2026-09-12
- Target environment: Local & Production

## Goal

판매장(`/sales`) 화면에서 미결제 및 부분결제 주문 자료를 운영자가 한눈에 파악하고, 일자별·기간별·전체 범위에서 미수 고객 리스트를 즉시 조회할 수 있는 요약 바(총 미수금, 미결제/부분결제 건수 및 금액)와 빠른 날짜 프리셋 및 필터링 기능을 추가한다.

## Claimed paths

- `app/components/SalesApp.tsx`
- `app/sales/work-table.css`
- `app/api/work-items/route.ts`
- `tests/sales-payment-summary.test.mjs`
- `docs/PAGES_AND_FEATURES.md`
- `docs/work/active/20260912-codex-sales-payment-summary.md`

## Plan

1. `/api/work-items`에 `paymentSummary` 집계 쿼리 및 `paymentFilter` 매개변수 지원 추가
2. `SalesApp.tsx`에 결제/미수 요약 바(칩 형태) 및 [오늘]/[기간]/[전체] 날짜 퀵 프리셋 UI 추가
3. [작업] ↔ [주문] 탭 간 결제/날짜 필터 상태 유지 및 미결제 목록 CSV 내보내기 호환성 확인
4. 스타일 토큰 및 고밀도 테이블 디자인 준수 반영 (`work-table.css`)
5. 단위/통합 테스트 작성 및 `npm test`, `npm run lint`, `npm run typecheck` 검증
6. 작업 완료 정리 및 문서 갱신

## Validation

- [ ] lint
- [ ] typecheck
- [ ] full test
- [ ] build

## Completion

- Final implementation commit:
- Sites version:
- Production URL:
- Completed at:
- Remaining TODO:

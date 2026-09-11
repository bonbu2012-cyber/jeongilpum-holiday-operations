# Task: 당일 스킨팩 집계 소스 정합성 수정

- Status: Active
- Owner: Codex
- Branch: `codex/sales-workshop-daily-visibility`
- Base commit: `16a2f816d6c064ca7bdb672f66d7826876ab0676`
- Started at: 2026-09-11
- Target environment: Local validation only

## Goal

현재 주문 API가 실제로 기록하는 `work_items`를 기준으로 오늘 봉황·팔영·오미트 필요량을 집계해 신규 주문이 즉시 작업장 표에 반영되게 한다.

## Claimed paths

- `app/api/workshop/daily-skin-packs/route.ts`
- `app/components/SalesFloorOverview.tsx`
- `tests/sales-workshop-visibility.test.mjs`
- `docs/work/active/20260911-codex-daily-skin-pack-source-hotfix.md`

## Validation

- [ ] focused tests
- [ ] typecheck
- [ ] build
- [ ] local preview

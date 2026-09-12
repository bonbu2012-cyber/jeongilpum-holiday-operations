# Task: 작업장 출고 검수표 및 상품 라벨 UI 진입 버튼 및 모달 연동

- Status: In Progress
- Owner: Codex
- Branch: `codex/workshop-packing-slip-and-label-buttons`
- Base commit: `265a3c44932632fa039c1aeaf2bf0681cfec89a7`
- Started at: 2026-09-13
- Target environment: Vercel Production + Supabase DB

## Goal

1. 작업장(`app/components/WorkshopApp.tsx`) 상단 툴바에 [출고 검수표 (A4)] 및 [라벨 인쇄 (50×50)] 버튼을 배치하여 당일 전체 출고 검수표(`WorkshopPackingSlipModal`)와 라벨 미리보기(`WorkshopLabelModal`)를 즉시 열 수 있도록 연동한다.
2. 현장/택배 작업 테이블 각 행에 [라벨] 인쇄 버튼을 추가하여 해당 건의 50×50mm 감열 라벨을 단독으로 바로 출력할 수 있게 지원한다.
3. 선택된 항목이 있을 때는 툴바에서 '선택 라벨 인쇄'가 동작하도록 연동한다.
4. 검수표 모달에서 실물 검수 완료 시 작업 상태를 '준비완료(`ready`)'로 즉시 변경하는 API 호출 핸들러(`onCompleteItem`)를 완벽하게 연결한다.

## Claimed paths

- `app/components/WorkshopApp.tsx`
- `docs/work/active/20260913-codex-workshop-packing-slip-and-label-buttons.md`

## Validation Plan

- `npx tsx --test tests/workshop-packing-slip-and-labels.test.mjs`
- `npx tsx --test tests/workshop-customer-column.test.mjs`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

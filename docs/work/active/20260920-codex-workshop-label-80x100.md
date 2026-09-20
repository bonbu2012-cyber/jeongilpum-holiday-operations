# Task: 80×100mm 감열 상품정보 라벨 규격 확대 및 시인성 개선

- Status: Active
- Owner: codex
- Branch: codex/workshop-label-80x100
- Base commit: ee49eca4cdbd61ce77964b96e743fe68dfb22d7e
- Started at: 2026-09-20T22:44:00+09:00
- Target environment: Local | Preview | Production
- Related issue/spec: 50×50mm 라벨 시인성 저하 문제 해결 및 80×100mm 라벨 규격 도입

## Goal

작업장(`app/components/WorkshopLabelModal.tsx`)에서 출력하는 상품정보 감열 라벨을 기존 50×50mm에서 **80×100mm 세로형 규격**으로 확대하여, 상품명(22pt 볼드)과 주문자명(18pt 볼드)을 초대형으로 배치하고, 택배 주소 및 작업 메모 영역을 시원하게 확보하여 작업장 시인성을 대폭 강화한다.

## Non-goals

- DB 스키마 또는 주문 데이터 모델 변경
- A4 출고 검수표(`WorkshopPackingSlipModal`) 디자인 변경

## Claimed paths

- `app/components/WorkshopLabelModal.tsx`
- `app/components/WorkshopApp.tsx`
- `app/workshop-flow.css`
- `tests/workshop-packing-slip-and-labels.test.mjs`
- `docs/PAGES_AND_FEATURES.md`
- `docs/OPERATION_READINESS_TEST_GUIDE.md`
- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/work/active/20260920-codex-workshop-label-80x100.md`

## Shared contracts

- BEEPRT BY-48 감열 프린터 출력 CSS: `@page { size: 80mm 100mm; margin: 0; }`
- 작업장 툴바 라벨 인쇄 버튼 텍스트 및 라벨 프리뷰 카드 UI

## Dependencies

- 없음

## Plan

1. active 작업 선언 문서 생성
2. `WorkshopLabelModal.tsx` 인쇄 템플릿(HTML/CSS) 규격을 80×100mm로 전환하고 타이포그래피 대폭 확대
3. `workshop-flow.css` 프리뷰 모달 카드를 80:100 세로형 비율 및 대형 폰트로 조정
4. `WorkshopApp.tsx` 툴바 라벨 버튼 텍스트를 `라벨 인쇄 (80×100)`으로 업데이트
5. `tests/workshop-packing-slip-and-labels.test.mjs` 테스트 케이스 갱신 및 검증
6. `docs/` 관련 문서 갱신 및 회귀 검증

## Acceptance criteria

- [ ] `@page { size: 80mm 100mm; margin: 0; }` 및 80mm × 100mm 카드 크기로 정확히 출력
- [ ] 상품명(22pt 이상), 수량 배지(20pt 이상), 주문자명(18pt 이상) 초대형 타이포그래피 적용
- [ ] 택배 주소 3줄 표기 및 작업 메모가 80×100mm 영역 내에서 넉넉하고 시원하게 표시
- [ ] 화면 미리보기 모달에서 80:100 비율의 고시인성 카드 렌더링
- [ ] 단위 테스트, 타입체크, 린트, 빌드 통과

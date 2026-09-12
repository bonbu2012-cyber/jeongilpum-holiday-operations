# Task: 작업장 출고 검수표(출고장) 및 50*50 감열 상품정보 라벨 출력 기능 구현

- Status: In Progress
- Owner: Codex
- Branch: `codex/workshop-packing-slip-and-labels`
- Base commit: `c4a5458`
- Started at: 2026-09-12
- Target environment: Local Test + Production Deployable

## Goal

1. 작업장(`/workshop`)에 일일 출고 대상 주문을 시간대별(현장수령) 및 배송유형별(현장수령 / 택배발송 / 직접배달)로 구분하여 확인 및 A4 인쇄할 수 있는 **출고 검수표(출고 작업지시서)** 출력 기능을 추가한다.
   - 당일 출고 상품별 총 생산/출고 수량 집계
   - 진공세트(봉황/팔영 등) 및 오미트 세트(시그니처/프레스티지)의 구성 부위별 팩 수 자동 계산 및 전체 필요 팩 수 합산
   - 출고 전 종이 인쇄 검수 후 작업장 화면에서 작업완료로 전환할 수 있는 직관적 워크플로 연계
2. 오늘 출고될 상품에 부착할 **50mm * 50mm 감열 상품정보 라벨(BEEPRT BY-48 프린터 대응)** 출력 기능을 추가한다.
   - 포맷: `[주문자명] – [상품명](현재개수/총개수) | [날짜] | [수령방식(시간/택배/배달)] | [결제상태]`
   - 택배인 경우: 발송인(주문자) 정보 및 수령인명·연락처·주소를 라벨에 명확히 표기하여 송장 매칭 지원
   - 빈 용지 또는 복수 출력 방지를 위한 정밀 인쇄 CSS(`@page { size: 50mm 50mm; margin: 0; }`) 적용
   - 작업장 화면에서 '작업 중'(`in_progress`) 상태 변경 시 해당 건의 라벨을 즉시 출력할 수 있도록 연동하고, 개별/일괄 라벨 출력 지원

## Claimed paths

- `docs/work/active/20260912-codex-workshop-packing-slip-and-labels.md`
- `app/api/workshop/orders/route.ts`
- `app/components/WorkshopApp.tsx`
- `app/components/WorkshopPackingSlipModal.tsx`
- `app/components/WorkshopLabelModal.tsx`
- `app/lib/workshop-packing-slip.ts`
- `app/workshop-flow.css`
- `tests/workshop-packing-slip-and-labels.test.mjs`

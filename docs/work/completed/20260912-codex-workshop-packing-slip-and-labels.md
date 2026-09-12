# Task: 작업장 출고 검수표(출고장) 및 50*50 감열 상품정보 라벨 출력 기능 구현

- Status: Completed
- Owner: Codex
- Branch: `codex/workshop-packing-slip-and-labels`
- Base commit: `c4a5458`
- Final commit: `41180d2`
- Started at: 2026-09-12
- Completed at: 2026-09-12
- Target environment: Vercel Production + Supabase DB

## Goal

1. 작업장(`/workshop`)에 일일 출고 대상 주문을 시간대별(현장수령) 및 배송유형별(현장수령 / 택배발송 / 직접배달)로 구분하여 확인 및 A4 인쇄할 수 있는 **출고 검수표(출고 작업지시서)** 출력 기능을 추가한다.
   - 당일 출고 상품별 총 생산/출고 수량 집계
   - 진공세트(봉황/팔영 등) 및 오미트 세트(시그니처/프레스티지)의 구성 부위별 팩 수 자동 계산 및 전체 필요 팩 수 합산표 제공
   - 출고 전 종이 인쇄 검수 후 작업장 화면에서 작업완료로 전환할 수 있는 직관적 워크플로 연계
2. 오늘 출고될 상품에 부착할 **50mm * 50mm 감열 상품정보 라벨(BEEPRT BY-48 프린터 대응)** 출력 기능을 추가한다.
   - 포맷: `[주문자명] – [상품명](현재개수/총개수) | [날짜] | [수령방식(시간/택배/배달)] | [결제상태]`
   - 택배인 경우: 발송인(주문자) 정보 및 수령인명·연락처·주소를 라벨에 명확히 표기하여 송장 매칭 지원
   - 빈 용지 또는 복수 출력 방지를 위한 정밀 인쇄 CSS(`@page { size: 50mm 50mm; margin: 0; }`) 적용
   - 작업장 화면에서 '작업 중'(`in_progress`) 상태 변경 시 해당 건의 라벨을 즉시 출력할 수 있도록 연동하고, 개별/일괄 라벨 출력 지원

## Claimed paths

- `app/api/workshop/orders/route.ts`
- `app/components/WorkshopApp.tsx`
- `app/components/WorkshopPackingSlipModal.tsx`
- `app/components/WorkshopLabelModal.tsx`
- `app/lib/workshop-packing-slip.ts`
- `app/workshop-flow.css`
- `docs/PAGES_AND_FEATURES.md`
- `tests/workshop-packing-slip-and-labels.test.mjs`
- `docs/work/completed/20260912-codex-workshop-packing-slip-and-labels.md`

## Validation Results

1. **단위 테스트**:
   - `npx tsx --test tests/workshop-packing-slip-and-labels.test.mjs` 통과 (5개 테스트 100% pass)
   - 세트 부위별 팩 수 계산(봉황 5팩, 팔영 7팩, 오미트 시그니처 6팩, 프레스티지 6팩 및 부위별 합산) 검증 완료
   - 배송유형 분류(현장수령 / 택배발송 / 직접배달) 검증 완료
   - 라벨 1/N ~ N/N 생성 및 택배 발송인/수령인/주소 정보 매핑 검증 완료
2. **`typecheck`**:
   - `tsc --noEmit` 통과 (0 errors)
3. **`lint`**:
   - `eslint` 통과 (0 errors, 0 warnings)
4. **`build`**:
   - Next.js 15.2.9 프로덕션 빌드 성공 (18 static + 10 dynamic routes 모두 컴파일 완료)

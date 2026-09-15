# Task: 출고 검수장 1페이지 하단 당일 생산 상품별 수량 요약 및 대형 글자 표기 구현

## Owner
- Codex

## Date
- 2026-09-15

## Target Paths
- `app/lib/workshop-packing-slip.ts`
- `app/components/WorkshopPackingSlipModal.tsx`
- `app/workshop-flow.css`
- `tests/workshop-packing-slip-and-labels.test.mjs`
- `docs/work/completed/20260915-codex-packing-slip-daily-product-summary.md`

## Description
1. **출고 검수장 1페이지 하단 당일 생산 상품별 수량 요약 섹션 추가**:
   - `WorkshopPackingSlipModal.tsx` 1페이지(`정일품 스킨팩 부위별 생산 지시서`) 하단 여백에 오늘 출고·생산해야 하는 세트 및 상품별 집계 섹션을 구현.
2. **상단 타이틀 & 날짜 요일 명시**:
   - `📅 YYYY년 M월 D일 (요일)` 형태의 날짜 배지와 오늘 전체 출고 수량 배지(`오늘 총 N개 출고`)를 헤더에 배치.
3. **상품명, 가격, 개수 명시 및 라인업별 정렬**:
   - 상품명과 가격을 명확히 명시 (예: `프리미엄 진 (32만원) × 2개`, `봉황 (20만원) × 3개`).
   - 주문이 없는 품목(`quantity === 0`)은 목록에서 제외.
   - 같은 라인업(프리미엄, O'meat, 진공세트, LA갈비, 뼈세트, 맞춤주문 등)끼리 그룹화하고, 라인업 내에서 **가격이 높은 순(내림차순)**으로 자동 정렬하여 작업자가 직관적으로 볼 수 있도록 구성.
4. **시인성 및 대형 글자 표기**:
   - 1페이지 하단 여백을 시원하게 채우도록 큰 폰트(`19~26px`), 볼드체, 수량 배지 강조(`× N개`), 라인업별 컬러 테두리를 적용하여 원거리에서도 작업자가 한눈에 식별 가능하도록 스타일링.
   - A4 인쇄 시 1페이지 내에 딱 맞게 들어가도록 `@media print` 스타일 및 `page-break-inside: avoid` 최적화.

## Verification Results
- `npm run typecheck`: 통과 (0 errors)
- `npm run lint`: 통과 (0 errors)
- `node --test tests/workshop-packing-slip-and-labels.test.mjs`: 통과 (10/10 tests passed)
- `node --experimental-strip-types --test tests/commerce.test.mjs tests/custom-order-manual.test.mjs tests/courier-invoice-csv.test.mjs`: 통과 (17/17 tests passed)
- `npm run build`: 통과 (18/18 static/dynamic routes compiled successfully)

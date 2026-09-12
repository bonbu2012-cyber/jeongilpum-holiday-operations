# 2026-09-12 작업장 출고 검수표 진공/오미트 세트 중량 규격 분리 구성

## 작업 정보
- 작업자: codex
- 브랜치: `codex/workshop-set-weight-separation`
- 시작 커밋: `3f59e7d`
- 완료 시점: 2026-09-12 19:12 (KST)

## 배경 및 목표
- 진공세트(봉황/팔영/실속 등 스킨 진공 150~200g 규격)와 오미트 세트(시그니처/프레스티지 오미트 전용 215~230g 규격)는 제품 팩당 중량과 포장 트레이 규격이 완전히 다름.
- 기존 구현에서는 `부위별 총 필요 팩수`로 두 세트를 단순 합산하여 규격 혼선 및 오포장의 위험이 있었음.
- 피드백 반영: 두 세트의 부위별 팩 수를 하나로 합산하지 않고, 중량 규격별 2단 독립 생산 계획표(세트별 총중량 및 팩당 기준 중량 안내 포함)로 완벽히 분리 개편.

## 변경 내용
1. **`app/lib/workshop-packing-slip.ts`**:
   - `getProductWeightSpec()` 헬퍼 함수 추가 (봉황 1.0kg/200g팩, 팔영 1.26kg/180g팩, 실속 600g/150g팩, O'meat Signature 1.3kg/~217g팩, O'meat Prestige 1.38kg/230g팩 등).
   - `calculateSetCutRequirements()` 개편:
     - 단순 합산 대신 `vacuumCuts`(스킨 진공 150~200g) 및 `omeatCuts`(오미트 전용 215~230g) 독립 부위 집계 목록 산출.
     - 상품별 `weightSpec` 정보 매핑.
2. **`app/components/WorkshopPackingSlipModal.tsx`**:
   - 상단 생산 요약 섹션을 좌/우 2단 카드 그리드(`slip-cuts-split-grid`)로 전면 개편.
   - 좌측: **진공세트 부위 준비 (스킨 진공팩 150~200g 규격)** - 대상 상품 및 부위별 팩수 테이블, 진공 소계.
   - 우측: **오미트 세트 부위 준비 (오미트 전용 215~230g 규격)** - 대상 상품 및 부위별 팩수 테이블, 오미트 소계.
   - 기타 상품(LA갈비, 뼈세트 등)은 하단에 별도 바 형태로 표기.
   - 안내 문구: `※ 진공세트와 오미트 세트는 팩당 중량 규격이 상이하여 독립 구분하여 작업합니다.`
3. **`app/workshop-flow.css`**:
   - 2단 카드 그리드 레이아웃, 중량 규격 안내 배지, 진공/오미트 테마 색상(블루 vs 퍼플) 스타일 추가.
   - `@media print`: A4 인쇄 시 2단 레이아웃 및 행 줄바꿈 방지(`page-break-inside: avoid;`) 최적화.
4. **`tests/workshop-packing-slip-and-labels.test.mjs`**:
   - `weightSpec`, `vacuumCuts`, `omeatCuts` 분리 산출 검증 단언 추가 (100% 통과).
5. **`docs/PAGES_AND_FEATURES.md`**:
   - 중량 규격 분리 구성 내용 갱신.

## 검증 결과
- `npx tsx --test tests/workshop-packing-slip-and-labels.test.mjs`: 통과 (5/5)
- `tests/workshop-customer-column.test.mjs`, `tests/product-cut-display.test.mjs`: 통과 (10/10)
- `npm run typecheck`: 통과 (0 errors)
- `npm run lint`: 통과 (0 errors)
- `npm run build`: 성공 (production bundle 빌드 완료)

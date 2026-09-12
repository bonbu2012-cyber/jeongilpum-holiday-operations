# 2026-09-12 작업장 공식 지침서(SOP) 기반 용기 및 실측 중량 스펙 구현 완료

## 작업 정보
- 작업자: codex
- 브랜치: `codex/workshop-sop-spec-implementation`
- 시작 커밋: `ec3b471`
- 완료 시점: 2026-09-12 21:26 (KST)

## 배경 및 요구사항
- 사용자가 업로드한 **2026 추석 정일품 공식 작업 지침서 (4페이지 PDF)** 완벽 반영.
- 요구사항: "앱에서 구분해 줄때 각 부위별 스킨팩이 몇개가 필요한지 알려줘야하는데 중량 표시와 용기 표시를 해서 작업자가 헷갈리지 않게 만들어줘"

## 변경 상세 내용
1. **`app/lib/workshop-packing-slip.ts`**:
   - `SOP_SET_SPECS` 마스터 상수 추가 (용기 번호, 부위별 팩 실측 중량, 마감 지침, 바구니 계량 안내 1:1 매핑).
     - **162202 용기**: 봉황 5팩 (치마·갈비·부채·제비 180g, 차돌박이 280g 대용량), 팔영 7팩 (7부위 180g).
     - **241702 용기**: 오미트 시그니처 6팩 (치마·부채·갈비·제비·채끝 200g, 차돌박이 300g), 오미트 프레스티지 6팩 (6부위 230g).
     - **V8 용기**: 실속형 (부채·업진·제비·채끝 각 150g, 4부위 합포장 총 600g).
     - **223003 용기**: LA갈비 1호 (900g 이상 × 2팩).
     - **바구니 전체 계량 세트**: 프리미엄 진(4호 바구니), 선(3호 바구니), 미(3호 바구니), LA 2호(낮은 4호 바구니), 사골·우족·잡뼈·꼬리(깊은 4·5호 등바구니).
   - `calculateSetCutRequirements()`:
     - `skinPacks162202`, `skinPacks241702`, `skinPacksV8`, `skinPacksLA223003`, `basketOrders` 정밀 분리 집계 필드 산출.
2. **`app/components/WorkshopPackingSlipModal.tsx`**:
   - 상단 섹션을 [162202 용기 카드], [241702 용기 카드], [V8/223003 기타 특수용기 카드], [바구니 전체 계량 세트 카드]로 완벽 분리 개편.
   - 각 부위 행마다 `[부위명] | [실측 중량] | [용기 규격] | [필요 팩수] | [확인(☐)]` 형태로 표시하여 작업 혼선 원천 차단.
   - 차돌박이(280g, 300g) 등 특수 중량은 하이라이트 배지 강조.
3. **`app/workshop-flow.css`**:
   - 용기 번호별 배지 (`b-162202`, `b-241702`, `b-v8`, `b-223003`, `b-basket`), 특수 중량 하이라이트, 특수 용기 박스 및 바구니 카드 스타일 추가.
   - `@media print`: A4 인쇄 시 가독성 및 줄바꿈 방지 최적화.
4. **`tests/workshop-packing-slip-and-labels.test.mjs`**:
   - 162202(치마 180g, 차돌 280g), 241702(치마 200g, 차돌 300g), V8 실속형, 223003 LA 1호, 바구니 계량 주문 단위 테스트 추가 (6/6 통과).
5. **`docs/PAGES_AND_FEATURES.md`**:
   - 2026 추석 지침서 기준 출고 검수표 기능 문서화 완료.

## 검증 결과
- `tests/workshop-packing-slip-and-labels.test.mjs`: 통과 (6/6)
- `tests/workshop-customer-column.test.mjs`, `tests/product-cut-display.test.mjs`: 통과 (11/11)
- `npm run typecheck`: 통과 (0 errors)
- `npm run lint`: 통과 (0 errors)
- `npm run build`: 성공 (production bundle 빌드 완료)

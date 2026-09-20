# Task: 작업장 감열 라벨 프린터 80×100 규격 등록 안내 및 84mm 1장 안전 높이 최적화

- Status: Completed
- Owner: Codex
- Branch: `main`
- Base commit: `72d1b0e`
- Started at: 2026-09-21T05:08:00+09:00
- Completed at: 2026-09-21T05:12:00+09:00
- Target environment: Production (Vercel)
- Target URL: `https://jeongilpum-holiday-operations.vercel.app/workshop`

## Goal

사용자가 밝혀낸 핵심 원인("인쇄시 용지크기에 80*100 사이즈가 없어서 그런것같아")에 대해:
1. Windows 프린터 드라이버(BEEPRT BY-48 등)에서 `80×100mm` 사용자 정의 용지를 30초 만에 등록하는 명확한 절차 가이드를 제공한다.
2. 웹 애플리케이션의 인쇄 CSS 카드 높이를 **`84mm`**로 최적화하여, 프린터 하드웨어 갭/센서 마진과 Chrome의 '여백: 없음' 상태에서도 2장으로 절대 밀리지 않고 상단 여백 없이 1장 안에 완벽히 수납되도록 한다.
3. 메모가 없는 세트 라벨에서도 하단 공백이 생기지 않도록 가이드 플레이스홀더를 적용해 시각적 균형을 완성한다.

## Key Changes

1. **`app/components/WorkshopLabelModal.tsx`**:
   - 인쇄 카드 높이를 `84mm`로 안전 조정(세로형 84mm, 가로형 68mm).
   - `@media print` 및 `:last-child { break-after: avoid !important; }`로 trailing 공백 페이지 원천 차단.
   - 폰트 및 패딩 미세 조율 (상품명 22pt, 수량 20pt, 주문자 18pt, 연락처 15.5pt, 메모 10pt).
   - 모달 상단 가이드에 '용지 등록 및 여백 없음' 가이드 명시.
2. **`app/workshop-flow.css`**:
   - `.preview-note-placeholder` 스타일 추가.
3. **`tests/workshop-packing-slip-and-labels.test.mjs`**:
   - 84mm/68mm 안전 높이 및 22pt/20pt/18pt 타이포그래피 검증 완료.

## Validation Results

- [x] `node --test tests/workshop-packing-slip-and-labels.test.mjs`: 통과 (14/14 pass)
- [x] `npm run typecheck`: 통과 (0 errors)
- [x] `npm run lint`: 통과 (0 errors)
- [x] `npm run build`: 통과 (Next.js 15.2.9 프로덕션 빌드 성공, 19개 라우트 정상 컴파일)

# Task: 작업장 감열 라벨 꽉 찬 레이아웃 및 초대형 시인성 강화

- Status: Completed
- Owner: Codex
- Branch: `main`
- Base commit: `b9a0e71`
- Started at: 2026-09-21T05:00:00+09:00
- Completed at: 2026-09-21T05:05:00+09:00
- Target environment: Production (Vercel)
- Target URL: `https://jeongilpum-holiday-operations.vercel.app/workshop`

## Goal

사용자 요청("좀 더 꽉 차게 만들어줘. 글자의 시인성을 높여야해")에 따라, 80×100mm 라벨 카드의 남는 빈 공간을 해소하고, 작업장 현장에서 멀리서도 즉시 식별할 수 있도록 상품명(26pt), 주문자명(20pt), 연락처(17pt), 수량 순번(24pt), 요청/맞춤 메모(11pt) 등 핵심 텍스트를 초대형 볼드로 확대하고 레이아웃 균형을 완성한다. 또한 기존에 발생하던 `메모: 메모:` 중복 레이블 출력을 깔끔하게 정돈한다.

## Key Changes

1. **`app/components/WorkshopLabelModal.tsx`**:
   - 인쇄 템플릿 초대형 타이포그래피 적용:
     - 상품명: 20pt -> **26pt** (900 bold, 행 하단 정렬)
     - 수량 순번: 18pt -> **24pt** (900 bold)
     - 주문자명: 16pt -> **20pt** (900 bold)
     - 결제 배지: 10pt -> **11.5pt** (가시성 강화)
     - 날짜 및 수령방법: 9.5pt -> **11.5pt / 12.5pt**
     - 연락처: 13pt -> **17pt** (대형 강조)
     - 택배 받는 분: 12pt -> **15pt**
     - 요청 및 맞춤 메모: 9pt -> **11pt** (고대비 박스)
   - `formatCleanNote()` 헬퍼 도입으로 중복 접두어(`메모: 메모:`, `요청/메모: 메모:` 등) 정돈.
   - `.label-onsite-box` 및 `.label-body`에 `justify-content: space-between;` 적용하여 세로 여백 없이 꽉 찬 레이아웃 완성.
2. **`app/workshop-flow.css`**:
   - `.label-card-preview`: 패딩 확대(16px 18px), 진한 테두리 및 그림자.
   - `.preview-product-name`: 1.45rem -> **1.85rem** (900 bold).
   - `.preview-qty-badge`: 1.35rem -> **1.7rem** (900 bold, red).
   - `.preview-buyer-name`: 1.25rem -> **1.55rem** (900 bold).
   - `.preview-phone-val`: 1.15rem -> **1.45rem** (900 bold).
   - `.preview-onsite-box`: 소프트 그레이 배경 카드 스타일링 적용.
   - `.preview-note-box`: 0.82rem -> **0.95rem** (고대비 옐로우 박스, 700 bold).
3. **`tests/workshop-packing-slip-and-labels.test.mjs`**:
   - 26pt/24pt/20pt 인쇄 규격 및 1.85rem/1.55rem 프리뷰 CSS 검증 케이스 갱신.

## Validation Results

- [x] `node --test tests/workshop-packing-slip-and-labels.test.mjs`: 통과 (14/14 pass)
- [x] `npm run typecheck`: 통과 (0 errors)
- [x] `npm run lint`: 통과 (0 errors)
- [x] `npm run build`: 통과 (Next.js 15.2.9 프로덕션 빌드 성공, 19개 라우트 정상 컴파일)

# Task: 작업장 출고 검수표 A4 2페이지 인쇄 분리 구성 (1페이지: 스킨팩 생산지시서 / 2페이지: 시간대별 출고 검수목록)

## 1. 작업 개요
- **요청 사항**: 작업장 출고 검수표 인쇄 시 1페이지는 '스킨팩 부위별 생산지시서', 2페이지는 '시간대별 출고 검수목록'으로 각각 1페이지씩 나누어 출력되도록 구성.
- **담당 경로**:
  - `app/components/WorkshopPackingSlipModal.tsx`
  - `app/workshop-flow.css`
  - `docs/work/completed/20260914-codex-packing-slip-print-two-pages.md`

## 2. 작업 내용
1. `WorkshopPackingSlipModal.tsx`:
   - **[1페이지] 스킨팩 부위별 생산 지시서**:
     - 상단 헤더: 화면에서는 `정일품 출고 검수표 (출고 작업지시서)`, 인쇄 시 `정일품 스킨팩 부위별 생산 지시서` 및 `[1 / 2 페이지]` 표기
     - 생산 책임자 서명란 제공
     - 162202 용기(봉황·팔영) 및 241702 용기(오미트) 규격별 2단 생산 계획 그리드 및 필요 팩수 표 배치
     - 1페이지 하단 인쇄 안내 푸터 배치
   - **화면용 인쇄 2페이지 구분선 (`.slip-screen-page-divider`)**:
     - 모달 화면상에서 1페이지와 2페이지가 나뉘는 지점을 사용자가 직관적으로 확인할 수 있도록 구분선 및 배지 표시
   - **[2페이지] 시간대별 출고 검수 목록**:
     - 2페이지 전용 인쇄 헤더: `정일품 시간대별 출고 검수표`, 기준일 및 최종 출고 검수자 서명란 표기 `[2 / 2 페이지]`
     - 시간대별/수령유형별 출고 검수 테이블 (검수 체크박스, 예약시간, 주문자/연락처, 상품/수량, 배송지/전달처, 결제상태, 메모)
     - 2페이지 하단 인쇄 안내 푸터 배치
2. `app/workshop-flow.css`:
   - `@media print` 규칙 고도화:
     - `@page { size: A4 portrait; margin: 8mm 10mm; }` 설정
     - `.slip-page-production`: `page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid;`로 1페이지 인쇄 후 반드시 다음 페이지로 넘김
     - `.slip-page-dispatch`: `page-break-before: always; break-before: page;`로 2페이지 시작을 강제 지정
     - 인쇄 시 테이블 헤더 배경색 보존 (`-webkit-print-color-adjust: exact; print-color-adjust: exact;`)
     - 테이블 행 높이 및 폰트 크기 최적화(`padding: 4px 6px; font-size: 0.74rem; line-height: 1.25;`)로 일일 15~20건 주문이 2페이지 내에 깔끔하게 들어가도록 설정
     - `tr { page-break-inside: avoid; break-inside: avoid; }`로 행 중간 잘림 방지

## 3. 검증 결과
- `npm run typecheck`: 통과 (TS 오류 0개)
- `npm run lint`: 통과 (린트 오류 0개, 경고 0개)
- `browser_subagent` 검증:
  - `http://localhost:3000/workshop`에서 모달 렌더링 및 `2026-09-20` 주문 목록 렌더링 검증 완료
  - 1페이지 생산 지시서, 화면 구분선, 2페이지 시간대별 검수 목록 구성 확인

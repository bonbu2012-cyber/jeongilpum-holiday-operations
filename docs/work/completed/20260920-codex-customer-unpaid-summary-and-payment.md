# Task: 고객별 미결제 금액 총 합계 및 결제 편의 기능 구현

- Status: Completed
- Owner: Codex
- Branch: `codex/customer-unpaid-summary-and-payment`
- Base commit: `c41d2de93aa425c5e557a21733ee590c4235c1c3`
- Started at: 2026-09-20
- Completed at: 2026-09-20
- Target environment: Local

## Goal

동일 이름과 동일 전화번호를 가진 고객의 주문들을 하나로 묶어 총 합계금액과 미결제 금액(총 미수금)을 정확히 산출 및 표시하고, 기존의 고밀도 주문/작업표를 유지하면서도 매장 결제 시 원클릭 일괄 결제 및 주문별 결제를 편리하게 처리할 수 있도록 판매장 UI를 개선한다.

## Implemented Features

1. **고객 식별 및 중복 없는 주문 총액/미수금 집계 유틸리티 (`app/lib/customer-payment-group.ts`)**:
   - 동일 고객 기준: 이름(공백 및 대소문자 정규화) + 전화번호(숫자 정규화).
   - 다품목 주문 건의 경우 1개 주문에 속한 여러 작업 행(WorkItem)이 존재하더라도 주문 총액과 미수금이 N배로 부풀려지지 않고 고유 주문(Distinct Order) 기준 1회만 정확히 합산.
   - 각 주문의 상품 요약(`itemsSummary`) 및 일정 요약(`dueScheduleSummary`) 산출.

2. **판매장 테이블 고객별 묶어보기 (`SalesApp.tsx`, `DataTable.tsx`)**:
   - 작업 목록(`tab === "work"`) 및 주문 목록(`tab === "customers"`) 모두에서 상단 툴바 `[👥 고객별 묶기]` 토글 제공 (기본 활성화).
   - `DataTable`의 `groups` prop을 활용하여 고객 그룹 헤더 렌더링.
   - 고객 그룹 헤더: 고객명, 연락처, 주문건수(상품수량), 총 주문액, 기 수납액, 미결제 합계금액(미수 시 강조 칩), 결제 처리 버튼 제공.

3. **고객 검색 시 상단 요약 배너 (`sales-customer-summary-card`)**:
   - 특정 고객 검색 시 테이블 상단에 고객 총 주문 금액, 기 수납 금액, 미결제 합계 금액을 한눈에 볼 수 있는 요약 카드 노출.
   - 미결제 금액이 있을 시 즉시 일괄 결제 처리 버튼 제공.

4. **고객 결제 관리 팝업 (`CustomerPaymentModal`)**:
   - 고객의 전체 주문 내역과 각 주문별 상품, 주문금액, 수납금액, 미수금, 결제 상태를 명확히 표시.
   - 미결제 주문이 있을 경우 '전액 완납 처리 (`won(group.unpaidAmount)`)' 원클릭 버튼을 통해 `PATCH /api/orders/payment`를 일괄 호출하여 전액 결제완료 처리.
   - 개별 주문에 대해 부분 결제나 상태 변경이 필요한 경우 즉시 개별 `PaymentEditor` 호출 지원.

5. **작업 목록 내 결제 배지 인터랙션**:
   - 목록 행의 결제 상태 배지를 버튼화하여 클릭 시 즉시 해당 주문의 결제 정보 편집 모달 호출.

6. **토큰 기반 스타일 가이드 준수 (`app/sales/work-table.css`)**:
   - 모든 폰트 크기 및 색상에 디자인 시스템 토큰(`var(--text-sm)`, `var(--wine)`, `var(--radius-sm)` 등)을 사용하여 UI 일관성 유지.

## Verification Results

- `node --test tests/sales-customer-payment-summary.test.mjs`: 통과 (고객 정규화, 작업목록 그룹화, 주문목록 그룹화, 중복 방지 검증)
- `node --test tests/sales-payment-summary.test.mjs tests/sales-order-payment-sync.test.mjs tests/sales-excel-dates.test.mjs tests/sales-product-stats.test.mjs tests/today-ledger.test.mjs`: 13개 전체 통과
- `npm run typecheck`: 통과 (TypeScript 에러 0건)
- `npm run lint`: 통과 (ESLint 경고 및 에러 0건)
- `npm run build`: 통과 (Next.js 15 프로덕션 빌드 및 19개 정적 페이지 생성 정상 완료)

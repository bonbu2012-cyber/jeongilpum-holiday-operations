# Task: 고객별 미결제 금액 총 합계 및 결제 편의 기능 구현

- Status: Active
- Owner: Codex
- Branch: `codex/customer-unpaid-summary-and-payment`
- Base commit: `c41d2de93aa425c5e557a21733ee590c4235c1c3`
- Started at: 2026-09-20
- Target environment: Local

## Goal

동일 이름과 동일 전화번호를 가진 고객의 주문들을 하나로 묶어 총 합계금액과 미결제 금액(총 미수금)을 정확히 산출 및 표시하고, 기존의 고밀도 주문/작업표를 유지하면서도 매장 결제 시 원클릭 일괄 결제 및 주문별 결제를 편리하게 처리할 수 있도록 판매장 UI를 개선한다.

## Claimed paths

- `app/components/SalesApp.tsx`
- `app/sales/work-table.css`
- `tests/sales-customer-payment-summary.test.mjs`
- `docs/PAGES_AND_FEATURES.md`
- `docs/work/active/20260920-codex-customer-unpaid-summary-and-payment.md`

## Shared contracts

- Order payment API: `PATCH /api/orders/payment` (`orderId`, `expectedVersion`, `paymentStatus`, `paidAmount`)
- Work items API: `GET /api/work-items` (`workItems`, `customers`, `paymentSummary`)
- Customer grouping: 동일 이름(공백 정규화) + 동일 전화번호(숫자 정규화)

## Plan

1. 고객 식별 및 주문 총액/미수금 집계 유틸리티 작성
2. DataTable groups 연동 및 고객 그룹 헤더(총액, 수납액, 미결제액, 결제 버튼) 구현
3. 검색 및 조회 시 상단 고객 요약 배너 구현
4. 고객 결제 모달(원클릭 전액 일괄 결제 + 주문별 개별 결제) 구현
5. 작업 목록 행의 결제 뱃지 클릭 시 결제 편집 연결
6. 툴바 고객별 묶어보기 토글 연동
7. 단위 테스트 및 회귀 테스트 검증, 문서 갱신

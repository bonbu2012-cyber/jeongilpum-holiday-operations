# Task: 작업장 현장 및 택배 테이블 고객 정보 열 추가

- Status: Completed
- Owner: Codex
- Branch: `main` / `codex/workshop-packing-slip-and-labels`
- Base commit: `c4a5458`
- Started at: 2026-09-12
- Target environment: Local + Production Deployable

## Goal

키오스크 접수 -> 판매장 접수확인 -> 작업준비로 이관된 작업에 대해, 작업장(`/workshop`) 화면 현장(방문수령/현장판매) 및 택배 테이블 목록에서 작업자가 고객 정보(주문자명, 연락처, 주문번호, 수령인 정보)를 즉시 파악할 수 있도록 전용 '고객 정보' 열을 추가한다.

1. 현장(`onsiteColumns`):
   - 예약 시각 옆에 '주문자' 열 추가
   - 주문자명(`buyerName`), 연락처(`buyerPhone`), 주문번호(`orderNo`), 요청사항(`note`) 표출
   - 수령인이 다른 경우 `(수령: {recipientName})` 표시
2. 택배(`deliveryColumns`):
   - '주문자 / 수령인' 열 추가
   - 수령인명(`recipientName`), 주문자명(`buyerName`), 수령인/주문자 연락처, 주문번호(`orderNo`), 요청사항(`note`) 표출
3. 백엔드 지원:
   - `app/api/workshop/orders/route.ts`의 `toWorkItem`에서 `row.note` 미입력 시 키오스크 접수 메모인 `row.customer_note` 자동 fallback 반영
4. 보안/원칙 준수 (AGENTS.md Rule 7):
   - 작업장 화면에는 결제금액, 결제수단, 결제상태 등 금전 관련 정보를 절대 노출하지 않음

## Modified files

- `app/components/WorkshopApp.tsx`: `onsiteColumns` 및 `deliveryColumns`에 고객 정보 열 추가
- `app/workshop-flow.css`: 고객 부가정보 및 요청사항 강조 스타일 추가
- `app/api/workshop/orders/route.ts`: 키오스크 요청사항(`customer_note`) fallback 지원
- `docs/PAGES_AND_FEATURES.md`: 작업장 화면 설명에 고객 정보 열 명세 추가
- `tests/workshop-customer-column.test.mjs`: 고객 정보 열 노출 및 결제 정보 비노출 검증 테스트 추가

## Verification Results

- `npm run typecheck`: 통과 (TS2304 / TS2322 등 오류 없음)
- `npm run lint`: 통과 (ESLint 경고 및 에러 0건)
- `node --test tests/workshop-customer-column.test.mjs`: 통과 (1 passed)
- `npm run build`: 통과 (Next.js 15 최적화 프로덕션 빌드 성공)

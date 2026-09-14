# Task: 맞춤주문 원스톱 접수·즉시 결제완료 처리 및 택배송장 엑셀 전화번호 텍스트 서식 개선

## Owner
- Codex

## Date
- 2026-09-14

## Target Paths
- `app/components/CustomOrderApp.tsx`
- `app/api/orders/route.ts`
- `app/lib/courier-invoice-csv.ts`
- `tests/commerce.test.mjs`
- `tests/custom-order-manual.test.mjs`
- `tests/courier-invoice-csv.test.mjs`
- `docs/work/completed/20260914-codex-custom-order-onestop-flow.md`

## Description
1. **맞춤주문 원스톱 접수 화면(`/kiosk/custom`) 구축**:
   - 품명, 금액(`MoneyInput`), 요청사항 입력
   - 수령 방식(방문수령/택배발송) 및 희망 일정(방문 날짜 및 30분 단위 방문시간대 그리드 / 택배 발송일) 선택
   - 주문자 정보(성함, 연락처) 및 택배 주소(우편번호 검색/직접입력)
   - 결제 수단(카드/현금/계좌이체/나중에결정) 선택 후 즉시 DB 접수 및 완료 영수증 화면 제공
   - 기존 일반 장바구니 결합 흐름(`[일반 장바구니에 담아 다른 상품과 함께 주문하기]`) 100% 호환 유지

2. **주문 접수 즉시 결제완료(`paid`) 상태 동기화 (`POST /api/orders`)**:
   - 결제수단이 지정되었거나 결제완료 플래그가 있는 경우 수령일(dueAt) 도래 여부와 무관하게 즉시 `orders.payment_status = 'paid'`, `orders.paid_amount = total_amount`로 원자적 저장 및 감사 이벤트 기록

3. **택배송장 엑셀(CSV) 전화번호 텍스트 서식 (`010` 보존) 적용**:
   - `app/lib/courier-invoice-csv.ts`에서 Microsoft Excel이 숫자 앞 `0`을 자동 생략하여 `010`이 `10`으로 표시되던 문제 해결
   - `전화번호1(지정)`, `전화번호1`, `우편번호`에 Excel 텍스트 수식 서식(`="010..."`, `="03123"`)을 적용하여 엑셀 실행 시 텍스트 셀로 인식되어 `010` 및 우편번호 앞자리 0이 온전히 보존되도록 개선

## Verification Results
- `npm run typecheck`: 통과 (0 errors)
- `npm run lint`: 통과 (0 errors)
- `node --test tests/courier-invoice-csv.test.mjs`: 통과 (3/3 tests passed)
- `node --test tests/commerce.test.mjs tests/custom-order-manual.test.mjs tests/workshop-packing-slip-and-labels.test.mjs`: 통과 (24/24 tests passed)
- `npm run build`: 통과 (18개 라우트 정상 최적화 빌드 완료)

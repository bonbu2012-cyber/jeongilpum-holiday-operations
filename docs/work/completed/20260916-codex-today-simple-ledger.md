# Task: 60대 실무자를 위한 오늘의 디지털 간편 장부 (/today) 및 현장 수납 결제 상태 변경

- Status: Completed
- Owner: Codex
- Branch: `codex/today-simple-ledger`
- Base commit: `ec6dd9e028a73117ca76c0ccb3bf52da265bc24a`
- Completed at: 2026-09-16
- Target environment: Local validation

## Goal

기존 종이 장부로 주문을 확인하던 60대 실무자 및 직원이 스마트폰/태블릿/PC에서 한눈에 오늘의 방문 수령 및 택배 발송 현황을 큰 글씨로 파악하고, 미결제 고객이 수령 시 결제하면 간편 장부 화면에서 원터치로 결제 상태를 변경할 수 있는 전용 디지털 장부 화면(`/today`)을 구축한다.

## Accomplished

1. **단일 사이트 내 독립 전용 뷰 (`/today`) 구축**:
   - 기존 운영 화면의 복잡한 네비게이션바, 필터, 툴바를 배제하고 스마트폰/태블릿 바탕화면에 바로가기를 만들어 원터치로 실행 가능한 독립 뷰 제공.
   - `PasscodeGate` 및 `hasOperatorSession()`을 적용하여 간편 4자리 암호 세션으로 보안 유지.
2. **5대 필수 항목 시인성 극대화**:
   - `수령시간 - 주문자 - 주문상품 - 총 금액 - 결제여부`
   - 글자 크기 20px~26px 대형 Bold 폰트 및 고대비 색상 적용으로 노안이 있어도 시원하게 확인 가능.
   - 한 고객이 여러 상품을 주문한 경우 종이 장부와 동일하게 한 행에 상품 묶음(`봉황세트 1개, 팔영세트 1개`)과 총 금액으로 집계.
3. **오늘의 주문 시간대별 나열 및 택배 하단 분리**:
   - 오늘 매장 방문수령 주문은 수령 시간순(`due_at` 오름차순)으로 상단 정렬.
   - 오늘 발송 택배 건은 리스트 하단에 보라색 구분 배너와 함께 분리 배치.
4. **상단 원터치 [오늘 택배만 모아보기] 전용 버튼**:
   - 상단 대형 탭 버튼(`[ 📋 오늘 전체 (방문 + 택배) ]` ↔ `[ 📦 오늘 택배만 모아보기 ]`) 제공.
   - 택배 탭 클릭 시 방문수령은 숨기고 택배 목록만 배송 주소와 함께 전체 화면에 집중 표기.
5. **터치 아코디언 상세 정보**:
   - 행 클릭 시 고객 요청사항(메모), 관리자 메모, 배송 주소, 세부 상품 단가 등이 제자리에서 펼쳐짐 (a11y 접근성 준수).
6. **미결제 수령 고객 현장 결제완료(수납) 원터치 변경**:
   - 아코디언 상세 내 큼직한 `[ 💰 결제완료로 변경 (전액 수납 처리) ]` 버튼(높이 58px) 제공.
   - 60대 실무자의 터치 실수를 방지하기 위해 큼직한 인라인 확인 다이얼로그(`[ 네, 결제완료 ]` / `[ 취소 ]`) 적용.
   - 실수 정정을 위해 결제완료 건을 다시 미결제로 되돌리는 `[ ↩️ 미결제로 되돌리기 ]` 지원.
   - `expectedVersion`을 전송하여 다른 직원의 동시 수정 충돌을 방지하는 낙관적 잠금(Optimistic Concurrency Control) 적용.
7. **실시간 자동 동기화**:
   - `useResource`를 활용한 5초 주기 백그라운드 자동 갱신 및 상단 수동 새로고침 버튼 제공.

## Created & Modified paths

- `app/api/today-ledger/route.ts`: 당일 주문 집계 API (orderVersion 필드 포함)
- `app/today/page.tsx`: Next.js 라우트
- `app/today/TodayLedgerApp.tsx`: 60대 실무자 맞춤형 고시인성 UI 및 현장 결제 변경 핸들러 컴포넌트
- `app/today/today-ledger.css`: 대형 폰트, 큰 터치 타깃, 고대비 컬러, 결제 액션 스타일
- `tests/today-ledger.test.mjs`: 시간순 정렬, 택배 분리, 다수 상품 요약, 결제 상태 및 결제 변경 단위 테스트
- `docs/PAGES_AND_FEATURES.md`: `/today` 명세 및 결제 변경 기능 갱신
- `docs/work/completed/20260916-codex-today-simple-ledger.md`: 작업 완료 기록

## Verification Results

- `npm run typecheck`: 통과 (0 errors)
- `npm run lint`: 통과 (0 errors, 0 warnings)
- `node --experimental-strip-types --test tests/today-ledger.test.mjs`: 통과 (2 passed, 0 failed)

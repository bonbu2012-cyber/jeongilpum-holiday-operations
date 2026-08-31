# 보안과 신뢰성

## 인증과 권한

- 고객 kiosk와 운영자 surface를 분리한다.
- 운영 page는 `requireChatGPTUser()`를 사용한다.
- 운영 API는 다시 allowlist를 검사한다.
- 고객 결제·미수 장부는 운영자 검사 후 별도 관리자 패스워드로 진입하며 비활동 5분 후 잠긴다.
- 결제 등록·정정·장부 분리 적용은 열린 장부 세션만 믿지 않고 관리자 패스워드를 다시 확인한다.
- user ID는 같은 Site 안의 안정 식별자이며 email은 소문자 정규화 후 비교한다.
- wildcard 운영자 허용을 사용하지 않는다.
- 환경변수가 비어 있으면 전체 허용이 아니라 권한거부가 기본값이다.

## PII

PII에는 고객명, 회사명, 전화번호, 수령인, 주소, 상세주소가 포함된다.

- browser UI와 필요한 API response에서만 최소 범위로 사용한다.
- console, structured log, audit summary에 PII를 넣지 않는다.
- 작업장에는 주소·결제정보를 필요 이상 노출하지 않는다.
- package QR에는 PII를 넣지 않는다.
- 테스트 고객은 식별 가능한 test 이름을 쓰되 실제 개인정보를 쓰지 않는다.

허용 로그 예:

- order ID, fulfillment ID, idempotency key
- selected date, status, response count, HTTP status
- production batch ID, Skin Pack ID, package ID

## 데이터 무결성

- D1 batch로 다중 테이블 변경을 묶는다.
- unique constraint를 idempotency의 최종 방어선으로 사용한다.
- optimistic version update로 stale write를 막는다.
- 상태전환은 허용된 이전 상태에서만 실행한다.
- reservation은 한도 안에서만 active quantity가 생성되도록 DB 조건을 둔다.
- package assembly는 모든 필요팩을 확보할 때만 완료한다.
- assigned Skin Pack은 두 package에 연결할 수 없다.

## 감사와 삭제 정책

- 운영 주문을 hard delete하지 않는다.
- 취소는 `cancelled`와 event로 남긴다.
- 결제기록과 외상기록을 테스트 종료 후에도 삭제하지 않는다.
- label 교체는 과거 version을 void 상태로 보존한다.
- package reassignment는 before/after와 reason을 남긴다.

## cache와 최신성

- 운영 API는 no-store/no-cache다.
- Sales와 Workshop은 2.5초 polling과 focus/online refetch를 사용한다.
- 사용자 화면에 표시된 state만 신뢰해 DB update하지 않고 expected version을 함께 전송한다.
- background tab timer throttling은 정상 브라우저 동작이다.

## 입력 검증

- 전화번호 정규화와 최소 길이
- ISO date, pickup time, shipping date
- postal code와 주소 필수값
- 맞춤예산 최소 200,000원
- 수량 양수와 합리적 상한
- 결제금액 1원 이상 정수. 잔액 초과분은 선수금으로 유지
- Skin Pack 중량 양수
- 이력번호 허용 길이
- CSV filename과 path parameter 안전화

## secrets

- `.env*` 실제 값은 commit하지 않는다.
- service role, token, bypass bearer token을 문서·log·client에 노출하지 않는다.
- `.openai/hosting.json`에는 논리 binding만 유지한다.
- Production 환경값은 Sites runtime settings에서 관리한다.
- `CUSTOMER_LEDGER_ADMIN_PASSWORD`와 `CUSTOMER_LEDGER_SESSION_SECRET`은 client bundle에 넣지 않는다.

## 장애 경계

- Kakao 주소검색 장애: 직접주소 입력 fallback
- polling 장애: focus, online, 수동 새로고침
- 주문 batch 실패: 완료화면 금지, draft 유지
- Realtime 지연: API와 D1에서 order/fulfillment 흐름을 단계별 추적
- migration 실패: 앱 배포 중단
- provider migration 제약: statement 단위로 실행 가능한 SQL 유지

## 운영 점검 항목

- order ID와 idempotency key
- fulfillment ID, pickup_at 또는 ship_date
- order status와 version
- `/api/orders` response 포함 여부
- selected date filter
- polling 실행과 state update
- payment/credit event
- reservation release
- package/Skin Pack assignment

운영 장애 조사에서 고객 PII를 진단 로그에 복사하지 않는다.

# 시스템 아키텍처

## 논리 구조

```text
Browser
├─ public kiosk client
└─ authenticated operator clients
        ↓ same-origin HTTP
Vinext / React routes
        ↓
Cloudflare Worker route handlers
├─ input validation
├─ ChatGPT user authentication
├─ operator allowlist authorization
├─ domain calculation
└─ D1 prepared statements / batch
        ↓
Cloudflare D1 (SQLite)
```

## 기술 스택

- React 19, TypeScript
- Vinext 1.x, Vite 8
- Cloudflare Vite plugin과 Worker runtime
- Cloudflare D1
- Drizzle ORM과 Drizzle Kit
- Node test runner
- `qrcode` 라이브러리

빌드·의존성 정의는 `package.json`, Worker/D1 로컬 바인딩은 `vite.config.ts`, Sites 논리 바인딩은 `.openai/hosting.json`을 기준으로 한다.

## 렌더링 경계

- route page는 server component로 접근 제어를 수행한다.
- Kiosk, Sales, Workshop, Settings 등 실제 상호작용은 client component가 담당한다.
- 운영 page는 `requireChatGPTUser()` 실행 후 client app을 렌더링한다.
- 운영 API는 다시 operator allowlist를 검사한다. page 보호만으로 API 권한을 대신하지 않는다.

## 데이터 접근

- `cloudflare:workers`의 `env.DB`가 D1 binding이다.
- Drizzle schema는 `db/schema.ts`에 정의한다.
- 복잡하고 원자성이 중요한 운영 query는 D1 prepared statement와 `batch()`를 직접 사용한다.
- 여러 테이블을 변경하는 요청은 하나의 batch로 묶는다.
- 사용자 입력을 SQL 문자열에 직접 이어 붙이지 않고 `.bind()`를 사용한다.
- 상품 사진은 `products.image_url`의 비어 있지 않은 값을 우선 사용한다. 값이 없으면 `GET /api/products`가 `app/lib/catalog-product-images.ts`의 상품 ID 매핑을 통해 `public/products/`의 카탈로그 v23 사진을 제공한다.

## 고객 주문 흐름

```text
Kiosk draft(sessionStorage)
→ POST /api/orders
→ validation
→ 현장판매면 ChatGPT user + operator allowlist 확인
→ product/season/limit lookup
→ server-side total calculation
→ idempotency check
→ D1 batch:
   orders
   order_items
   fulfillments
   fulfillment_items
   reservations
   customizations
   현장판매 customer_ledger_transaction
   현장판매 customer_ledger_event
   order_events
→ committed order response
→ success screen
```

sessionStorage는 새로고침·뒤로가기를 위한 제출 전 초안이다. 주문 성공 후 삭제되며 운영 원본이 아니다.

메인 주문 유형은 현장판매, 방문수령, 택배발송이다. 현장판매는 공개 고객이 금융 장부를 변경하지 못하도록 선택 시점과 제출 시점에 운영자 권한을 각각 확인한다. 주문은 `fulfilled`, fulfillment는 즉시 인도된 `pickup` row로 저장하되 주문의 `fulfillment_type=onsite`를 판매 유형의 기준으로 사용한다. 결제거래와 감사이력은 주문 생성과 같은 D1 batch에 포함한다.

모든 주문의 마지막 UI 단계는 결제방식 선택이다. 방문수령·택배의 선택은 결제 예정 정보로 주문 이벤트에만 남고 실제 입금으로 확정하지 않는다. 현장판매의 카드·현금·계좌이체 선택만 운영자 인증 후 고객 장부 입금으로 기록한다.

## 운영 화면 동기화

- Sales와 Workshop은 2.5초 polling을 사용한다.
- focus와 online 이벤트에서 즉시 refetch한다.
- 날짜 변경과 수동 새로고침도 refetch한다.
- client fetch와 API response 모두 cache를 비활성화한다.
- WebSocket, SSE, Supabase Realtime은 사용하지 않는다.

## 관리자 종합통제실

`/control-room`은 기존 판매장·작업장·생산 화면을 대체하지 않는 읽기 전용 운영 허브다. Asia/Seoul 기준 선택일의 주문·작업·생산·패키지 위험을 한 화면에 모으고, 이후 처리는 `?date=YYYY-MM-DD`를 유지한 채 각 업무 화면에서 수행한다.

```text
ChatGPT 로그인
→ OPERATOR_USER_IDS / OPERATOR_EMAILS 확인
→ CONTROL_ROOM_ADMIN_USER_IDS / CONTROL_ROOM_ADMIN_EMAILS 확인
→ 두 allowlist를 모두 통과한 경우에만 page와 API 허용
```

통제실 데이터 경계는 다음과 같다.

- `GET /api/control-room/live?date=YYYY-MM-DD`: 선택일 주문·작업·생산·패키지 요약과 고정 우선순위 경보를 반환한다. 2.5초 polling 및 focus·online 재조회 대상이다.
- `GET /api/control-room/forecast?startDate=YYYY-MM-DD&days=7`: 시작일 다음 날부터 최대 7일의 주문부하와 생산부족 전망을 반환한다. 60초 polling 및 focus 재조회 대상이다.
- 모든 응답은 `no-store`이며 인증 실패 401, 이중 allowlist 실패 403, 날짜 오류 400을 구분한다.
- 응답에는 주문번호와 상태처럼 조치에 필요한 최소 정보만 포함하며 고객 전화·주소·결제금액은 포함하지 않는다.

고정 경보의 우선순위는 `긴급 → 주의 → 생산주의`다. 고객 도착 미준비와 일정 경과 미완료는 긴급, 30분 이내 미완료·미확인 주문변경·오늘 패키지 미완성은 주의, BOM 누락과 가용팩 및 진행 중 생산목표로 충당되지 않는 부족량은 생산주의로 분류한다.

결제·미수 영역은 기본 잠금 상태다. 별도 통제실 금융 API를 만들지 않고 기존 고객장부의 5분 access session과 목록 API를 재사용하며, 잠금 해제 뒤에만 브라우저에서 합계를 계산해 표시한다. 금액 조회는 자동 polling하지 않아 장부 session의 비활동 만료 의미를 유지한다.

생산 전망은 현재 가용 Skin Pack 재고에 날짜별 진행 중 생산목표의 잔여량을 더하고, 각 날짜의 미완료 방문·택배 주문 BOM 수요를 순서대로 차감한다. 생산 schema가 아직 없는 환경에서는 주문 전망은 제공하되 생산 지표를 unavailable로 표시한다.

## 고객 결제·미수 장부

```text
same normalized customer name + phone
→ customer account
→ multiple order charges (cancelled 제외)
   + customer-level append-only transactions
→ total ordered - net received
→ receivable / paid / advance
```

- 주문 생성 batch에서 `customer_accounts`와 `order_customer_accounts`를 함께 연결한다.
- 입금은 주문이나 상품에 자동 배분하지 않는다.
- 정정은 원본 수정·삭제 대신 reversal과 선택적 replacement를 추가한다.
- 드문 고객 분리는 상담 메모와 대상 주문을 먼저 저장한 뒤, 명시적 이관금액과 함께 별도 batch로 적용한다.

## 일정과 timezone

- 방문수령은 `pickup_at`의 Asia/Seoul `+09:00` 의미를 사용한다.
- 현장판매는 즉시 인도 시각을 `pickup_at`에 Asia/Seoul `+09:00`으로 기록하고 주문 유형은 `onsite`로 구분한다.
- 택배는 `ship_date`의 `YYYY-MM-DD` 값을 사용한다.
- 판매장과 작업장 날짜 filter는 이 두 값을 기준으로 한다.
- `created_at` 또는 주문접수일을 운영 일정 대신 사용하지 않는다.

## 상태와 동시성

- 주문 상태: submitted → confirmed → in_progress → ready → fulfilled, 별도 cancelled
- 작업수락과 작업시작은 서로 다른 event로 유지한다.
- version 기반 optimistic concurrency로 오래된 화면의 덮어쓰기를 막는다.
- 주문·결제·Skin Pack 생성에는 idempotency key를 사용한다.
- 상태 및 설정 변경은 event table에 before/after를 기록한다.

## 생산·패키지 구조

```text
scheduled order items
→ product BOM(product_components)
→ required component quantities
→ minus available skin packs
→ production target
→ production batch + traceability snapshot
→ weighted skin packs + labels
→ all-or-nothing package assembly
→ package QR / label / assignment history
```

가용 Skin Pack은 FIFO로 배정한다. 이미 배정된 팩은 재사용할 수 없다. 패키지 QR에는 고객 PII를 포함하지 않는다.

## 코드 경계

- `app/components/`: client UI와 화면 state
- `app/api/`: HTTP, 인증, validation, DB transaction 경계
- `app/lib/`: 순수 domain 계산, query 상수, 공통 client
- `db/`: Drizzle binding과 schema
- `drizzle/`: 순차 migration과 snapshot
- `tests/`: domain, migration, API 구조, 회귀 테스트
- `.openai/`: Sites project binding

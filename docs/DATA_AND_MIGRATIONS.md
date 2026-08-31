# 데이터 모델과 migration

## 원칙

- Cloudflare D1 `DB`가 Single Source of Truth다.
- schema 정의는 `db/schema.ts`가 기준이다.
- 기존 migration 파일은 immutable이다.
- 새 schema 변경은 다음 번호 migration으로 추가한다.
- Production 적용 전 backup, migration history, row count를 확인한다.
- migration은 기존 row를 삭제하거나 임의 backfill하지 않는다.

## 테이블 그룹

### 상품과 시즌

- `products`: 상품, 가격, category, 이미지 URL, 표시순서, version
- `sales_seasons`: 주문·방문·택배 운영기간
- `product_daily_limits`: 상품별 일일 한도
- `product_daily_reservations`: 주문이 차지한 날짜별 수량

### 주문과 일정

- `orders`: 주문번호, buyer snapshot, 상태, 금액, idempotency, version
- `order_items`: 주문 당시 상품명·가격 snapshot과 수량
- `order_item_customizations`: 맞춤주문 요청사항
- `fulfillments`: 방문/택배, pickup_at/ship_date, 수령인, 주소, 고객도착
- `fulfillment_items`: fulfillment와 order item 수량 연결

### 결제

- `payments`: 카드·현금·계좌이체 내부 기록, 환불 확장형 type
- `order_credit_terms`: 외상잔액, 예정일, open/settled
- `customer_accounts`: 정규화한 고객명·전화번호와 분리 장부 sequence
- `order_customer_accounts`: 주문과 고객 장부 연결
- `customer_ledger_transactions`: 고객 단위 입금·상쇄·이관·조정 거래
- `customer_ledger_consultations`, `customer_ledger_consultation_orders`: 상담 메모와 분리 대상 주문
- `customer_ledger_events`: 결제·정정·분리 감사이력

실제 PG 승인 데이터가 아니라 운영 장부다.

### 작업과 패키지

- `packages`: 주문상품별 완성 패키지
- `operational_alerts`: 운영 경고 확장 영역
- `order_events`: 주문, 상태, 도착, 결제, 패키지 감사이력
- `configuration_events`: 상품·시즌·headline 변경이력

### 생산·이력·재고

0005에서 추가된다.

- `product_components`: 상품 BOM
- `traceability_records`: 최근 이력번호와 metadata
- `production_batches`: 날짜·부위·이력 segment별 생산 작업
- `skin_packs`: 개별 중량팩 재고
- `skin_pack_labels`: Skin Pack label version
- `package_skin_packs`: package와 Skin Pack의 slot 배정
- `package_labels`: package label version
- `package_assignment_history`: 패키지 주문 재배정이력

### 별도 맞춤접수

- `custom_order_requests`
- `custom_order_events`

현재 main kiosk 맞춤주문은 일반 주문의 custom item으로 합류하며, 별도 요청 route의 기존 구조도 보존한다.

## migration history

| Migration | 역할 | Production 상태 |
|---|---|---|
| 0000 | 상품, 시즌, core 주문, 이벤트 | 적용 |
| 0001 | 맞춤접수, 설정, 운영경고 | 적용 |
| 0002 | fulfillments와 fulfillment_items | 적용 |
| 0003 | 과거 smoke 주문 취소 이력 정리 | 적용 |
| 0004 | 결제, 외상, 한정수량, customization | 적용 |
| 0005 | BOM, Batch, Skin Pack, package traceability | 미적용 |
| 0006 | 고객 계정, 고객 결제·미수·선수금 장부, 기존 주문·결제 backfill | 미적용 |

## 주문 원자성

주문접수는 하나의 D1 batch에 다음 statement를 포함한다.

1. `orders`
2. 모든 `order_items`
3. `fulfillments`
4. 모든 `fulfillment_items`
5. 한정상품 reservation
6. 맞춤주문 customization
7. `order_submitted` event

일부 statement가 실패하면 주문완료를 표시하지 않는다.

## snapshot과 참조

- 상품명이 바뀌어도 기존 주문은 `product_name_snapshot`을 사용한다.
- 가격 변경 후에도 기존 주문은 price snapshot과 line total을 유지한다.
- 이력번호 변경 후에도 Skin Pack은 생성 당시 traceability metadata를 유지한다.
- 고객정보 변경 기능을 추가할 때 기존 event와 snapshot 의미를 훼손하지 않는다.

## idempotency와 unique constraint

- `orders.idempotency_key`
- `payments.idempotency_key`
- `customer_ledger_transactions.idempotency_key`
- `skin_packs.idempotency_key`
- `custom_order_requests.idempotency_key`
- package assembly의 assembly key와 Skin Pack slot unique constraint

client-side disabled button만으로 중복을 막지 않는다.

## legacy 주문

- fulfillment 없는 주문은 유효한 과거 주문이다.
- 날짜를 추정해 넣지 않는다.
- 판매장 검색에서 항상 찾을 수 있어야 한다.
- 날짜별 화면에서는 `일정 미지정`으로 별도 집계한다.
- 운영자가 상세에서 명시적으로 지정할 때만 fulfillment를 생성한다.

## migration 작성 규칙

- 0000~0006을 수정하지 않는다.
- `_journal.json`과 snapshot을 schema와 함께 커밋한다.
- `npm run db:generate` 결과를 검토한다.
- 같은 번호 migration을 두 branch에서 만들지 않도록 `docs/work/active/`에서 번호를 독점 claim한다.
- Sites runner의 semicolon statement execution과 호환되게 작성한다.
- compound trigger, `RAISE`, 여러 statement를 하나로 전제한 SQL을 새 migration에 넣지 않는다.
- 0000부터 최신까지 빈 DB와 production-like legacy DB에 적용한다.
- 적용 전후 핵심 row count와 FK/index를 확인한다.

## Production 적용 순서

1. 실제 Production version/commit 확인
2. migration history와 table 존재 여부 확인
3. timestamp 전체 backup
4. 핵심 row count 기록
5. migration 1회 적용
6. table/index/row 보존 검증
7. 성공한 경우에만 앱 배포

실패하면 앱 배포를 중단하며 기존 migration을 즉석 수정해 재실행하지 않는다.

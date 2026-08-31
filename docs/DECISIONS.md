# 기술 결정 기록

새로운 결정은 날짜, 배경, 결정, 결과, 대안을 이 문서에 추가한다. 구현 세부 변경이 아니라 여러 영역에 영향을 주는 선택만 기록한다.

## ADR-001: Cloudflare D1을 Single Source of Truth로 사용

- 상태: 채택
- 배경: kiosk 주문이 판매장·작업장에 일관되게 보여야 한다.
- 결정: mock/local-only/Supabase가 아니라 Sites의 D1 `DB`를 운영 원본으로 사용한다.
- 결과: 모든 운영 API가 same-origin Worker에서 D1을 읽고 쓴다.

## ADR-002: 실시간성은 polling + refetch fallback

- 상태: 채택
- 결정: Sales와 Workshop이 2.5초 polling, focus, online refetch를 사용한다.
- 이유: 현재 Sites/D1 구조에서 단순하고 장애복구가 명확하다.
- 결과: 약 3초 반영을 목표로 하며 background timer throttling을 허용한다.

## ADR-003: fulfillment를 주문 일정의 기준으로 사용

- 상태: 채택
- 결정: pickup은 `pickup_at`, shipping은 `ship_date`로 날짜를 조회한다.
- 결과: 주문접수일과 실제 작업일을 혼동하지 않는다. legacy 주문은 일정 미지정으로 유지한다.

## ADR-004: idempotency + D1 batch

- 상태: 채택
- 결정: 고객 주문, 결제, Skin Pack에 idempotency key를 적용하고 다중 변경을 D1 batch로 실행한다.
- 결과: 빠른 이중클릭, retry, 중간 실패로 인한 중복·부분저장을 방지한다.

## ADR-005: 감사이력 보존과 soft cancellation

- 상태: 채택
- 결정: 주문을 hard delete하지 않고 cancelled와 event를 남긴다.
- 결과: 결제·reservation·작업 이력을 추적할 수 있다.

## ADR-006: ChatGPT 인증 + operator allowlist

- 상태: 채택
- 결정: 운영 page는 ChatGPT 로그인을 요구하며 운영 API는 user ID/email allowlist를 추가 검사한다.
- 결과: public kiosk를 유지하면서 운영 기능을 제한한다.

## ADR-007: 설정 기반 상시 운영 문구

- 상태: 채택
- 결정: kiosk headline을 `configuration_events` 기반 설정으로 관리하고 시즌 문구를 코드에 고정하지 않는다.
- 결과: 배포 없이 안내문구를 변경할 수 있다.

## ADR-008: BOM·Skin Pack·Package 모델

- 상태: 로컬 통합 완료, Production 미적용
- 결정: 상품 BOM으로 날짜별 부위 수요를 계산하고, 개별 중량 Skin Pack을 package slot에 all-or-nothing으로 배정한다.
- 결과: 이력번호, FIFO 재고, package QR, label version, reassignment를 추적한다.
- 선행조건: Production migration 0005.

## ADR-009: 주문 비배분 고객 결제·미수 장부

- 상태: 로컬 구현 완료, Production 미적용
- 날짜: 2026-08-31
- 배경: 동일 고객이 여러 날 여러 주문을 하고, 실제 입금액이 상품·주문 금액과 일치하지 않을 수 있다.
- 결정: 정규화한 고객명·전화번호를 기본 고객 식별자로 사용하고 입금을 주문에 자동 배분하지 않는다. 취소되지 않은 고객 주문 총액과 append-only 순입금의 차이로 미수·선수금을 계산한다.
- 결과: 부분결제·외상·선수금을 고객별로 한눈에 보고, 정정은 reversal로 원본을 보존한다. 예외 분리는 상담 메모 후 명시적으로 적용한다.
- 보안: 운영자 allowlist에 더해 장부 진입과 각 금액 변경에서 관리자 패스워드를 확인하며 장부 세션은 5분 비활동 후 만료한다.
- 선행조건: Production migration 0006과 두 장부 환경변수 설정.

## 새 ADR 템플릿

```markdown
## ADR-NNN: 제목

- 상태: 제안/채택/폐기
- 날짜:
- 배경:
- 결정:
- 결과:
- 검토한 대안:
- 관련 task/commit:
```

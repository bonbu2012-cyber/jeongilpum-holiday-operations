# Production 배포 runbook

## 현재 배포 모델

- OpenAI Sites가 version과 Production URL을 관리한다.
- 앱 runtime은 Cloudflare Worker다.
- 운영 DB는 Sites가 연결한 Cloudflare D1 `DB`다.
- source remote는 Sites 내부 Git이다.
- Supabase, Vercel, GitHub 배포는 사용하지 않는다.

## 배포 원칙

- Production deploy나 migration은 명시적 사용자 요청 없이 실행하지 않는다.
- DB migration 성공 전에 schema 의존 앱을 배포하지 않는다.
- 앱 배포만으로 DB row count가 변하면 안 된다.
- saved version의 commit SHA와 실제 배포 대상 SHA가 같아야 한다.
- 기존 backup을 덮어쓰지 않는다.

## 앱 변경만 있는 경우

1. 실제 Production version/commit/access 확인
2. branch, HEAD, clean working tree 확인
3. migration/schema 변경 없음 확인
4. lint, typecheck, test, build
5. 정확한 commit을 Sites source에 push
6. 해당 commit으로 saved version 생성
7. version을 Production에 deploy
8. `/kiosk`, `/sales`, 관련 route smoke test
9. Production commit과 Sites version 재확인
10. D1 핵심 row count가 배포 전과 같은지 확인

## migration이 있는 경우

1. Production table과 migration history read-only 확인
2. 번호 충돌과 이미 적용된 migration 여부 확인
3. timestamp 전체 backup 생성
4. 핵심 row count 기록
5. migration SQL과 provider-safe test 재확인
6. migration을 정확히 한 번 적용
7. 신규 table/index 생성 확인
8. 기존 row count와 FK 데이터 보존 확인
9. 실패 시 앱 deploy 중단
10. 성공 시에만 schema 의존 앱 배포

## 핵심 row count

- products
- orders
- order_items
- order_events
- fulfillments
- fulfillment_items
- packages
- payments
- production 적용 후: production_batches, skin_packs, package_skin_packs

## smoke test

### Kiosk

- 상품과 settings headline
- 방문수령 날짜·시간
- 택배 주소·발송일
- 맞춤주문과 draft 복원
- idempotent submit

### Sales

- 선택 날짜 주문표
- 주문 검색과 legacy
- 고객도착
- 결제·외상
- 약 3초 polling 반영

### Workshop

- 작업수락→시작→준비완료
- 우선순위와 next_due_at
- 판매장 고객도착 반영

### Production 0005 배포 후

- BOM requirement
- Batch 생성
- 테스트 Skin Pack 1개
- CSV와 PII-free QR
- package assembly는 명확한 테스트 데이터에서만 수행

### Production 0007 배포 후

- Production이 현재 0004라면 timestamp backup과 row count 후 0005 → 0006 → 0007 순서로 적용
- `supplier_presets`, `component_label_settings`, `label_print_jobs`, `label_print_events` 및 신규 index 확인
- 기존 `production_batches`, `skin_packs`, label row count와 `PRAGMA foreign_key_check` 확인
- 중앙 12자리 이력번호 TEST PDF 1장(재고 증가 없음)
- TEST 승인 후 소량 본 작업의 재고·draft label·생산수량 동시 증가 확인
- OpenLabel 공유 또는 다운로드 대체 후 수동 완료 전에는 label이 draft인지 확인
- 실기기 50×50mm 출력 검증 전 운영 대량 인쇄 금지

## 테스트 데이터

- 실제 운영 주문과 구분 가능한 고객명·메모를 사용한다.
- 운영 주문을 임의 수정하지 않는다.
- 테스트 주문은 DELETE하지 않는다.
- 완료 후 Status API로 cancelled 처리하고 audit event를 보존한다.
- 결제기록은 삭제하지 않는다.

## rollback 판단

rollback 또는 배포 중단 조건:

- migration 일부 실패
- 기존 row 감소 또는 FK 손실
- kiosk 주문 생성 실패
- 운영 API 401/403 설정 불일치
- `/sales`에서 DB 주문이 조회되지 않음
- build commit과 배포 commit 불일치

앱 rollback은 이전 Sites version으로 한다. DB schema rollback은 기존 migration을 수정하거나 destructive SQL을 즉흥 실행하지 말고 별도 복구 migration과 backup을 검토한다.

## 배포 보고

- backup 결과
- migration 전/후 row count
- migration 성공 여부
- Sites version과 commit
- Production URL
- route smoke 결과
- kiosk→sales 실제 반영시간
- 테스트 주문 ID와 취소 이력
- 기존 데이터 보존
- 오류와 rollback 필요 여부

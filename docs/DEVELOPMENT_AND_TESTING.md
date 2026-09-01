# 개발과 테스트

## 로컬 요구사항

- Node.js 22.13 이상
- npm
- Vinext/Vite/Cloudflare local runtime
- project-local `.wrangler` state

주요 command:

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run db:generate
```

## 디렉터리 역할

| 경로 | 역할 |
|---|---|
| `app/**/page.tsx` | route, server auth boundary |
| `app/components/` | client UI와 state |
| `app/api/` | HTTP/API, validation, transaction |
| `app/lib/` | domain, query, shared client/type |
| `db/` | D1/Drizzle schema |
| `drizzle/` | migration과 snapshot |
| `tests/` | unit, migration, integration-style regression |
| `public/` | logo와 정적 이미지 |
| `.openai/` | Sites project binding |
| `docs/` | as-built 문서와 작업 claim |

## 구현 규칙

- UI에 business rule을 중복 구현하더라도 서버 validation을 생략하지 않는다.
- route handler는 input validation, auth, transaction을 담당한다.
- 계산 가능한 domain rule은 `app/lib`의 순수함수로 분리하고 Node test를 작성한다.
- 기존 compact code를 무관하게 전면 포맷하지 않는다.
- shared type 변경은 API response와 모든 consumer를 함께 검사한다.
- snapshot 필드를 live product join으로 대체하지 않는다.
- cache가 운영 누락을 만들지 않게 no-store 계약을 유지한다.

## 테스트 파일

| 파일 | 범위 |
|---|---|
| `tests/v2-spec.test.mjs` | kiosk, auth, navigation, settings, 전체 구조 회귀 |
| `tests/legacy-fulfillment.test.mjs` | 일정 미지정 legacy 주문 |
| `tests/commerce.test.mjs` | 0004, 한정수량, 결제, 외상, 맞춤주문 |
| `tests/sales-operations.test.mjs` | 판매장 날짜·검색·고객도착·상태 |
| `tests/workshop-operations.test.mjs` | 작업우선순위, 상태전환, 생산량, 조기도착 |
| `tests/package-traceability.test.mjs` | 0005/0007, BOM, Batch, 12자리 HID, 100장 일괄, 50×50 PDF, QR/PII, CSV, 패키지 |
| `tests/rendered-html.test.mjs` | 렌더 결과 보조 검사; 기본 `npm test`에는 현재 미포함 |

## 변경 유형별 검사

### 문서만 변경

- relative link 존재 확인
- `git diff --check`

### UI 변경

- lint
- typecheck
- 관련 v2/workshop/sales test
- desktop와 narrow layout 수동 확인이 필요하면 명시

### API 또는 domain 변경

- lint
- typecheck
- 관련 test
- `npm test`
- error와 auth path 검토

### schema 변경

- 새 migration 생성
- generated SQL 수동검토
- 0000→latest 빈 DB 적용
- production-like legacy DB 적용과 row 보존
- provider-safe semicolon execution test
- full test와 build

### 배포 후보

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- schema가 변했다면 `npm run db:generate`
- clean working tree와 정확한 HEAD

## 테스트 작성 원칙

- user-visible behavior와 DB invariant를 함께 검증한다.
- 단순 source regex만으로 transaction 성공을 증명하지 않는다.
- idempotency, concurrency, rollback, row preservation을 포함한다.
- timezone과 pickup/shipping date 분기를 각각 테스트한다.
- cancelled와 legacy behavior를 회귀 항목으로 유지한다.
- Production browser 확인을 자동테스트 통과로 대체하지 않는다.
- 자동화할 수 없는 항목은 `사용자 수동 확인 필요`로 보고한다.
- 실기기 라벨은 Galaxy Tab A9+ Chrome 공유, OpenLabel 수신, BY-482BT 용지 보정·실측, Bluetooth 재연결, 100장 및 용지 부족 후 잔여 출력까지 별도 확인한다.

## 완료 기준

- 요구사항이 route/render tree에서 실제 사용된다.
- DB와 API 계약이 문서와 일치한다.
- 관련 tests가 통과한다.
- 실패·미실행 검사를 숨기지 않는다.
- 관련 docs와 작업 task 파일이 갱신된다.

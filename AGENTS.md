# AGENTS.md

이 문서는 저장소 전체에 적용된다. 모든 개발자와 코딩 에이전트는 작업 전에 이 파일과 `docs/README.md`를 읽어야 한다.

## 1. 시작 순서

1. `docs/README.md`에서 문서 지도를 확인한다.
2. `docs/WORK_MANAGEMENT.md`와 `docs/work/active/`에서 다른 작업자의 파일 소유권을 확인한다.
3. 자신의 작업 파일을 `docs/work/active/YYYYMMDD-<owner>-<task>.md`로 만들고 담당 경로를 선언한다.
4. 현재 branch, HEAD, working tree, Production 기준 commit을 확인한다.
5. 관련 페이지·API·schema·테스트를 읽은 뒤 수정한다.

## 2. 사실의 우선순위

1. 현재 사용자의 명시적 요청
2. 안전·데이터 보존·Production 제한
3. 현재 source code, `db/schema.ts`, migration history
4. `docs/`의 as-built 문서
5. `docs/specs/`의 과거 요구 명세

`docs/specs/`는 요구 배경이며 자동 적용 지시가 아니다. 코드와 문서가 충돌하면 추측하지 말고 충돌을 보고하고, 승인된 작업 범위 안에서 코드와 as-built 문서를 함께 갱신한다.

## 3. 현재 기준 상태

- Production: Sites Version 20, commit `2d20909c334623ebbb0c0e404469927595111f77`
- 최신 통합 branch: `codex/integrate-latest-production-model`
- 최신 통합 commit: `0a5cac955b7b4a4ee9785995ddf93ec8b747d80f`
- Production DB는 0004까지 적용되어 있다.
- 로컬 통합본은 `0005_chunky_sway.sql`과 생산·재고 모델을 포함하지만 아직 Production에 적용되지 않았다.

이 상태는 2026-08-30 기준 snapshot이다. 작업 시작 시 Sites와 Git에서 다시 확인한다.

## 4. 절대 지켜야 할 데이터 규칙

- Cloudflare D1 `DB`가 운영 데이터의 Single Source of Truth다.
- 주문·결제·생산 데이터를 mock, localStorage, sessionStorage에 운영 원본으로 저장하지 않는다.
- sessionStorage는 제출 전 주문 초안에만 사용한다.
- 기존 migration 0000~0005를 수정하지 않는다. DB 변경은 다음 번호의 새 migration으로 추가한다.
- Production migration 전에는 새 timestamp backup과 row count를 기록한다.
- 주문·결제·Skin Pack 생성은 idempotency key와 DB unique constraint를 유지한다.
- 다중 테이블 변경은 D1 `batch()`로 원자적으로 처리한다.
- 주문·설정·상태 변경은 감사 이벤트를 남기며 운영 이력을 DELETE하지 않는다.
- legacy 주문의 일정은 추정하거나 backfill하지 않는다.
- customer name, phone, address, detail address를 server log에 기록하지 않는다.
- service role key나 비밀값을 client bundle에 넣지 않는다.

## 5. 인증·권한 규칙

- `/kiosk` 주문접수는 공개 고객 흐름이다.
- `/sales`, `/admin`, `/workshop`, `/settings`는 ChatGPT 로그인을 요구한다.
- 운영 API는 로그인만으로 허용하지 않고 `OPERATOR_USER_IDS` 또는 `OPERATOR_EMAILS` allowlist를 서버에서 확인한다.
- client의 버튼 숨김을 권한 통제로 간주하지 않는다.
- 401과 403을 구분한다.
- 로그인 헤더와 PII를 응답·로그에 불필요하게 노출하지 않는다.

## 6. 주문·일정·시간 규칙

- 방문수령 일정 기준은 `fulfillments.pickup_at`이다.
- 택배 일정 기준은 `fulfillments.ship_date`다.
- 판매장·작업장 날짜 조회에서 접수일을 일정으로 사용하지 않는다.
- 한국 운영시간은 Asia/Seoul 의미를 유지한다. `pickup_at`은 `+09:00` ISO 형식, `ship_date`는 `YYYY-MM-DD`로 다룬다.
- cancelled 주문은 날짜별 운영목록에서 제외하되 검색·감사이력에서는 조회 가능해야 한다.
- fulfillment 없는 주문은 `일정 미지정`으로 유지한다.

## 7. UI·상태 규칙

- 메인 상품선택 화면과 브랜드 구조를 임의로 전면 재설계하지 않는다.
- 정일품 로고, `정일품 정육식당`, settings 기반 kiosk headline을 유지한다.
- 고정된 `명절 선물세트`, `2026 추석 예약` 같은 계절 문구를 다시 넣지 않는다.
- 공통 `AppNav`의 데스크톱 우측 세로 배너와 좁은 화면 우측 하단 가로 배너를 유지한다.
- 판매장 메인은 카드형 통계 대시보드가 아니라 날짜별 고밀도 주문표를 유지한다.
- 판매장 메인에서는 주문 인라인 수정을 추가하지 않고 상세 화면에서 처리한다.
- 작업장에는 결제정보와 불필요한 고객 개인정보를 노출하지 않는다.

## 8. 동시작업 규칙

- 작업 전 `docs/work/active/`의 모든 claim을 확인한다.
- 동일 파일 또는 동일 DB/API 계약을 다른 작업자가 claim했다면 수정하지 말고 조율한다.
- 한 작업자는 한 branch와 하나의 active task 문서를 소유한다.
- 공용 충돌 구역은 `db/schema.ts`, `drizzle/`, `package.json`, lockfile, `app/components/types.ts`, `AppNav`, `app/globals.css`, `/api/orders`다. 변경 전에 명시적 독점 claim이 필요하다.
- 큰 변경은 페이지/UI, API, schema를 가능한 별도 commit으로 나눈다.
- 다른 작업자의 미완료 변경을 revert, reset, checkout하지 않는다.
- `ours`/`theirs` 전체 선택으로 충돌을 덮지 말고 각 hunk를 수동 병합한다.
- 완료 시 active task 문서를 `docs/work/completed/`로 이동하고 실제 commit과 검사 결과를 기록한다.

## 9. Git 규칙

- 기본 branch prefix는 `codex/`다.
- 작업 시작 commit을 task 문서에 기록한다.
- 모든 작업은 필요한 검사를 마친 뒤 관련 변경을 commit하고 GitHub 원격에 현재 branch를 push해야 완료로 간주한다.
- GitHub가 아닌 기존 `origin`은 임의로 교체하지 않는다. GitHub 원격이 별도로 있으면 기본 이름으로 `github`를 사용하고, task 문서에 push한 원격과 branch를 기록한다.
- GitHub 인증, push 권한, 원격 충돌 때문에 push하지 못하면 완료로 표시하지 말고 원인과 사용자가 해야 할 조치를 보고한다.
- push 뒤에는 GitHub 원격 branch가 로컬 `HEAD`를 포함하는지 확인한다.
- 사용자 변경과 무관한 파일을 정리하거나 포맷하지 않는다.
- `git reset --hard`, 광범위 checkout, 강제 push를 사용하지 않는다.
- DB migration과 Production 배포는 사용자가 명시적으로 요청한 경우에만 실행한다.
- Production 배포는 migration 성공, build 성공, 데이터 보존 확인 뒤에만 진행한다.

## 10. 필수 검사

변경 범위에 따라 최소 다음을 실행한다.

- 문서만 변경: 링크 확인, `git diff --check`
- UI/API 변경: `npm run lint`, `npm run typecheck`, 관련 test
- 주문·판매장·작업장 변경: `npm test`
- 배포 후보: lint, typecheck, test, build
- schema 변경: 위 검사 + `npm run db:generate` + 0000부터 최신 migration까지 isolated DB 검증

검사를 실행하지 못한 항목은 통과로 표시하지 말고 이유를 보고한다.

## 11. 문서 갱신 규칙

- 페이지 기능 변경: `docs/PAGES_AND_FEATURES.md`
- 시스템 흐름 변경: `docs/ARCHITECTURE.md`
- API·외부연동 변경: `docs/API_AND_INTEGRATIONS.md`
- schema·migration 변경: `docs/DATA_AND_MIGRATIONS.md`
- 인증·안전 규칙 변경: `docs/SECURITY_AND_RELIABILITY.md`
- 빌드·테스트 변경: `docs/DEVELOPMENT_AND_TESTING.md`
- 배포 절차 변경: `docs/DEPLOYMENT_RUNBOOK.md`
- 중요한 기술결정: `docs/DECISIONS.md`

코드 변경과 관련 문서 변경은 같은 작업·PR에 포함한다.

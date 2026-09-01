# 동시작업 관리

## 목적

여러 개발자가 같은 저장소에서 작업할 때 파일, API 계약, migration 번호 충돌을 사전에 막는다. 중앙 active table 하나를 모두가 수정하면 그 문서 자체가 충돌하므로, 개발자마다 고유 task 파일을 사용한다.

## 작업 claim 위치

- 진행 중: `docs/work/active/`
- 완료: `docs/work/completed/`
- 템플릿: `docs/work/TASK_TEMPLATE.md`

파일 이름:

```text
YYYYMMDD-<owner-or-agent>-<short-task>.md
```

예:

```text
20260830-minsu-sales-refund.md
20260830-codex-workshop-label.md
```

각 개발자는 자신의 task 파일만 수정한다. 다른 개발자의 task 파일에 상태나 경로를 대신 기록하지 않는다.

## 작업 시작 protocol

1. remote 최신 상태를 fetch/pull하고 기준 commit을 기록한다.
2. `docs/work/active/`의 모든 파일에서 `Claimed paths`와 `Shared contracts`를 확인한다.
3. 겹치는 claim이 있으면 코드 수정 전에 담당자와 범위를 나눈다.
4. 템플릿으로 자신의 active task 파일을 만든다.
5. branch를 만들고 task claim만 먼저 commit/push한다.
6. 다른 개발자가 같은 시간에 claim했는지 다시 확인한다.
7. 문제가 없을 때 구현을 시작한다.

## claim 단위

경로는 가능한 좁게 선언한다.

좋은 예:

```text
app/components/SalesOrderDetail.tsx
app/api/orders/payments/route.ts
tests/commerce.test.mjs
```

나쁜 예:

```text
app/**
docs/**
```

경로가 다르더라도 request/response type, DB table, CSS selector를 공유하면 `Shared contracts`에 기록한다.

## 독점 claim이 필요한 충돌 구역

다음은 동시에 두 작업자가 수정하지 않는다.

- `db/schema.ts`
- `drizzle/**`, migration 번호
- `package.json`, `package-lock.json`
- `.openai/hosting.json`
- `app/components/types.ts`
- `app/components/AppNav.tsx`
- `app/globals.css`
- `app/api/orders/route.ts`
- auth/operator 환경변수 계약
- order status와 event type

필요하면 공통 변경 전용 선행 task를 먼저 병합하고 다른 branch가 그 commit을 base로 삼는다.

## 영역별 기본 소유 경계

| 영역 | 대표 경로 | 공유 계약 |
|---|---|---|
| Kiosk | `KioskApp`, `CustomOrderApp`, kiosk CSS | `/api/products`, `/api/orders`, OrderDraft |
| Sales | `SalesApp`, `SalesOrderDetail`, sales CSS | orders response, status/payment API |
| Workshop | `WorkshopApp`, workshop operations | workshop orders/actions, status event |
| Production | `ProductionApp`, production lib/API | schema 0005, batch/pack types |
| Package | `PackageApp`, package API/lib | packages, Skin Pack assignment |
| Settings | `SettingsApp`, settings API | products, seasons, configuration events |
| Platform | auth, hosting, build | 모든 protected route |
| DB | schema, migrations | 모든 API와 test |

이 표는 자동 소유권이 아니라 작업 분할 가이드다. 실제 소유권은 active task 파일의 claim이다.

## 인터페이스 변경 protocol

API response, shared type, schema처럼 여러 영역에 영향을 주는 변경:

1. 새 계약과 backward compatibility를 task 문서에 적는다.
2. 가능한 경우 계약 변경을 별도 선행 commit으로 만든다.
3. 모든 consumer owner에게 dependency를 기록한다.
4. migration이 필요하면 번호를 독점 claim한다.
5. 기존 field를 즉시 삭제하지 말고 단계적 전환을 우선한다.
6. 관련 as-built docs를 같은 작업에서 갱신한다.

## 병합 순서

1. schema/shared contract
2. server API/domain
3. page/client UI
4. tests/docs

독립적인 기능이면 순서대로 병합할 필요가 없지만 같은 계약을 사용한다면 위 순서를 따른다.

## 충돌 처리

- 충돌 발생 시 각 hunk의 두 의도를 확인한다.
- 전체 `ours` 또는 `theirs` 선택을 금지한다.
- 다른 작업자의 기능을 제거하는 해결은 담당자 확인 없이 하지 않는다.
- 충돌 해결 후 양쪽 영역의 test를 모두 실행한다.
- 해결 내용을 task 문서의 `Integration notes`에 기록한다.

## 완료 protocol

1. 관련 검사 실행
2. docs 갱신
3. 최종 commit과 GitHub 원격·branch 기록
4. 남은 TODO와 Production 필요 작업 기록
5. task 상태를 Completed로 변경
6. 자신의 task 파일을 `docs/work/completed/`로 이동
7. 관련 변경을 commit하고 GitHub 원격에 현재 branch를 push
8. GitHub 원격 branch가 로컬 `HEAD`를 포함하는지 확인
9. active 경로에 자신의 claim 파일이 남지 않았는지 확인

GitHub 인증, push 권한, 원격 충돌로 push가 실패하면 task를 Completed로 표시하지 않는다. 실패 원인과 사용자가 해야 할 조치를 보고하고, 해결 후 같은 branch를 push해 완료한다. GitHub가 아닌 기존 `origin`은 임의로 교체하지 않으며 별도 GitHub 원격의 기본 이름은 `github`로 한다.

## 긴급 Production 수정

- Production 기준 commit에서 별도 hotfix branch를 만든다.
- 변경 파일을 active task에 즉시 claim한다.
- 최소 범위만 수정한다.
- schema 변경과 UI hotfix를 같은 작업으로 묶지 않는다.
- 배포 후 정상 branch에 hotfix commit을 다시 통합한다.
- Production에서만 존재하는 수정이 생기지 않게 한다.

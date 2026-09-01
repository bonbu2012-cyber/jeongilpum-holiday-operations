# Task: 관리자용 종합통제실

- Status: Completed
- Owner: Codex
- Branch: `codex/control-room`
- Base commit: `d79a5ec0d7c04a630517162964e520bc47af36d7`
- Started at: 2026-09-01
- Target environment: Local validation only

## Goal

관리자·운영자 이중 allowlist로 보호되는 `/control-room`에서 오늘 실시간 주문·작업·생산·패키지 위험과 이후 7일 전망을 읽기 중심으로 확인하고 기존 운영 화면의 동일 날짜로 이동할 수 있게 한다.

## Claimed paths

- `app/control-room/**`
- `app/api/control-room/**`
- `app/components/ControlRoomApp.tsx`
- `app/components/AppNav.tsx`
- `app/components/SalesApp.tsx`
- `app/components/WorkshopApp.tsx`
- `app/components/ProductionApp.tsx`
- `app/lib/control-room-*.ts`
- `app/lib/operational-date.ts`
- `app/control-room-flow.css`
- `package.json`
- `tests/control-room.test.mjs`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT_AND_TESTING.md`
- `AGENTS.md`
- `docs/WORK_MANAGEMENT.md`
- `docs/work/TASK_TEMPLATE.md`

## Shared contracts

- 관리자 환경값: `CONTROL_ROOM_ADMIN_USER_IDS`, `CONTROL_ROOM_ADMIN_EMAILS`
- 기존 operator allowlist와 ChatGPT 인증
- 기존 고객장부 5분 세션과 `/api/customer-ledger` 조회 계약
- 주문·작업·생산·패키지 조회 계약
- `AppNav` 공통 navigation

## Coordination

- `20260831-codex-customer-ledger-production-deploy.md`가 `app/api/customer-ledger/**`, `.env.example`, 고객장부 문서와 테스트를 claim 중이므로 해당 경로는 수정하지 않는다.
- 통제실 금액 요약은 기존 장부 access/list API를 읽기 전용으로 사용한다.
- Production migration과 배포는 실행하지 않는다.
- 사용자 요청에 따라 GitHub 작업 완료 정책을 저장소 공통 지침과 task 템플릿에 추가하고, 기존 비-GitHub `origin`은 변경하지 않는다.

## Validation

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 71 passed
- [x] `npm run build` — `/control-room`, live API, forecast API route 포함
- [x] local route/API response — page 200, live 200, forecast 200, 다음 7일 반환
- [x] responsive implementation review — 모바일 단일열, 경보 우선배치, 전망표 가로 scroll 확인

## Completion

- Implementation commits: `fedd0dd`, `a6a69ee`, `4db9189`, `c35dc0f`
- Final implementation commit: `c35dc0f712ea19f9823124201619700077558214`
- Completed at: 2026-09-01
- Remaining TODO: Production 적용 전 `CONTROL_ROOM_ADMIN_USER_IDS` 또는 `CONTROL_ROOM_ADMIN_EMAILS`를 설정하고 기존 operator allowlist에도 같은 관리자를 포함한다. Production migration과 배포는 이 작업에서 실행하지 않았다.
- Coordination note: 고객장부 배포 작업이 claim한 `.env.example`, 고객장부 API, PAGES/API/SECURITY 문서는 수정하지 않았다. 통제실 금융 영역은 기존 5분 장부 session과 목록 API를 재사용한다.

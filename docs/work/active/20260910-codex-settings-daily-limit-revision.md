# Task: 설정 상품 한정수량 수정 오류

- Status: Active
- Owner: Codex
- Branch: `codex/fix-settings-daily-limit-revision`
- Base commit: `c72844038f76300357217ae9207fb5275575dd32`
- Started at: 2026-09-10
- Target environment: Local validation
- Related issue/spec: 사용자 보고 — 설정 > 상품에서 한정수량 저장 시 입력값 오류

## Goal

기존 seed 상품처럼 `updated_at`이 비어 있는 상품도 한정수량을 포함한 설정 변경을 정상 저장하고, 이후 동시 수정 충돌 감지를 유지한다.

## Non-goals

- DB schema 또는 migration 변경
- 설정 화면 디자인 변경
- Production 배포

## Claimed paths

- `app/api/settings/route.ts`
- `tests/sales-operations.test.mjs`
- `docs/work/active/20260910-codex-settings-daily-limit-revision.md`

## Shared contracts

- API route/field: `GET/PATCH /api/settings`의 상품 `version` 토큰
- DB table/column: 기존 `products.version`, `products.updated_at`만 사용
- shared type/event/status: 기존 문자열 `expectedVersion` 형식 유지
- CSS/shared navigation: 변경 없음

## Dependencies

- 먼저 병합되어야 하는 task/commit: 없음
- 이 작업을 기다리는 task: 없음
- 기존 UI foundation이 `SettingsApp.tsx`를 claim 중이므로 해당 파일은 수정하지 않는다.

## Plan

1. Production 실패 로그와 상품 revision 상태 확인
2. nullable `updated_at` 호환 revision 토큰 구현
3. 회귀 테스트와 전체 검사

## Acceptance criteria

- [ ] `updated_at IS NULL`인 상품의 한정수량 저장 가능
- [ ] 이미 수정된 상품의 optimistic concurrency 유지
- [ ] DB schema와 기존 데이터 변경 없음
- [ ] 관련 회귀 테스트 통과

## Validation

- [ ] lint
- [ ] typecheck
- [ ] related tests
- [ ] full test
- [ ] build
- [ ] migration test, 해당 없음
- [ ] manual smoke, Production 미배포로 제외

## Integration notes

- 충돌 해결 내용: `SettingsApp.tsx`와 공용 UI 파일을 수정하지 않는다.
- backward compatibility: 기존 timestamp version 토큰을 유지하고 legacy null 행에만 안정적인 fallback 토큰을 제공한다.
- Production 설정/migration 필요사항: migration 없음. 배포는 사용자 명시 요청 후 진행한다.

## Completion

- Final commit:
- GitHub remote/branch:
- Push verification:
- Completed at:
- Remaining TODO:

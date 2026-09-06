# Task: 상품 품절 기능 Production 배포

- Status: Active
- Owner: Codex
- Branch: `codex/product-sold-out-card-ui`
- Base commit: `73126c9bb1c4a953453066e483a0012af3e7ad8a` (Sites Version 28)
- Started at: 2026-09-06
- Target environment: Production
- Related implementation: `7693e6dcaed4a156dff3264d259640fc227c93bb`

## Goal

검증된 카드형 상품 품절 기능을 현재 비공개 Sites Production에 배포하고, 기존 D1 데이터가 보존되며 상품·설정·키오스크 route가 정상 응답하는지 확인한다.

## Non-goals

- D1 schema 또는 migration 변경
- 기존 상품, 주문, 결제, 생산 데이터 수정
- Site 접근 대상 변경

## Claimed paths

- 외부 Sites project `appgprj_6a88edf3a8b48191875d63120540dfb8`의 다음 Production version
- `docs/work/active/20260906-codex-product-sold-out-deploy.md`

## Shared contracts

- 현재 Production Version 28에서 앱 코드만 교체한다.
- D1 `DB`의 기존 table과 row count를 배포 전후 비교한다.
- 현재 owner-only custom access를 유지한다.

## Plan

1. Production 버전·접근정책·D1 row count를 확인한다.
2. exact source commit을 Sites 원격에 push하고 package·save·deploy한다.
3. 배포 상태, route, 데이터 보존을 확인한다.

## Validation

- [x] lint
- [x] typecheck
- [x] related tests — 3건 통과
- [x] full test — 71건 통과
- [x] build
- [x] migration diff 없음 확인 예정
- [x] Production 배포 전 row count 기록
- [ ] Production deployment and smoke

## Completion

- Final source commit:
- Sites version:
- Production URL:
- Row count preservation:
- Completed at:
- Remaining TODO:

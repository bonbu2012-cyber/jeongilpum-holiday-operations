# 정일품 운영 웹앱 문서

이 폴더는 신규 개발자가 제품 맥락, 실제 구현, 데이터 규칙, 배포 상태를 빠르게 파악하기 위한 as-built 문서다.

## 문서 읽는 순서

1. [제품 개요](PRODUCT_OVERVIEW.md)
2. [페이지와 기능](PAGES_AND_FEATURES.md)
3. [시스템 아키텍처](ARCHITECTURE.md)
4. [데이터와 migration](DATA_AND_MIGRATIONS.md)
5. [API와 외부 연동](API_AND_INTEGRATIONS.md)
6. [보안과 신뢰성](SECURITY_AND_RELIABILITY.md)
7. [개발과 테스트](DEVELOPMENT_AND_TESTING.md)
8. [배포 runbook](DEPLOYMENT_RUNBOOK.md)
9. [기술 결정 기록](DECISIONS.md)
10. [동시작업 관리](WORK_MANAGEMENT.md)

저장소 전체 작업 규칙은 루트의 [AGENTS.md](../AGENTS.md)를 우선 확인한다.

## 현재 상태 snapshot

기준일: 2026-08-30

- Production URL: `https://jeongilpum-chuseok-mvp.bonbu2012.chatgpt.site`
- Production: Sites Version 20
- Production commit: `2d20909c334623ebbb0c0e404469927595111f77`
- 최신 로컬 통합 branch: `codex/integrate-latest-production-model`
- 최신 로컬 통합 commit: `0a5cac955b7b4a4ee9785995ddf93ec8b747d80f`
- Production DB: migration 0004까지, 생산 0005 미적용
- 로컬 통합본: migration 0005 포함, BOM/Batch/Skin Pack/Package 기능 포함

이 snapshot은 고정된 사실이 아니다. Production 또는 branch 관련 작업에서는 Sites와 Git에서 실제 상태를 다시 확인한다.

## 문서 유형

- 이 폴더 루트의 문서: 현재 코드 기준 as-built 구조와 개발 지침
- `docs/specs/`: 과거 요구 명세와 구현 배경
- `docs/work/active/`: 현재 진행 중인 개발자별 작업 claim
- `docs/work/completed/`: 완료된 작업 기록

`docs/specs/`의 내용이 현재 코드와 다를 수 있다. 새로운 작업에서 명세와 구현이 충돌하면 임의로 한쪽을 선택하지 말고 차이를 보고한다.

## 문서 유지 원칙

- 코드가 바뀌면 관련 as-built 문서도 같은 작업에서 갱신한다.
- 향후 계획은 현재 기능처럼 쓰지 말고 `계획`, `미구현`, `Production 미적용`을 명시한다.
- 운영 상태, schema, 인증, 외부연동은 추측하지 않는다.
- 민감한 ID, token, 실제 고객정보는 문서에 기록하지 않는다.

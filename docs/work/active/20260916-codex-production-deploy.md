# Task: 오늘의 간편 장부 및 작업장 패킹슬립 기능 Production 배포

- Status: Active
- Owner: Codex
- Branch: `codex/today-simple-ledger`
- Base commit: `67da06f0f87eec26405836a1a8b904d3f5239224`
- Started at: 2026-09-16
- Target environment: Production (Vercel)
- Target URL: `https://jeongilpum-holiday-operations.vercel.app`

## Goal

검증 완료된 60대 실무자 맞춤 오늘의 간편 장부(`/today`), 현장 수납 결제 상태/시점 기록, 전체 네비게이션 탭 연동 및 작업장 패킹슬립 맞춤주문/메모 분리 기능을 Vercel Production에 배포하고, 배포 후 `/today` 및 주요 route가 정상 작동하는지 확인한다.

## Non-goals

- DB schema 및 migration 변경 (기존 Supabase PostgreSQL DB 유지)
- 기존 상품, 주문, 결제 데이터 임의 수정

## Claimed paths

- `docs/work/active/20260916-codex-production-deploy.md`
- Production deployment on Vercel (`jeongilpum-holiday-operations`)

## Plan

1. 로컬 lint, typecheck, 핵심 도메인 테스트, build 검증 (완료)
2. `codex/today-simple-ledger` 브랜치를 `main`에 병합 및 GitHub 원격(`origin/main`) 푸시
3. Vercel Production 배포 실행 (`npx vercel --prod`)
4. 배포 후 Production URL (`https://jeongilpum-holiday-operations.vercel.app/today`) 및 API smoke test
5. 작업 완료 문서(`docs/work/completed/`) 이동 및 상태 보고

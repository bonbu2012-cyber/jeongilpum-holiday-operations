# Task: 상품 판매 통계 오류 수정 및 UI 개선 Production 배포

- Status: Active
- Owner: Codex
- Branch: `main`
- Base commit: `68a2f3d`
- Started at: 2026-09-18T07:35:00+09:00
- Target environment: Production (Vercel)
- Target URL: `https://jeongilpum-holiday-operations.vercel.app`

## Goal

'상품별 판매 통계' 500 에러 수정, 결제 무관 총계 집계 및 보조 칩, 수령발송일/접수일 기준 선택, 카드/테이블 뷰 모드, 텍스트 복사 기능 등 검증된 최신 변경사항을 Vercel Production에 배포하고, 배포 후 정상 동작을 확인한다.

## Non-goals

- DB schema 또는 migration 변경 없음 (기존 Supabase/PostgreSQL 및 D1 스키마 유지)
- 기존 주문/결제/상품 데이터 임의 변경 없음

## Claimed paths

- `docs/work/active/20260918-codex-production-deploy-stats-fix.md`
- Production deployment on Vercel (`jeongilpum-holiday-operations`)

## Plan

1. 로컬 lint, typecheck, 핵심 도메인 테스트, build 검증 (완료)
2. `codex/sales-product-stats-fix` 브랜치를 `main`에 병합 및 GitHub 원격(`origin/main`) 푸시
3. Vercel Production 배포 실행 (`npx vercel --prod --yes`)
4. 배포 후 Production URL 및 API smoke test
5. 작업 완료 문서(`docs/work/completed/`) 이동 및 상태 보고

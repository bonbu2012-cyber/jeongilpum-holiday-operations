# Task: 상품 판매 통계 오류 수정 및 UI 개선 Production 배포

- Status: Completed
- Owner: Codex
- Branch: `main`
- Base commit: `68a2f3d`
- Final commit: `8d7f819`
- Started at: 2026-09-18T07:35:00+09:00
- Completed at: 2026-09-19T08:55:00+09:00
- Target environment: Production (Vercel)
- Target URL: `https://jeongilpum-holiday-operations.vercel.app`

## Goal

'상품별 판매 통계' 500 에러 수정(`o.status` -> `o.order_status`), 결제 무관 총계 집계 및 보조 칩, 수령발송일/접수일 기준 선택, 카드/테이블 뷰 모드, 텍스트 복사 기능 등 검증된 최신 변경사항을 Vercel Production에 배포하고, 배포 후 정상 동작을 확인한다.

## Non-goals

- DB schema 또는 migration 변경 없음 (기존 Supabase PostgreSQL DB 유지)
- 기존 주문/결제/상품 데이터 임의 변경 없음

## Claimed paths

- `docs/work/completed/20260918-codex-production-deploy-stats-fix.md`
- Production deployment on Vercel (`jeongilpum-holiday-operations`)

## Plan

1. 로컬 lint, typecheck, 핵심 도메인 테스트, build 검증 (완료)
2. `codex/sales-product-stats-fix` 브랜치를 `main`에 병합 및 GitHub 원격(`origin/main`) 푸시 (완료)
3. Vercel Production 배포 실행 (`npx vercel --prod --yes --scope happy-butcher`) (완료)
4. 배포 후 Production URL 및 API smoke test (완료)
5. 작업 완료 문서(`docs/work/completed/`) 이동 및 상태 보고 (완료)

## Validation Results

- [x] `npm run typecheck`: 통과 (0 errors)
- [x] `node --test tests/sales-product-stats.test.mjs`: 통과 (2/2 pass)
- [x] `npm run build`: Next.js 15.2.9 프로덕션 최적화 빌드 완료 (19 static + 12 dynamic routes)
- [x] Vercel Production 배포 완료:
  - Deployment ID: `dpl_EghMQBBQkg5JHySLw5FfTstbsj72`
  - URL: `https://jeongilpum-holiday-operations-kstyxqbns-happy-butcher.vercel.app`
  - Alias: `https://jeongilpum-holiday-operations.vercel.app`
  - Status: `READY`
- [x] Live Smoke Test:
  - `GET /api/sales/product-stats?startDate=2026-09-18&endDate=2026-09-18&dateType=due`: **200 OK**
  - 집계 결과: 총 17건 주문, 27세트, 총 6,838,000원 (수납 4,320,000원 / 미수 1,718,000원) 정상 집계 확인


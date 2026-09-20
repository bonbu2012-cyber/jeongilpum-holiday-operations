# Task: 작업장 감열 라벨 80×100mm 확대 및 UI 개선 Production 배포

- Status: Completed
- Owner: Codex
- Branch: `main`
- Base commit: `c41d2de`
- Final commit: `1a50c41`
- Started at: 2026-09-21T04:36:00+09:00
- Completed at: 2026-09-21T04:37:00+09:00
- Target environment: Production (Vercel)
- Target URL: `https://jeongilpum-holiday-operations.vercel.app/workshop`

## Goal

작업장 80×100mm 감열 라벨 규격 확대, 상품명(22pt)·주문자명(18pt) 대형 타이포그래피, 택배 주소 3줄 표기 및 메모 영역 확장, 고객별 미결제 합계 집계 및 일괄 결제, 판매 통계 카드 레이아웃 버그 수정 등 검증된 최신 기능들을 Vercel Production에 공식 배포한다.

## Non-goals

- DB schema 또는 migration 변경 없음
- 운영 주문/결제 데이터 임의 변경 없음

## Claimed paths

- `docs/work/completed/20260921-codex-workshop-label-80x100-production-deploy.md`
- Production deployment on Vercel (`jeongilpum-holiday-operations`)

## Plan

1. 단위 테스트, 정적 분석(Lint, Typecheck), Next.js 프로덕션 빌드 통과 확인 (완료)
2. `codex/workshop-label-80x100` 브랜치를 `main` 브랜치에 fast-forward 병합 (완료)
3. 배포 기록 문서 추가 및 `origin/main` 푸시
4. Vercel 프로덕션 배포 진행 및 정상 상태 확인

## Validation Results

- [x] `npm run typecheck`: 통과 (0 errors)
- [x] `npm run lint`: 통과 (0 errors)
- [x] `node --test tests/workshop-packing-slip-and-labels.test.mjs`: 통과 (14/14 pass)
- [x] `node --test tests/sales-customer-payment-summary.test.mjs`: 통과 (6/6 pass)
- [x] `npm run build`: Next.js 15.2.9 프로덕션 빌드 완료 (19개 라우트 전원 통과)
- [x] Vercel Production 배포 완료:
  - Deployment ID: `dpl_m6PxiL5Rizpd6vZNZ4pzJ9C84A7B`
  - URL: `https://jeongilpum-holiday-operations-eaa3i933b-happy-butcher.vercel.app`
  - Alias: `https://jeongilpum-holiday-operations.vercel.app`
  - Target URL: `https://jeongilpum-holiday-operations.vercel.app/workshop`
  - Status: `READY`
- [x] Live Smoke Test:
  - `GET /workshop`: **200 OK** (최신 CSS 및 JS 청크 로드 확인)

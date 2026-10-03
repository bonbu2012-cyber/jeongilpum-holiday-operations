# Task: 판매장 상품별 통계 일자별 판매리스트 및 엑셀 다운로드 Production 배포

- Status: Completed
- Owner: Codex
- Branch: `main`
- Base commit: `d5a1159`
- Merged commit: `f1265b6`
- Started at: 2026-10-03T13:35:00+09:00
- Completed at: 2026-10-03T13:38:00+09:00
- Target environment: Production (Vercel)
- Target URL: `https://jeongilpum-holiday-operations.vercel.app`

## Goal

사용자의 명시적 요청에 따라 '상품별 판매 통계'의 일자별 판매리스트 일괄 조회 탭 및 실무/차기 명절 대비 정규 엑셀(`.xlsx`) 다운로드 기능을 Vercel Production 환경에 안전하게 배포하고 라이브 상태를 검증한다.

## Non-goals

- DB schema 또는 migration 변경 없음 (기존 PostgreSQL DB 구조 유지)
- 운영 데이터 임의 변경 없음

## Claimed paths

- `docs/work/completed/20261003-codex-production-deploy-stats-daily-excel.md`
- Production deployment on Vercel (`jeongilpum-holiday-operations`)

## Execution Summary

1. `main` 브랜치로 전환 및 `codex/sales-product-stats-daily-excel` (`f1265b6`) Fast-forward 병합 완료.
2. `origin/main`으로 푸시 완료.
3. Vercel Production 1차 배포 실행:
   - Deployment ID: `dpl_9gfgHCi3sSysfXkp3ZRAQmWUKFHN`
   - 발생 이슈: 엑셀 내보내기 쿼리 내 `orders.order_number` 컬럼명 불일치로 인한 500 오류 (`SQL error: column o.order_number does not exist`).
4. 핫픽스 적용 (`d92d953`):
   - `app/api/sales/product-stats/export/route.ts`의 주문번호 컬럼명을 실제 스키마인 `o.order_no`로 수정하고 에러 디버그 메시지 강화.
   - 라이브 Supabase DB 쿼리 실행 검증: 2026년 9월 235개 운영 행 정상 조회 확인.
5. Vercel Production 2차 배포 완료:
   - Deployment ID: `dpl_8q3Qo9XmiagbkpcVwqQ9vgsyytgd`
   - URL: `https://jeongilpum-holiday-operations-f4ytivcqf-happy-butcher.vercel.app`
   - Production Aliased: `https://jeongilpum-holiday-operations.vercel.app`
   - Status: `READY`
6. Live Smoke Test:
   - `GET /api/products`: 200 OK (정규 12종 상품 + 활성 시즌 정상 반환)
   - `GET /sales`: 200 OK (판매장 UI 정상 서빙)
   - `GET /api/sales/product-stats/export`: 401 Unauthorized (운영자 인증 게이트 정상 보호 확인)


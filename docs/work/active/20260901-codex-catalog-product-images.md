# Task: 카탈로그 상품 사진 연결

- Status: Active
- Owner: Codex catalog-image task
- Branch: `codex/catalog-product-images`
- Base commit: `9337ea457b008e78821125a066b9cef8cc05200c`
- Started at: 2026-09-01
- Target environment: Production

## Goal

카탈로그 v23에서 각 상품에 사용한 사용자 제공 사진을 웹앱 정적 자산으로 최적화하고, DB에 별도 사진 URL이 없는 상품에 정확한 상품 ID 기반 기본 사진으로 표시한다.

## Non-goals

- 상품명·가격·구성 변경
- DB schema 또는 migration 변경
- `KioskApp.tsx` 및 현장판매 흐름 변경

## Claimed paths

- `public/products/**`
- `app/lib/catalog-product-images.ts`
- `app/api/products/route.ts`
- `tests/catalog-product-images.test.mjs`
- `docs/ARCHITECTURE.md`

## Shared contracts

- `GET /api/products`: 기존 `imageUrl` 필드를 유지하고 DB 값이 없을 때만 정적 카탈로그 사진 URL을 제공

## Dependencies

- `app/components/KioskApp.tsx`와 `tests/onsite-sales.test.mjs`는 활성 현장판매 작업 소유이므로 수정하지 않는다.
- `docs/PAGES_AND_FEATURES.md`는 활성 고객 장부 배포 작업 소유이므로 수정하지 않는다.

## Plan

1. 카탈로그 v23의 상품별 사진 매핑 확인
2. 웹용 이미지 최적화와 상품 API fallback 구현
3. 관련 테스트, lint, typecheck, 전체 test, build 검증
4. Sites 저장·배포와 결과 확인

## Acceptance criteria

- [ ] 12개 활성 상품이 카탈로그 v23과 일치하는 사진을 표시한다.
- [ ] O'meat 두 상품은 카탈로그와 동일한 공용 사진을 사용한다.
- [ ] 설정에서 저장한 비어 있지 않은 사진 URL은 기본 사진보다 우선한다.
- [ ] DB schema와 운영 데이터는 변경하지 않는다.

## Validation

- [ ] related test
- [ ] lint
- [ ] typecheck
- [ ] full test
- [ ] build
- [ ] local preview

## Integration notes

- 충돌 해결 내용: 활성 작업의 claim 경로를 수정하지 않는다.
- backward compatibility: `imageUrl` response field와 DB override 동작을 유지한다.
- Production 설정/migration 필요사항: 없음.

## Completion

- Final commit:
- Completed at:
- Remaining TODO:

# Task: 키오스크 로고와 상호 세로 배치

- Status: Completed
- Owner: Codex kiosk-brand task
- Branch: `codex/kiosk-brand-stack`
- Base commit: `f610a6d7754f9a177e83119db209ccedb585af10`
- Started at: 2026-09-01
- Target environment: Production

## Goal

키오스크 좌측 상단 브랜드 영역을 로고 위, 상호 아래의 2줄 구조로 바꾸고 상호 기준 중앙에 로고를 배치해 가운데 안내 문구와 조화를 맞춘다.

## Non-goals

- 가운데 안내 문구 내용 변경
- 상품·주문 흐름 변경
- DB 또는 API 변경

## Claimed paths

- `app/components/KioskApp.tsx`
- `app/kiosk-flow.css`
- `tests/v2-spec.test.mjs`

## Acceptance criteria

- [x] 로고가 상호 위에 배치된다.
- [x] 로고와 상호가 같은 중심축으로 정렬된다.
- [x] 가운데 안내 문구와 시각적 높이·간격이 조화롭다.
- [x] 모바일 헤더가 좁은 화면에서도 유지된다.

## Validation

- [x] lint: `npm run lint`
- [x] typecheck: `npm run typecheck`
- [x] full test: 66 passed
- [x] build: `npm run build`
- [x] Production deployment: Sites version 24

## Completion

- Final implementation commit: `59b6d79`
- Sites version: 24
- Production URL: `https://jeongilpum-chuseok-mvp.bonbu2012.chatgpt.site`
- Completed at: 2026-09-01
- Remaining TODO: 없음

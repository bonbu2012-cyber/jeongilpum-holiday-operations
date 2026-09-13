# Task: 네비게이션(AppNav) 우측 중단에서 우측 하단 접이식 독(바텀 시트)으로 이동

- Status: Active
- Owner: Codex
- Branch: `codex/collapsible-bottom-app-nav`
- Base commit: `6deb4ee`
- Started at: 2026-09-13
- Target environment: Vercel Production + Supabase DB

## Goal

1. 화면 우측 중앙에 고정되어 판매장/작업장 주문 데이터 테이블의 우측 열과 엑셀 버튼 시야를 가리던 세로형 `AppNav`를 제거한다.
2. 테이블 시야를 전혀 침범하지 않는 화면 우측 하단 가로형 플로팅 독(`bottom: 16px; right: 16px;`)으로 변경한다.
3. 원클릭으로 메뉴를 콤팩트한 미니 캡슐 버튼(`[ ☰ 메뉴 ]`)으로 축소할 수 있는 접기/펼치기 토글 기능을 구현한다.
4. Vercel Production에 빌드 및 배포하여 실서비스에 즉시 반영한다.

## Claimed paths

- `app/components/AppNav.tsx`
- `app/ui/navigation.css`
- `docs/PAGES_AND_FEATURES.md`
- `docs/work/active/20260913-codex-collapsible-bottom-app-nav.md`

# Task: 작업장 감열 라벨 1장 완벽 출력 및 2장 분할 방지 수정

- Status: Completed
- Owner: Codex
- Branch: `main`
- Base commit: `8ae3389`
- Started at: 2026-09-21T04:45:00+09:00
- Completed at: 2026-09-21T04:52:00+09:00
- Target environment: Production (Vercel)
- Target URL: `https://jeongilpum-holiday-operations.vercel.app/workshop`

## Goal

사용자 피드백("라벨이 한장안에 나오는 것이 아니라 2장에 걸쳐서 나오고 있어")을 해결한다. 감열 프린터(BEEPRT BY-48 등)의 하드웨어 마진(2~3mm)과 브라우저 인쇄 서브픽셀 라운딩으로 인해 100mm 카드가 2번째 장으로 밀려나는 문제를 원천 차단하고, 1장 안에 안전하게 수납되도록 인쇄 CSS 및 안전 규격(92mm/73mm), 용지 방향 전환 토글(세로형 80×100 vs 가로형 100×80), 그리고 브라우저 인쇄 필수 설정 가이드를 제공한다.

## Root Cause Analysis

1. **하드웨어 갭 마진과 CSS 카드 높이 충돌**:
   - 기존 CSS는 `@page { size: 80mm 100mm; }`에 카드 높이를 `height: 100mm; max-height: 100mm;`로 꽉 채워 설정함.
   - 감열 프린터 하드웨어 롤 이송 센서(Black Mark/Gap Sensor)와 드라이버의 물리적 비인쇄 영역(상하 2~3mm)으로 인해, 100mm 높이의 카드는 첫 장의 물리 출력 영역(약 94mm)을 초과하여 나머지 하단 6mm가 2번째 장으로 밀려남.
2. **`html, body { height: 100mm; }` 설정 문제**:
   - 다중 카드 인쇄 시 바디 높이를 100mm로 고정하여 브라우저의 페이지 분할 엔진이 오동작함 (`height: auto;`로 수정 필요).
3. **Chrome 인쇄 기본 여백 및 머리글/바닥글 개입**:
   - Chrome 인쇄창 기본 설정이 "여백: 기본"일 경우 상하 10mm씩 여백이 생겨 가용 높이가 80mm로 줄어들어 무조건 2장으로 분할됨.
   - 머리글/바닥글이 켜져 있으면 상단 URL과 하단 날짜가 추가되어 2장으로 분할됨.
4. **라벨 롤 삽입 방향 차이**:
   - 롤 라벨 구매 규격에 따라 80mm 폭에 100mm 피치(세로형)와 100mm 폭에 80mm 피치(가로형)가 존재함.

## Key Changes

1. **`app/components/WorkshopLabelModal.tsx`**:
   - 1장 맞춤 안전 카드 높이 도입: 세로형 `92mm`, 가로형 `73mm` (하드웨어 마진 4~8mm 확보하여 1장 안 100% 수납 보장).
   - 카드 패딩 최적화: 세로형 `2.5mm 4mm 2mm`, 가로형 `2mm 4.5mm 1.8mm`.
   - `html, body { height: auto; }` 및 `break-after: page; break-inside: avoid;` 명확화.
   - 인쇄 방향 토글 지원: `[세로형 (80×100)]` vs `[가로형 (100×80)]` 즉시 전환.
   - 모달 상단에 2장 분할 방지 필수 설정(여백 없음, 머리글/바닥글 체크 해제) 가이드 안내 박스 제공.
2. **`app/workshop-flow.css`**:
   - `.label-orientation-toggle`, `.orientation-btn`, `.orientation-btn.active` 스타일 추가.
   - `.label-card-preview.portrait` (80/100) 및 `.label-card-preview.landscape` (100/80) 비율 적용.
   - `.label-preview-guide` 가독성 강화.
3. **`tests/workshop-packing-slip-and-labels.test.mjs`**:
   - 80×100 및 100×80 방향 지원, 92mm/73mm 안전 높이, 폰트 규격, 방향 토글 버튼 검증 테스트 갱신.

## Validation Results

- [x] `node --test tests/workshop-packing-slip-and-labels.test.mjs`: 통과 (14/14 pass)
- [x] `npm run typecheck`: 통과 (0 errors)
- [x] `npm run lint`: 통과 (0 errors)
- [x] `npm run build`: 통과 (Next.js 15.2.9 프로덕션 빌드 성공, 19개 라우트 정상 컴파일)

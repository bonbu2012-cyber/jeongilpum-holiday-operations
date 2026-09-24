# Task: 모바일 최적화 독립 스킨팩 작업 계산기 제작

- Status: Completed
- Owner: Codex
- Branch: `codex/standalone-mobile-skinpack-calculator`
- Base commit: `fcbab6a`
- Started at: 2026-09-24T17:27:00+09:00
- Completed at: 2026-09-24T17:42:00+09:00
- Commit: `2278e94`

## 1. Goal

기존 사이트의 기능(출고 검수표, 작업지시서, 판매장/작업장 플로우 등)을 100% 온전히 유지하면서,
휴대전화(모바일)에서 언제든지 봉황, 팔영, 오미트 시그니처, 오미트 프레스티지 세트 수량만 입력하면
그에 맞는 162202 및 241702 용기 스킨팩 부위별 필요 팩수와 중량 규격을 실시간으로 산출해 주는 독립적인 사이트/도구를 제공한다.

## 2. Requirements & Deliverables

1. **Next.js 모바일 전용 독립 라우트 (`app/skinpack-calc/page.tsx`, `layout.tsx`, `skinpack-calc.css`)**:
   - 모바일 원터치 수량 조작 버튼: `+1`, `+5`, `+10`, `[-]`, `[+]`, 0개 리셋, 직접 숫자 입력(`inputMode="numeric"`)
   - 4종 세트 지원:
     - 봉황세트 (1,000g/5팩, 162202 용기): 치마/갈비/부채/제비 180g, 차돌박이 280g
     - 팔영세트 (1,260g/7팩, 162202 용기): 7부위 각 180g
     - 오미트 시그니처 (1,300g/6팩, 241702 용기): 5부위 200g, 차돌박이 300g
     - 오미트 프레스티지 (1,380g/6팩, 241702 용기): 6부위 각 230g (특수 안창살 포함)
   - 실시간 스킨팩 집계 대시보드 (162202 합계, 241702 합계, 총 합계 스티키 배너)
   - 작업장 현장 편의 기능:
     - 터치 완료 체크리스트 (행 터치 시 `✓` 및 취소선, 진행률 표시)
     - 화면 켜짐 유지 (Wake Lock API) 토글
     - 카카오톡/메신저 작업 지시 텍스트 복사 (원클릭 클립보드)
     - 모바일 인쇄 최적화 (`@media print`)
2. **단독 배포 및 오프라인 실행용 단일 파일 (`public/skinpack-calculator.html`)**:
   - 인터넷 연결이 없는 냉동창고에서도 단일 HTML 파일로 100% 동일하게 동작하는 Zero-dependency 웹앱
   - 홈 화면에 바로가기 추가(PWA standalone) 지원
3. **핵심 계산 엔진 및 단위 테스트 (`app/lib/skinpack-calculator.ts`, `tests/skinpack-calculator.test.mjs`)**:
   - 기존 SOP 스펙과의 100% 동일성 검증 단위 테스트 4종 모두 통과
4. **기존 기능 완전 보존**:
   - 기존의 `app/today/page.tsx`, `WorkshopPackingSlipModal.tsx`, `app/lib/workshop-packing-slip.ts` 등 일체 수정 없음

## 3. Verification

- `node --test tests/skinpack-calculator.test.mjs`: 통과 (4/4 pass)
- `npm run typecheck`: 통과 (오류 0개)
- `npm run lint`: 통과 (No ESLint warnings or errors)
- `browser_subagent` 모바일 뷰포트(430x932) 검증:
  - 봉황 11, 팔영 6 입력 시 162202 용기 97팩(치마 17, 갈비 17, 부채 17, 제비 17, 차돌 11 등) 실시간 산출 및 일치 확인
  - 차돌박이 행 터치 시 체크 표시 정상 동작
  - 정적 HTML(`/skinpack-calculator.html`)도 모바일에서 동일하게 정상 동작 확인

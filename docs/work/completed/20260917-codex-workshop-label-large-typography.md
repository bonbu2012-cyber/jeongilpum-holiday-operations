# Task: 50×50mm 감열 상품정보 라벨 가독성 개선 (상품명·주문자 대형 표기)

## 1. 개요
- **목적**: 작업장 50×50mm 감열 프린터(BEEPRT BY-48) 출력 라벨에서 글씨가 작아 상품 및 주문자 식별이 어렵다는 현장 피드백 해결.
- **핵심 요구**:
  - 상품명(예: '선', '진', '미', '갈비 1호')과 순번(예: '1/6')을 대형 폰트(15pt / 13.5pt)로 최우선 강조하여 멀리서도 즉시 식별 가능하도록 재설계.
  - 주문자명(예: '함형구')을 크고 선명한 폰트(12.5pt 볼드)로 전면 배치.
  - 50×50mm의 한정된 감열지 면적에서 빈 여백 낭비를 줄이고, 불필요한 부가정보의 공간을 줄여 핵심 식별 정보에 집중.
  - 화면 미리보기(Preview)와 실제 감열 인쇄(Print) 양쪽 모두 일관되게 적용.
  - 전화번호 하이픈 포맷팅 (`010-XXXX-XXXX`) 적용으로 가독성 향상.

## 2. 작업 대상 경로
- `app/components/WorkshopLabelModal.tsx`
- `app/workshop-flow.css`
- `tests/workshop-packing-slip-and-labels.test.mjs`

## 3. 검증 결과
- **테스트**: `tests/workshop-packing-slip-and-labels.test.mjs` (14/14 Pass)
- **정적 분석**: `npm run lint` & `npm run typecheck` 통과 (0 errors)
- **Next.js 프로덕션 빌드**: 19/19개 라우트 정상 빌드 통과 (Code 0)
- **GitHub Push**: `codex/workshop-label-large-typography` 및 `main` 반영 완료
- **Vercel 프로덕션 배포 완료**: https://jeongilpum-holiday-operations.vercel.app/workshop

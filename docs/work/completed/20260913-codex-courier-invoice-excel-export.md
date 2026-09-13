# Task: 택배사 송장 출력용 전용 엑셀(CSV) 서식 다운로드 기능 구현 완료

- Status: Completed
- Owner: Codex
- Branch: `codex/courier-invoice-excel-export`
- Base commit: `548aae0`
- Final commit: `HEAD`
- Started at: 2026-09-13
- Completed at: 2026-09-13
- Target environment: Vercel Production + Supabase DB

## Goal

1. 사용자가 요구한 택배사(로젠/CJ대한통운 등) 송장 출력 프로그램 업로드 전용 엑셀 서식에 100% 일치하는 CSV 생성 모듈(`app/lib/courier-invoice-csv.ts`)을 구현한다.
2. 서식 헤더 (11개 열 구조 완벽 일치):
   - `보내는사람(지정)`: 주문자명 (미기재 시 "정일품")
   - `주소(지정)`: 공란 ("")
   - `전화번호1(지정)`: 주문자 연락처 (숫자만, 미기재 시 "01071596872")
   - `받는사람`: 수령인명 (미기재 시 주문자명)
   - `전화번호1`: 수령인 연락처 (숫자만)
   - `우편번호`: 5자리 우편번호
   - `주소`: 도로명 + 상세 배송지 주소
   - H열: 공란 ("")
   - `수량(A타입)`: 수량 (기본 1)
   - `상품명1`: 택배사 지정 품명 ("신선식품. 육류")
   - `배송메시지`: 배송 요청사항
3. 판매장(`SalesApp.tsx`) 및 작업장(`WorkshopApp.tsx`)에 [📦 택배 송장 엑셀] 버튼을 배치하여 당일/선택 기간의 택배발송 주문 건만 원클릭으로 엑셀(CSV) 추출할 수 있도록 연동한다.
4. Microsoft Excel 호환을 위해 UTF-8 BOM(`\uFEFF`)과 따옴표/특수문자 이스케이프를 적용한다.

## Validation Results

1. **단위 테스트**: `node --experimental-strip-types --test tests/courier-invoice-csv.test.mjs` (3/3 Pass)
2. **타입 체크**: `npm run typecheck` (0 errors)
3. **린트**: `npm run lint` (0 errors)
4. **프로덕션 빌드**: `npm run build` 성공 (Next.js 15.2.9 최적화 빌드 완료)

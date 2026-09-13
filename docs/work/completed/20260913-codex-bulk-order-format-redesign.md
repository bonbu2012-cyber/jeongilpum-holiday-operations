# Task: Redesign Bulk Order Excel Template and Importer

- Status: Completed
- Owner: codex
- Branch: codex/bulk-order-format-redesign
- Base commit: 4ed1efe
- Started at: 2026-09-13T20:58:00+09:00
- Completed at: 2026-09-13T21:09:00+09:00
- Target environment: Production
- Related issue/spec: Bulk order Excel format redesign based on user specifications

## Goal

사용자 요청에 맞춰 대량 주문 엑셀 양식(`.xlsx`)을 실무에 최적화된 새로운 15개 열 포맷(`출고일`, `수령방식(드롭다운)`, `주문자명`, `주문자연락처`, `상품명(드롭다운+기타)`, `수량`, `단가(자동수식)`, `합계금액(자동수식)`, `받는사람`, `받는사람연락처`, `받는주소`, `방문시간`, `배송메시지`, `결제상태(드롭다운)`, `비고/기타상품내용`)으로 전면 재설계하고, 웹앱(`/bulk-orders`)에서 다운로드 및 업로드, 미리보기, 일괄 접수까지 완전히 연동되도록 한다.

## Accomplishments

1. **Excel Template (`public/templates/jeongilpum-bulk-orders.xlsx`)**:
   - 15개 필수/선택 열 구성: `출고일(희망수령일)*`, `수령방식*`, `주문자명*`, `주문자연락처*`, `상품명*`, `수량*`, `단가`, `합계금액`, `받는사람`, `받는사람연락처`, `받는사람주소`, `방문시간`, `배송메시지`, `결제상태`, `비고(기타상품내용/메모)`
   - 데이터 유효성 검사 드롭다운:
     - `수령방식`: `현장수령`, `택배`, `배달`
     - `상품명`: 12개 정규 세트 + `기타`
     - `결제상태`: `미결제`, `결제완료`
   - 자동 계산 수식:
     - 단가: `=IF(E6="기타","",IFERROR(VLOOKUP(E6,상품목록!$A$2:$B$13,2,FALSE),""))`
     - 합계금액: `=IF(OR(F6="",G6=""),"",F6*G6)`
   - 시트 구성:
     - `주문입력`: 6행부터 즉시 입력 가능한 본 시트 (자동수식 및 드롭다운 적용)
     - `작성예시`: 현장수령, 택배, 기타 맞춤주문 예시 데이터 제공
     - `상품목록`: VLOOKUP 참조 및 정가 목록 시트
2. **Parser & Validation (`xlsx-order-reader.ts`, `bulk-order-import.ts`)**:
   - 신규 15열 양식 및 기존 16열 양식 자동 감지 및 파싱
   - 단일 주소 문자열(`받는사람주소`) 자동 처리 (우편번호/상세주소 분리 불필요)
   - `기타` 상품 선택 시 `custom-order` 매핑 및 비고 품목명/수동 단가 처리
   - 동일 수령자/배송지/일정 자동 그룹핑
3. **UI Preview (`BulkOrderUploadApp.tsx`)**:
   - 결제상태 뱃지(`결제완료`/`미결제`) 컬럼 추가
   - 수령방식, 주문자/수령인, 일정/주소, 상품/수량, 합계금액 미리보기 테이블 강화
4. **Backend Route (`/api/orders/bulk/route.ts`)**:
   - `custom-order` 허용 및 비고 커스텀 내용 `work_items.customization_json`에 보존
   - 양식의 결제상태(`paid`/`unpaid`) 및 `paid_amount` 반영
   - D1 원자적 배치 저장 및 파일 해시 기반 멱등성 유지

## Verification Results

- `node --test tests/bulk-order-import.test.mjs`: 9개 테스트 통과
- `node --test tests/legacy-csv-import.test.mjs`: 4개 테스트 통과
- `npm run typecheck`: 통과 (0 errors)
- `npm run lint`: 통과 (0 errors)
- `npm run build`: 프로덕션 빌드 성공 (0 errors)

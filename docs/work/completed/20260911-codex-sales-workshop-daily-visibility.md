# Task: 판매장·작업장 당일 운영 가시성

- Status: Complete
- Owner: Codex
- Branch: `codex/sales-workshop-daily-visibility`
- Base commit: `4a3094e8c0ae4d49d1719d34c967302618fde6b0`
- Started at: 2026-09-11
- Completed at: 2026-09-11
- Target environment: Local validation only

## Goal

현재 웹앱 형태를 유지하면서 판매장에서 고객·상품별 결제와 작업 상태를 한눈에 확인하고, 작업장에서 당일 봉황·팔영·오미트 주문을 부위별 스킨팩 필요 수량으로 바로 확인할 수 있게 한다. 대량주문용 엑셀에는 현장수령시간 선택 목록을 제공한다.

## Delivered

- 판매장 상단에 오늘 고객별 상품 작업상태·결제상태 통합표와 요약 수치를 추가했다.
- 작업장 상단에 봉황세트, 팔영세트, 오미트 2종의 오늘 부위별 스킨팩 필요량 표를 추가했다.
- 생산관리, 스킨팩, 이력추적, 패키지 바로가기 묶음을 작업장 화면에서 숨겼다.
- 현장수령시간을 08:00~21:00 사이 30분 단위로 선택하는 새 대량주문 XLSX를 추가했다.
- 기존 주문·결제·작업 API와 기존 생산 데이터를 삭제하거나 변경하지 않았다.

## Validation

- [x] focused tests: 13 passed
- [x] changed-file lint: passed
- [x] typecheck: passed
- [x] build: passed
- [x] workbook inspect/render: passed; `M6:M205`에 27개 시간 선택값 저장 확인
- [ ] full lint: 기존 비관련 파일의 미사용 변수 5건으로 실패
- [ ] full test: 기존 비관련 회귀 테스트 19건 실패, 29건 통과

## Completion

- Final implementation commit: `9a18243`
- GitHub remote/branch: `github/codex/sales-workshop-daily-visibility`
- Push verification: `8714712..9a18243` 전송 성공
- Production deployment: 실행하지 않음
- Remaining TODO: 기존 브랜치에 이미 존재하던 전체 lint/test 실패는 별도 정리 필요

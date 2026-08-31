# 페이지와 기능

## 공통 navigation과 branding

- `AppNav`는 메인, 판매장, 작업장, 설정으로 이동한다.
- 데스크톱은 우측 고정 세로 배너, 좁은 화면은 우측 하단 가로 배너다.
- 정일품 로고와 `정일품 정육식당` 표기를 공통 사용한다.
- 고정 계절 문구를 사용하지 않는다.

## `/`, `/kiosk` 고객 키오스크

### 상품

- 카테고리별 상품표시와 고정 category rail
- 상품명, 설명, 가격, 중량/구성, badge, 이미지 URL
- 사진이 없으면 placeholder
- 수량 증감, 장바구니 수량과 금액 계산
- 한정상품 잔여수량과 예약마감 표시

### 주문 초안

- 장바구니, 맞춤주문, 고객정보, 주소, 일정을 sessionStorage에 임시 저장
- hydration 이후에만 sessionStorage에 쓰기
- 뒤로가기와 맞춤주문 왕복 시 입력 유지
- 주문 성공 후 초안 제거

### 방문수령

- 텍스트형 방문수령/택배발송 선택
- 주문자 또는 회사명, 전화번호
- 캘린더 날짜선택
- 오늘과 선택 상태 구분
- 과거·마감 날짜 비활성화
- 08:00~21:00, 30분 단위 시간선택

### 택배

- 주문자와 수령인 정보 분리
- Kakao 우편번호 검색
- 우편번호, 도로명주소, 지번주소, 참고항목 분리
- 상세주소 입력
- 주소 직접입력 fallback
- 발송일 캘린더
- 최종확인에서 실제 배송주소 강조

### 주문접수

- 최종 상품·수량·금액·일정 확인
- `POST /api/orders`
- 중복 제출 방지
- DB commit 성공 후에만 완료화면

## `/kiosk/custom` 맞춤주문

- 5개 카테고리
- 최소 예산 200,000원
- 예산 직접입력과 validation
- 구성, 부위, 지방, 포장, 기타 요청
- 완료 후 main kiosk draft의 `customItem`에 병합
- `/kiosk?resume=cart`로 복귀
- 최종 주문에서 customization row 생성

## `/sales` 판매장

- 날짜별 고밀도 주문표
- 방문수령은 pickup date, 택배는 ship date 기준
- 전체/방문/택배/상태/고객도착 필터
- 주문번호·고객명·전화번호·수령인 검색
- 날짜별 cancelled 제외, 검색에서 cancelled history 조회
- 주문 행 클릭 상세
- 메인표 인라인 수정 금지
- 고객도착 등록
- 작업장 상태 표시
- 동일 이름·전화번호 고객의 여러 주문을 하나의 결제·미수 장부로 집계
- 고객 총 주문, 순입금, 미수금, 선수금, 결제상태를 주문표와 상세에서 표시
- 결제수단(현금·카드·계좌이체), 실제 결제자 선택정보, 결제일시와 메모 기록
- 결제금액을 상품·주문에 임의 배분하지 않고 고객 총 잔액으로 계산
- 방문수령일·택배발송일 기준 예정/오늘/연체 표시
- 원본을 보존하는 결제 정정, 상담 메모 후 선택 주문 장부 분리
- 일정 미지정 legacy 주문 건수 및 검색
- legacy 주문의 fulfillment 수동 생성
- 날짜별 한정상품 availability
- 2.5초 polling, focus/online refetch

## `/admin` 호환 판매장

- 기존 운영 흐름을 위한 호환 route
- 주문 검색과 일정 미지정 주문 관리
- 운영자 로그인 오류 안내
- 신규 기능은 우선 `/sales`에 구현하고 `/admin` 영향 여부를 검사한다.

## `/workshop` 디지털 화이트보드

- 선택 날짜의 방문/택배 작업 조회
- 전체, 작업대기, 수락완료, 작업중, 준비완료, 고객도착, 변경확인 필터
- 시간순 timeline
- 작업수락, 작업시작, 준비완료 분리
- 60/30/15분과 지연 긴급도
- ready 주문은 긴급도 제외
- 고객도착 주문 우선배치
- 실제 도착시각 대비 조기도착·지연 계산
- 상품별 총 필요·완료·남은수량
- 미완료 기준 `next_due_at`
- 대체 완성품 후보와 package reassignment fallback
- 결제정보 미노출

## `/workshop/production` 생산관리

현재 최신 로컬 통합본에 있으며 Production Version 20에는 미배포다.

- 선택 날짜 주문수량 기반 BOM 집계
- 부위별 필요팩, 가용팩, 추가 필요량
- production target
- Production Batch 생성·목표조정·완료
- 이력번호, 원산지, 도축장, 축종, 등급
- HID scanner/manual 입력
- 최근 이력번호와 작업자 cache
- 이력번호 변경 시 새 immutable segment
- 중량 입력으로 Skin Pack과 label 생성
- Batch별 Open Label long CSV

## `/workshop/packages/:packageCode` 패키지

현재 최신 로컬 통합본에 있으며 Production Version 20에는 미배포다.

- 패키지와 주문·일정 확인
- 부위별 Skin Pack 구성
- 가용팩 FIFO, 중복배정 방지
- all-or-nothing package assembly
- 개인정보 없는 내부 QR
- package label preview/version/void
- package별 long CSV
- assignment history
- 조기도착 우선 조립
- 조건부 1:1 package reassignment와 라벨 재출력 요구

## `/settings` 설정

- 상품 category, 이름, 설명, 가격, 표시중량, 사진 URL, badge, 순서, 활성상태
- 판매기간과 방문/택배 가능기간
- settings 기반 kiosk headline
- optimistic version update
- `configuration_events` 감사이력

현재 미지원:

- 이미지 파일 업로드
- 운영자 allowlist UI
- 시간간격·휴무일 UI
- BOM 편집 UI
- 라벨 템플릿 편집 UI
- 실제 결제 gateway 설정

## 접근 권한 요약

| Route | 인증 | 운영자 allowlist |
|---|---|---|
| `/`, `/kiosk`, `/kiosk/custom` | 불필요 | 불필요 |
| `/sales`, `/admin` | 필요 | API에서 필요 |
| `/workshop/**` | 필요 | API에서 필요 |
| `/settings` | 필요 | API에서 필요 |

`/sales` 안의 고객 결제·미수 장부는 위 인증에 더해 직원 패스워드를 요구한다. 장부 세션은 비활동 5분 후 잠기며 결제·정정·장부 분리 적용 때 관리자 패스워드를 다시 확인한다.

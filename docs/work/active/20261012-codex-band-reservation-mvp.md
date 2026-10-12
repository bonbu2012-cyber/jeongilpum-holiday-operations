# Task: BAND 예약 MVP

- Status: Active
- Owner: Codex
- Branch: `codex/band-reservation-mvp`
- Base commit: `192d37de01527e758ab7cd62d49b400921b0b3a8`
- Started at: 2026-10-12
- Target environment: Preview/MVP validation only

## Goal

11월 정식 출시 전 10월에 검증할 BAND 전용 예약 MVP를 구축한다.
고객은 회원가입 없이 이름·휴대전화·수량·예상 픽업시간을 입력해 예약하고,
운영자는 판매회차·생산한도·예약·수령·노쇼·고객 재구매 이력을 관리한다.
10월 MVP에서는 실제 예약금 결제를 하지 않고 테스트 결제 상태로 흐름만 검증한다.

## Claimed paths

- `app/band-reserve/**`
- `app/band-admin/**`
- `app/components/BandReserveApp.tsx`
- `app/components/BandAdminApp.tsx`
- `app/api/band-sales/**`
- `app/api/band-reservations/**`
- `app/api/band-customers/**`
- `app/lib/band-reservation.ts`
- `app/ui/band-reservation.css`
- `app/globals.css` (exclusive shared-zone claim for this task)
- `db/schema.ts` (exclusive shared-zone claim for this task)
- `drizzle/0009_band_reservation_mvp.sql`
- `drizzle/meta/_journal.json`
- `scripts/migrate-postgres.mjs`
- `docs/BAND_RESERVATION_MVP.md`
- `docs/DATA_AND_MIGRATIONS.md`
- `tests/band-reservation.test.mjs`
- `docs/work/active/20261012-codex-band-reservation-mvp.md`

## Shared contracts

- DB tables: `band_sales`, `band_reservations`, `band_reservation_events`
- Public route: `/band-reserve`
- Operator route: `/band-admin`
- APIs: `/api/band-sales`, `/api/band-reservations`, `/api/band-customers`
- Customer identity: normalized mobile phone number
- 10월 결제모드: `test` (실제 결제 없음)
- 11월 목표: payment provider layer에 KakaoPay 연결
- 환불정책: 생산확정 전 취소는 환불 대상, 생산확정 후·수령 당일 취소·노쇼는 예약금 환불 없음

## Coordination

- `.env.example`은 active customer-ledger task가 claim 중이므로 이 작업에서는 수정하지 않는다.
- `docs/PAGES_AND_FEATURES.md`, `docs/API_AND_INTEGRATIONS.md`는 다른 active task claim과 충돌하므로 이번 MVP에서는 전용 as-built 문서 `docs/BAND_RESERVATION_MVP.md`에 기록한다.
- 기존 `/api/orders`, order status/event contract는 변경하지 않는다.

## Plan

1. 독립 BAND 예약 schema와 migration을 추가한다.
2. 공개 예약 페이지와 운영자 페이지를 구현한다.
3. 생산한도 동시성 제어와 예약 상태 변경을 구현한다.
4. 고객 재구매·노쇼 요약 DB 화면을 구현한다.
5. 테스트 결제 흐름으로 10월 MVP를 검증한다.
6. lint/typecheck/test/build 및 migration 검증 후 Preview 후보로 만든다.
7. 실제 KakaoPay/SendOn 연동은 별도 후속 task로 진행한다.

## Acceptance criteria

- [ ] 회원가입 없이 예약 가능
- [ ] 생산한도 초과 예약 차단
- [ ] 예상 픽업시간 수집
- [ ] 환불정책 동의 기록
- [ ] 운영자가 수령완료/취소/노쇼 처리 가능
- [ ] 고객별 재구매·노쇼 누적 확인
- [ ] 실제 결제 없이 TEST PAYMENT 표시
- [ ] 기존 주문/판매장/작업장 기능 회귀 없음

## Validation

- [ ] lint
- [ ] typecheck
- [ ] focused test
- [ ] full test
- [ ] build
- [ ] db:generate
- [ ] 0000~0009 isolated local migration
- [ ] mobile reservation smoke
- [ ] operator reservation smoke

## Integration notes

- 작업 시작 직후 저장소의 AGENTS 규칙을 확인하기 전에 임시 staging branch에서 구현을 시작했으며,
  규칙 확인 후 `codex/band-reservation-mvp`로 전환하고 충돌 claim을 재점검했다.
- Production migration/deployment는 사용자 별도 승인 전 실행하지 않는다.

## Completion

- Final implementation commit:
- GitHub remote/branch:
- Push verification:
- Completed at:
- Remaining TODO: KakaoPay 실결제, SendOn 예약/픽업 문자, 정식 디자인 확정

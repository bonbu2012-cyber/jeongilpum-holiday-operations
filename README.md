# 정일품 명절 선물세트 예약·운영 시스템

명절 선물세트 고객 주문, 판매장 처리, 작업장 준비와 방문수령·택배 흐름을 연결하는 태블릿 우선 웹앱입니다. 현재 구현 범위는 v2.1 명세의 Phase 0~1입니다.

## 기술 스택

- Vinext 기반 Next.js App Router, React, TypeScript strict
- Tailwind CSS, Framer Motion
- Sites D1 + Drizzle(현재 배포 런타임)
- Supabase Postgres/Auth/Realtime/Storage 전환용 migration
- Cloudflare Worker-compatible ESM

## 설치 및 실행

Node.js 22.13 이상에서 의존성을 설치한 뒤 실행합니다.

```bash
pnpm install
pnpm dev
```

주요 화면:

- `/kiosk`: 고객 주문
- `/admin`: 판매장 업무
- `/workshop`: 작업장 업무

## 환경변수

`.env.example`을 복사해 `.env.local`을 만들고 값을 입력합니다. `.env.local`과 모든 secret은 커밋하지 않습니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용
- `OPERATOR_USER_IDS` — 판매장·작업장 API 접근 허용 사용자 ID 목록

## D1 migration

`db/schema.ts` 변경 후:

```bash
pnpm db:generate
```

생성된 `drizzle/*.sql`을 검토하고 앱 버전과 함께 배포합니다. 현재 migration에는 상품 seed, 중복주문 unique index, 상태 검증, 주문 hard-delete 차단이 포함됩니다.

## Supabase local

Supabase CLI 구성 후:

```bash
npx supabase start
npx supabase db reset
```

새 migration은 `supabase/migrations/`에 기록합니다. 운영 프로젝트에 적용 전에는 반드시 `npx supabase db push --dry-run`으로 검토합니다.

운영 DB에서는 절대로 `npx supabase db reset --linked`를 실행하지 마세요.

## Supabase 타입 생성

프로젝트 연결 후 아래 명령으로 `src/types/database.types.ts`를 갱신합니다.

```bash
npx supabase gen types typescript --linked > src/types/database.types.ts
```

현재 파일은 Phase 1 테이블을 표현한 로컬 계약이며, 원격 migration 적용 후 생성 타입으로 교체해야 합니다.

## 인증과 역할

- 고객 키오스크 주문 제출은 로그인 없이 가능하며 기존 주문 조회 권한은 없습니다.
- 판매장·작업장 페이지는 로그인 후 접근합니다.
- 주문 목록·상태 API는 서버에서 `OPERATOR_USER_IDS`를 재검증합니다.
- Supabase 전환 후 `user_profiles.role`과 RLS가 sales/admin/superadmin/workshop 권한을 강제합니다.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## 배포

현재 Sites 프로젝트는 `.openai/hosting.json`의 D1 binding을 사용합니다. Supabase/Vercel 운영 전환 시 Vercel에 세 개의 Supabase 환경변수를 설정하고, production migration을 앱 배포 순서와 호환되게 먼저 검증합니다.

## Git 흐름

큰 변경은 feature branch에서 작업하고 검증 후 main에 병합합니다. migration과 앱 변경은 같은 release에서 추적 가능하게 커밋합니다.

## Troubleshooting

- 상품이 보이지 않음: D1/Supabase migration과 seed 적용 여부 확인
- 운영 화면 401: ChatGPT/Supabase 로그인 확인
- 운영 화면 403: `OPERATOR_USER_IDS` 또는 `user_profiles.role` 확인
- 주문 409: 중복 제출 또는 optimistic concurrency 충돌이므로 최신 주문을 다시 조회
- 배송 접수 실패: 받는 분 연락처와 확정 주소 확인

## 배포 전 체크

실제 운영 전에는 Supabase project 연결, 생성 타입 동기화, RLS 테스트, 태블릿 실기기 테스트, 주문 중복 테스트, 백업 정책 확인이 필요합니다.

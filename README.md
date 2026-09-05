# 정일품 명절 선물세트 예약·운영 시스템

명절 선물세트 고객 주문, 판매장 처리, 작업장 준비와 방문수령·택배 흐름을 연결하는 태블릿 우선 웹앱입니다.

## 기술 스택

- Vinext/Vite, React, TypeScript strict
- Cloudflare Workers D1 + Drizzle migration tooling
- Framer Motion
- Cloudflare Worker-compatible ESM

## 설치 및 실행

Node.js 22.13 이상에서 의존성을 설치한 뒤 실행합니다.

```bash
npm install
npm run db:local
npm run dev
```

주요 화면:

- `/kiosk`: 고객 주문
- `/sales`: 판매장 업무
- `/workshop`: 작업장 업무
- `/settings`: 상품과 판매기간 설정

## 환경변수

`.env.example`을 복사해 `.env.local`을 만들고 값을 입력합니다. `.env.local`과 모든 secret은 커밋하지 않습니다.

- `OPERATOR_PASSCODE` — 판매장·작업장·설정 화면에 사용하는 공용 운영 암호

## D1 migration

`db/schema.ts` 변경 후:

```bash
pnpm db:generate
```

생성된 `drizzle/*.sql`을 검토하고 앱 버전과 함께 배포합니다. 현재 migration에는 상품 seed, 중복주문 unique index, 상태 검증, 주문 hard-delete 차단이 포함됩니다.

`npm run db:local`은 `drizzle/meta/_journal.json` 순서대로 모든 migration을 project-local Wrangler D1에 적용합니다. 이미 적용된 동일 로컬 D1에서 다시 실행하면 SQL 생성 구문이 실패하므로, 최초 실행 상태에서 사용합니다.

## 인증과 역할

- 고객 키오스크 주문 제출은 로그인 없이 가능하며 기존 주문 조회 권한은 없습니다.
- 판매장·작업장·설정 페이지는 공용 운영 암호 입력 후 접근합니다.
- 운영 API는 HttpOnly 운영 세션을 서버에서 재검증합니다.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## 배포

현재 Sites 프로젝트는 `.openai/hosting.json`의 D1 binding을 사용합니다. Production migration은 앱 배포 순서와 호환되게 먼저 검증합니다.

## Git 흐름

큰 변경은 feature branch에서 작업하고 검증 후 main에 병합합니다. migration과 앱 변경은 같은 release에서 추적 가능하게 커밋합니다.

## Troubleshooting

- 상품이 보이지 않음: D1 migration 적용 여부 확인
- 운영 화면 401: 공용 운영 암호를 다시 입력
- 주문 409: 중복 제출 또는 optimistic concurrency 충돌이므로 최신 주문을 다시 조회
- 배송 접수 실패: 받는 분 연락처와 확정 주소 확인

## 배포 전 체크

실제 운영 전에는 태블릿 실기기 테스트, 주문 중복 테스트, backup 정책 확인이 필요합니다.

# Task: 운영 화면 공유 암호 세션 전환

- Status: Active
- Owner: Codex
- Branch: `codex/operator-passcode`
- Base commit: `c600613cc34bab9aa77bbeb2caccf0a343cb7fc3`
- Started at: 2026-09-02
- Target environment: Local development

## Goal

ChatGPT 로그인과 운영자 allowlist를 단일 운영 암호 기반의 서버 세션으로 교체한다. 키오스크 공개 주문 흐름과 동결 경로는 변경하지 않는다.

## Claimed paths

- `app/chatgpt-auth.ts`
- `app/lib/operator-auth.ts`
- `app/lib/operator-session.ts`
- `app/lib/customer-ledger-auth.ts`
- `app/api/**/route.ts`
- `app/api/operator-session/route.ts`
- `app/sales/page.tsx`
- `app/workshop/page.tsx`
- `app/workshop/production/page.tsx`
- `app/workshop/packages/[packageCode]/page.tsx`
- `app/settings/page.tsx`
- `app/components/PasscodeGate.tsx`
- `app/components/SalesApp.tsx`
- `app/components/SettingsApp.tsx`
- `app/components/WorkshopApp.tsx`
- `app/globals.css`
- `.env.example`
- `.gitignore`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/API_AND_INTEGRATIONS.md`
- `docs/PAGES_AND_FEATURES.md`
- `docs/SECURITY_AND_RELIABILITY.md`
- `tests/onsite-sales.test.mjs`
- `tests/v2-spec.test.mjs`

## Shared contracts

- 운영 API는 유효한 `jip_operator` HttpOnly 세션 쿠키를 요구한다.
- `GET /api/products`와 모든 `POST /api/orders`는 공개 상태를 유지한다.

## Validation

- [ ] npm ci
- [ ] lint
- [ ] typecheck
- [ ] full test before and after comparison
- [ ] build
- [ ] local curl smoke
- [ ] kiosk frozen diff
- [ ] legacy auth grep

## Completion

- Final implementation commit:
- Completed at:
- Remaining TODO:

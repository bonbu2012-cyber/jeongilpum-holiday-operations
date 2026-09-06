# Production UI rollout

- Owner: Codex
- Started: 2026-09-06
- Base: Sites `main` at `54c34d7369cc705c3c1e01601958114b3defb281`
- Production baseline: Sites Version 27
- Scope: kiosk customer/request/pickup-time UI, custom-order entry and display, shared money inputs, related order/workshop API compatibility, tests, and as-built docs
- Claimed paths: `app/components/KioskApp.tsx`, `app/components/CustomOrderApp.tsx`, `app/components/MoneyInput*`, `app/components/CustomOrderDetails.tsx`, `app/components/CustomerLedgerApp.tsx`, `app/components/SettingsApp.tsx`, `app/components/Sales*`, `app/components/WorkshopApp.tsx`, `app/api/orders/route.ts`, `app/api/workshop/orders/route.ts`, `app/lib/input-format.ts`, `app/lib/workshop-types.ts`, `app/globals.css`, `package.json`, related tests and docs
- Database: no schema or migration change; application-only rollout
- Validation: lint, typecheck, 71 tests, build passed
- Deployment: Sites Version 28 published successfully
- Implementation commit: `73126c9bb1c4a953453066e483a0012af3e7ad8a`
- GitHub merge: PR #3, main `a92d9dcfe2d6743f75a43c65fdd060b6a5bb0e28`
- Production URL: `https://jeongilpum-chuseok-mvp.bonbu2012.chatgpt.site`
- Verification: D1 table set unchanged; no migration; owner-only authentication gate responds 401 when unauthenticated; no application error-level worker log after publish
- Completed: 2026-09-06

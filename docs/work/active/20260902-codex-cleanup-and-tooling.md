# Task: Repository cleanup and local tooling

- Status: Active
- Owner: Codex
- Branch: `codex/cleanup-and-tooling`
- Base commit: `4db9189`
- Started at: 2026-09-02
- Target environment: Local
- Related issue/spec: https://github.com/drmr2000/jeongilpum-holiday-operations/issues/1

## Goal

Remove the explicitly retired subsystems and abandoned framework artifacts, add an isolated local D1 migration runner, and remove Tailwind only if the kiosk computed-style comparison proves that its rendering remains unchanged.

## Non-goals

- Do not change database schema or migrations.
- Do not change kiosk source files or kiosk flow CSS.
- Do not deploy or create a pull request.

## Claimed paths

- `supabase/**`
- `examples/**`
- `src/types/database.types.ts`
- `src/**`
- `pnpm-lock.yaml`
- `next.config.ts`
- `next-env.d.ts`
- `app/control-room/**`
- `app/api/control-room/**`
- `app/lib/control-room-*.ts`
- `app/components/ControlRoomApp.tsx`
- `app/admin/**`
- `app/components/AdminApp.tsx`
- `app/api/orders/payments/route.ts`
- `app/api/custom-orders/route.ts`
- `app/api/availability/route.ts`
- `app/api/orders/onsite-access/route.ts`
- `tests/onsite-sales.test.mjs`
- `scripts/wrangler.jsonc`
- `scripts/db-local.mjs`
- `package.json`
- `package-lock.json`
- `app/globals.css`
- `postcss.config.mjs`
- `docs/specs/jeongilpum_codex_spec_v2_1.md`
- `docs/specs/jeongilpum_system_technical_overview.txt`
- `docs/DEVELOPMENT_AND_TESTING.md`
- `docs/work/active/20260902-codex-cleanup-and-tooling.md`
- `docs/work/completed/20260901-codex-control-room.md`

## Shared contracts

- D1 binding: `DB`
- Local migration source: `drizzle/meta/_journal.json`
- Global CSS reset, subject to kiosk style-equivalence verification

## Dependencies

- First merged task/commit: None
- Waiting task: Wave 2 raw D1 conversion for `app/api/products/route.ts`

## Plan

1. Verify references and preserve the kiosk style baseline.
2. Remove only the explicitly retired files and their remaining references.
3. Add the isolated local D1 migration runner and update package dependencies.
4. Validate all checks, then attempt Tailwind removal in a final isolated commit.

## Acceptance criteria

- [ ] Retired paths and stale references are removed.
- [ ] Root specifications live under `docs/specs/`.
- [ ] `npm run db:local` applies migrations in journal order.
- [ ] Kiosk-protected paths have no diff from `main`.
- [ ] Tailwind is removed only if computed styles remain identical.

## Validation

- [ ] lint
- [ ] typecheck
- [x] full test before changes: 66 tests passed
- [ ] build
- [ ] local D1 migration test
- [ ] kiosk computed-style comparison

## Integration notes

- Baseline lint, typecheck, and build could not run before dependency installation because local executables and type definitions were absent.
- No database migration or Production deployment is included.

## Completion

- Final commit:
- GitHub remote/branch:
- Push verification:
- Completed at:
- Remaining TODO:

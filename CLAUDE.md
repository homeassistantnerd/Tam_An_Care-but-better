# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Tâm An Care: nursing-home management platform (Vietnamese UI). npm monorepo with two workspaces, `api/` (NestJS 12, `pg`, no ORM) and `frontend/` (React 18 + Vite PWA, TanStack Query, React Router 7), on PostgreSQL 16. `main` is the only long-lived branch; old branch tips are kept as `archive/*` tags.

## Commands

Each workspace has its own lockfile (Docker builds them independently), so install per workspace, never at the root:

```bash
npm ci --workspaces=false --prefix api
npm ci --workspaces=false --prefix frontend
```

```bash
npm run build              # nest build + tsc -b && vite build (frontend prebuild rejects VITE_API_BASE_URL=/api)
npm test                   # api tests, frontend tests, then scripts/run-ops-tests.sh (ops/ci, no DB)
npm run test:integration   # scripts/ci-integration.sh: needs a throwaway PostgreSQL 16 on 127.0.0.1:5432, superuser finance_ci/finance_ci_only
npm run security:audit
npm run start:api          # :3000, Swagger at /docs outside production
npm run start:frontend     # :5173, Vite proxies /api -> 127.0.0.1:3000
npm run db:bootstrap       # empty DB only: PGHOST/PGUSER/PGPASSWORD/PGDATABASE=... sh database/bootstrap.sh
npm run db:seed            # demo data, password TamAn@2026 for every seeded staff (e.g. TA-DIR-01)
docker compose up -d --build   # postgres (bootstraps an empty volume) + api + nginx web on :5173
```

Single tests (API `.cjs` tests load `api/dist`, so build first; `npm test` in `api/` has a `pretest` build):

```bash
node --experimental-strip-types --test api/test/smoke.test.mts      # TS tests, no build needed
node --test api/test/staff-rbac-controller.isolated.test.cjs        # after npm run build --workspace=api
node --test frontend/test/rbac-api.test.cjs                         # transpiles src/ with typescript in a vm
node ops/ci/finance-monthly-operating-result-test.cjs                # ops/ci tests are plain scripts, run from repo root
```

Test layout: `api/test/*.test.mts` (strip-types), `api/test/*.test.cjs` (compiled controllers/services with stubbed DB), `api/test/*.integration.cjs` (real PostgreSQL, run only by `ci-integration.sh`), `ops/ci/*.cjs` (finance/contract regression; the five DB-backed ones are listed in `scripts/run-ops-tests.sh`). CI is the single workflow `.github/workflows/ci.yml` (jobs `build-test` and `integration`).

## Architecture

**Identity and authorization (API).** In production, `security/production-auth.middleware.ts` (applied to `*` by `SecurityModule`) verifies the HS256 JWT, checks the `auth_sessions` row (not revoked/expired), and revalidates the current `staff_actors` row on every request (must be `ACTIVE`, same role, not modified after the session was issued). It then overwrites `x-actor-id` / `x-actor-role` headers, and controllers read identity only from those headers. Outside production the middleware is a no-op, so headers sent by the frontend are trusted — never expose a non-production API. Public paths: `/api/auth/login`, `/api/health*`. The canonical role list is `security/actor-roles.ts` (16 roles incl. `GUARDIAN`); DB CHECK constraints on `staff_actors` and `auth_sessions` must stay in sync with it.

Each domain authorizes in its own service (`*-authorization` modules, `requireHuman`-style checks rejecting `AI`/`SYSTEM` for clinical mutations). Per-resident access goes through `resident-access-scope/ResidentAccessScopeService`: CAREGIVER→DIRECT_CARE, NURSE→CLINICAL_CARE, GUARDIAN→FAMILY_PORTAL, PSYCHOLOGIST/SOCIAL_WORKER→PSYCHOSOCIAL_CARE via `resident_access_assignments`; SUPERVISOR/ADMIN/CARE_MANAGER are supervisory only if the staff row is active. Failures must fail closed (deny, never fall back to other data).

**Database.** `DatabaseModule` is global; inject `DatabaseService` and use `query()` / `withTransaction()` / `getPool()` (one shared pool; don't create `new Pool` in services). Config comes from `config/env.ts` (`readSecretOrEnv` supports `X`, `X_FILE` and `/run/secrets/*`). Schema = `database/schema.sql` + `database/migrations/*` + `database/rbac-migrations/*.up.sql` + `api/migrations/*` + finance chain `ops/finance/v22/001 … v32/010`; the authoritative order is `database/bootstrap.sh`. In production, services never create tables at runtime (they `SELECT … LIMIT 0` to verify), so every new table or column needs a migration file added to that order. Production Test's schema has drifted from git before; `20261018_018_production_schema_parity.sql` documents what was reconstructed.

**Finance & contracts** (`api/src/finance-billing/`) are fail-closed feature flags: reads need `TAMANCARE_FINANCE_*_ROLES`, writes need `TAMANCARE_FINANCE_WRITE_ENABLED=true`, contract drafting/sign-off need `TAMANCARE_CONTRACT_*` (see `api/.env.example`, `docs/DEPLOYMENT.md`). The monthly P&L is ADMIN/SUPERVISOR only. Verified identity is passed to finance controllers via `verified-finance-identity.ts`. Many files carry version-numbered names (`finance-v3818…`) from their original checkpoints; `docs/finance/` holds the design decisions and the production schema baseline. Finance migrations are not approved for Production Test.

**Frontend.** `src/api/client.ts` `apiRequest()` is the only HTTP path: it prefixes `API_BASE_URL` (runtime `window.__TAMAN_CONFIG__` from `/config.js`, else `VITE_API_BASE_URL`, else same-origin), adds `Authorization: Bearer` from `auth/session.ts` and the `x-actor-*` headers, and clears the session on 401. API paths already start with `/api`. Session tokens must carry `sub`, `role`, `jti`; the stored actor must match the token. Route access and capabilities come from `auth/role-policy.ts` (`ROLE_CAPABILITIES`, `canAccessRoute`) and are enforced in `app/router.tsx` with `<RequireRole route="…">`; navigation (`components/navigation/AppNavigation.tsx`, `features/mobile-launcher/`) and `app/page-meta.ts` must list the same route keys. Production builds must not read local mock/localStorage fixtures; API errors propagate to the UI.

**Deployment.** `frontend/Dockerfile` builds once; nginx renders `nginx/default.conf.template` (`API_UPSTREAM_URL`) and `docker-entrypoint.d/40-generate-config.sh` writes `/config.js`. Keep `sw.js`, `index.html`, `config.js`, `manifest.json` uncached or PWA clients stay on old releases. Production stack: `deploy/production/` (Docker secrets, TLS nginx `nginx/tamancare.conf`, daily `db-backup` using `ops/x3-production/backup`). First login on an empty production DB: `node dist/staff-actors/staff-bootstrap.js` with `TAMANCARE_BOOTSTRAP_PASSWORD`. Full guide: `docs/DEPLOYMENT.md`; release policy: `docs/RELEASE_GOVERNANCE.md`.

## Conventions

- UI text, error messages shown to users and domain docs are Vietnamese; code identifiers are English.
- CSV exports prepend the UTF-8 BOM for Excel.
- Never commit secrets or real resident data; `deploy/production/secrets/` holds only a README.
- Domain specs live in `docs/domain/`, feature acceptance notes in `docs/features/`.

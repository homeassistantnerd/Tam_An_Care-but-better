# Changelog

## [2026-10-18] — Branch consolidation

All 41 remote branches were merged into `main` (each one is an ancestor of `main`; tips are kept as `archive/*` tags).

### Added (from branches)
- Production Test baseline (2026-10-02), resident paper record registry, resident meal registration with RBAC.
- Finance billing: invoices, receipts, payment allocation, service price catalogue, canonical service contracts
  (draft, sign-off, approval), monthly operating result (P&L) — all fail-closed behind `TAMANCARE_*` flags.
- Guardian resident scope, staff RBAC with per-request revalidation, deployed RBAC release candidate
  (guardian/assigned-resident endpoints, vital-sign recording, psychosocial quick entry, canonical 16-role list).
- Admission DOB correction (year-only birth dates, demographic audit), admission ↔ resident sync,
  health-sync care view, multi-select assessments, psychosocial baseline, alphabetical (Vietnamese) resident order,
  service contract article 5 / discount fields, mobile back navigation, notification bell without demo data.

### Changed
- `database/bootstrap.sh` initialises an empty database in a fixed order (Docker initdb uses it);
  `20261018_018_production_schema_parity.sql` adds objects that existed only on Production Test.
- One CI workflow (`ci.yml`): build, unit/regression tests, PostgreSQL integration suites.
- Frontend Nginx keeps `sw.js`/`index.html`/`config.js` uncached so PWA clients pick up new releases.
- `staff-bootstrap.js` also sets the first Supervisor's password (`TAMANCARE_BOOTSTRAP_PASSWORD`).

### Removed
- ~45 branch-specific GitHub workflows, evidence/release-gate scripts, the frozen `release/rbac-20261017` source snapshot
  (its code is merged), `.agents/`, Production Test compose overrides, runtime patch scripts and the stale standalone zip.

## [2026-09-02] — Codebase Cleanup

### Removed

- **57 backup directories** (`VW-*-backup-*`, `X2-*-backup-*`, `X3-*-backup-*`) — full project snapshots redundant with git history
- **577+ audit trail files** at project root — RESULT, SHA256, CLOSURE, MANIFEST, ROADMAP-CHECKPOINT text files from development steps 7D–8F and versions V7.4.3–V7.9
- **V8.0 backups, checkpoints, results, runtime artifacts** — build/test outputs no longer needed
- **Freeze directory snapshots** (`freeze/`, `V7.5_FINAL_FREEZE_*`, `V7.6_FINAL_FREEZE_*`) — release freeze archives
- **13 `web/index.html` backup files** (`*.v7.4.1.*.backup`, `*-pre-debug`, `*-before-safari-datetime-fix`)
- **Old migration artifact** (`vw9-promotion/`)
- **Draft SQL files** (`VW-9B-R3-ADMISSION-HEALTH-REPORT-CANDIDATE.sql`, `VW-9B-R5-*-V2.sql`)
- **Miscellaneous junk**: malformed `docker-compose.ymldocker compose up -d`, empty `Detect` file, `.pre-contract-fix` / `.pre-write` backups, DB residue forensic dumps, `.DS_Store` files, old deployment snapshots (`.json`)

### Archived

- **Version design docs** (V7.5–V8) → `docs/version-history/` (roadmaps, contracts, manifests, preflight data)
- **Codex Handoff package** → `docs/archived-codex-handoff.zip` (onboarding documentation from 2026-09-01)

### Unchanged

- All source code (`api/`, `frontend/`, `database/`)
- Domain documentation (`docs/` — 79 specification files for Steps 7T–7Z)
- Deployment infrastructure (`deploy/`, `ops/`, `operations/`)
- Web container (`web/Dockerfile`, `web/index.html`, `web/nginx/`)
- V8.0 scripts and database schema
- Git history (all removed files recoverable)

### Impact

- Project size: **1.1 GB → 297 MB** (73% reduction)
- Root-level files: **580+ → ~10** (98% reduction)
- Zero source code changes — no functional impact

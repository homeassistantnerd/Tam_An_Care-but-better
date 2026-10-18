#!/usr/bin/env bash
# PostgreSQL-backed test suites. Each suite gets its own disposable database.
# Needs a throwaway PostgreSQL 16 on 127.0.0.1:5432 whose superuser is finance_ci/finance_ci_only
# (the CI service container; several ops/ci scripts hard-code that identity). Run after `npm run build`.
# Never point this at a real database: it creates and drops databases and roles.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGPASSWORD=finance_ci_only
export GITHUB_ACTIONS=true  # the ops/ci scripts refuse to run outside disposable CI databases
admin() { psql -X -q -v ON_ERROR_STOP=1 -d postgres "$@"; }
fresh_db() { admin -c "DROP DATABASE IF EXISTS \"$1\" WITH (FORCE)" -c "CREATE DATABASE \"$1\" OWNER ${2:-finance_ci}"; }
apply() { local db=$1; shift; for f in "$@"; do psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$f"; done; }
FINANCE_001_006=(ops/finance/v22/001_finance_foundation.sql ops/finance/v28/002_finance_transaction_safety.sql
  ops/finance/v29/003_finance_allocation_invariants.sql ops/finance/v29/004_finance_integrity_hardening.sql
  ops/finance/v30/005_shared_contract_version_history.sql ops/finance/v30/006_shared_contract_signoff_evidence.sql)

echo "== full schema bootstrap + demo seed"
fresh_db tamancare_bootstrap_ci
PGDATABASE=tamancare_bootstrap_ci sh database/bootstrap.sh >/dev/null
apply tamancare_bootstrap_ci database/seeds/001_demo_data.sql

echo "== resident meal registration"
fresh_db meal_ci
apply meal_ci ops/ci/resident-meal-isolated-prerequisites.sql database/migrations/20261009_017_resident_meal_registrations.sql
TEST_MEAL_DATABASE_URL="postgresql://finance_ci:finance_ci_only@127.0.0.1:5432/meal_ci" \
  node --test api/test/resident-meal-registration.integration.cjs

echo "== resident demographic (DOB) amendment"
admin -c "DO \$\$BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='dob_ci') THEN
  CREATE ROLE dob_ci LOGIN PASSWORD 'synthetic-ci-only-not-production'; END IF; END\$\$"
fresh_db dob_ci_synthetic dob_ci
(cd api && PGUSER=dob_ci PGPASSWORD=synthetic-ci-only-not-production PGDATABASE=dob_ci_synthetic \
  DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=dob_ci DB_PASSWORD=synthetic-ci-only-not-production \
  DB_NAME=dob_ci_synthetic NODE_ENV=test node test/dob-demographic-amendment.integration.cjs)

echo "== finance canonical transaction"
fresh_db finance_tx_ci
apply finance_tx_ci "${FINANCE_001_006[@]:0:4}"
PGDATABASE=finance_tx_ci node ops/ci/finance-canonical-transaction-test.cjs

echo "== finance PostgreSQL lab (concurrency)"
fresh_db finance_ci
bash ops/ci/finance-pg-lab-run.sh

echo "== finance billing migration chain"
PGDATABASE=postgres bash ops/ci/finance-billing-schema-migration-test.sh

echo "== finance P&L HTTP/JWT end-to-end"
PGDATABASE=postgres bash ops/ci/finance-pnl-postgres-http-e2e.sh

echo "== shared contract sign-off"
fresh_db contracts_ci
apply contracts_ci "${FINANCE_001_006[@]}" ops/ci/shared-contract-versions-ci.sql ops/ci/shared-contract-cross-module-ci-schema.sql
PGDATABASE=contracts_ci node ops/ci/shared-contract-postgres-signoff-test.cjs

echo "== contract draft and sign-off over HTTP"
admin -c "DROP DATABASE IF EXISTS contract_ci_http_signoff WITH (FORCE)"
fresh_db contract_ci_http
PGDATABASE=contract_ci_http bash ops/ci/contract-draft-pg16-run.sh

echo "INTEGRATION=PASS"

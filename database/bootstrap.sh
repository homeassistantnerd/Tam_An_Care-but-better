#!/bin/sh
# Initialise an EMPTY Tâm An Care database: canonical schema, then every migration in order.
# Docker: mounted into /docker-entrypoint-initdb.d (runs once, on an empty data volume).
# Manual: PGHOST=... PGUSER=... PGPASSWORD=... PGDATABASE=... sh database/bootstrap.sh
# Never run against an existing database: migrations are not idempotent.
set -eu

ROOT="${TAMANCARE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
export PGUSER="${PGUSER:-${POSTGRES_USER:-}}"
export PGDATABASE="${PGDATABASE:-${POSTGRES_DB:-}}"
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"

apply() {
  echo "bootstrap: $1"
  psql -X -q -v ON_ERROR_STOP=1 -f "$ROOT/$1"
}

cd "$ROOT"
apply database/schema.sql
for f in $(ls database/migrations/*.sql | LC_ALL=C sort); do apply "$f"; done
for f in $(ls database/rbac-migrations/*.up.sql | LC_ALL=C sort); do apply "$f"; done
for f in $(ls api/migrations/*.sql | LC_ALL=C sort); do apply "$f"; done
# Finance chain: order is fixed by ops/ci/finance-billing-schema-migration-test.sh.
for f in \
  ops/finance/v22/001_finance_foundation.sql \
  ops/finance/v28/002_finance_transaction_safety.sql \
  ops/finance/v29/003_finance_allocation_invariants.sql \
  ops/finance/v29/004_finance_integrity_hardening.sql \
  ops/finance/v30/005_shared_contract_version_history.sql \
  ops/finance/v30/006_shared_contract_signoff_evidence.sql \
  ops/finance/v31/007_finance_invoice_ledger_origin.sql \
  ops/finance/v32/008_discount_and_absence_policy.sql \
  ops/finance/v32/009_service_price_catalog.sql \
  ops/finance/v32/010_immutable_invoice_snapshot.sql
do apply "$f"; done
echo "bootstrap: complete"

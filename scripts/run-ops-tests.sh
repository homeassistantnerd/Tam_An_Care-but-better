#!/usr/bin/env bash
# Finance/contract regression suite in ops/ci that needs no database (run after `npm run build`).
# PostgreSQL-backed ops/ci suites run from scripts/ci-integration.sh instead.
set -euo pipefail
cd "$(dirname "$0")/.."
DB_BACKED=" contract-draft-pg-http.cjs contract-signoff-pg-http.cjs finance-canonical-transaction-test.cjs finance-pnl-postgres-http-e2e.cjs shared-contract-postgres-signoff-test.cjs "
failed=0
for t in ops/ci/*.cjs; do
  [[ "$DB_BACKED" == *" $(basename "$t") "* ]] && continue
  if ! node "$t" >/dev/null 2>&1; then echo "FAIL $t"; failed=1; fi
done
[ "$failed" -eq 0 ] && echo "OPS_TESTS=PASS"
exit "$failed"

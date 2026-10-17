#!/usr/bin/env bash
# Runs the database business-rule & security tests against a LOCAL, throwaway
# PostgreSQL 15+ database (never against your real Supabase project).
#
#   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
#
# It creates a temporary database, applies a small Supabase stand-in
# (roles, auth.users, auth.uid(), storage tables), applies every migration,
# runs supabase/tests/business_rules.test.sql, then drops the database.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_URL="${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a local PostgreSQL superuser connection string}"
DB="gym_manager_test_$$"
ADMIN_URL="$BASE_URL"
TEST_URL="${BASE_URL%/*}/$DB"

psql "$ADMIN_URL" -q -c "create database $DB" >/dev/null
trap 'psql "$ADMIN_URL" -q -c "drop database if exists $DB" >/dev/null 2>&1 || true' EXIT

# Roles are cluster-wide; ignore "already exists" on re-runs.
psql "$TEST_URL" -q -v ON_ERROR_STOP=0 -f supabase/tests/_local_supabase_stub.sql >/dev/null 2>&1 || true
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -c "select 1 from auth.users limit 0" >/dev/null

for f in supabase/migrations/*.sql; do
  echo "Applying $f"
  psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/business_rules.test.sql 2>&1 | grep -E "ok -|PASSED|ERROR|FAIL" | sed 's/^psql:[^ ]* NOTICE:  //'

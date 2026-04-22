#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUDIT_SQL="$ROOT_DIR/supabase/security/rls_audit.sql"

if [[ ! -f "$AUDIT_SQL" ]]; then
  echo "Missing audit SQL at $AUDIT_SQL"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required."
  echo "Example:"
  echo "  export DATABASE_URL='postgresql://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:5432/postgres?sslmode=require'"
  exit 1
fi

echo "Running Supabase RLS audit..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$AUDIT_SQL"

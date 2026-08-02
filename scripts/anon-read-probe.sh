#!/usr/bin/env bash
# Read-only anon-key probe: what can an unauthenticated caller SELECT over PostgREST?
#
# Run before and after 20260802000000_revoke_anon_access.sql.
# After the migration, every table should report "denied".
#
# Usage:  ./scripts/anon-read-probe.sh
# Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local.
# Makes no writes.

set -uo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

[[ -f .env.local ]] || { echo "Missing .env.local"; exit 1; }
URL=$(grep '^VITE_SUPABASE_URL='      .env.local | cut -d= -f2- | tr -d '"'"'"'')
KEY=$(grep '^VITE_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '"'"'"'')
[[ -n "$URL" && -n "$KEY" ]] || { echo "URL or anon key not found in .env.local"; exit 1; }

TABLES=$(grep -rhoiE "create table (if not exists )?(public\.)?[a-z_]+" supabase/migrations \
  | sed -E 's/.* //; s/^public\.//' | sort -u)

leaks=0
printf "%-42s %-6s %s\n" "TABLE" "HTTP" "RESULT"
printf '%.0s-' {1..80}; echo
for t in $TABLES; do
  resp=$(curl -s -w "\n%{http_code}" --max-time 20 \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    "$URL/rest/v1/$t?select=*&limit=1")
  code=$(tail -1 <<<"$resp"); body=$(sed '$d' <<<"$resp")
  case "$code" in
    200) if [[ "$body" == "[]" ]]; then res="empty (RLS filtered, or no rows)"
         else res="*** LEAK — row returned ***"; leaks=$((leaks+1)); fi ;;
    401|403) res="denied" ;;
    404) res="not exposed" ;;
    *)   res="http $code" ;;
  esac
  printf "%-42s %-6s %s\n" "$t" "$code" "$res"
done

echo
if (( leaks > 0 )); then echo "RESULT: $leaks table(s) readable without authentication."; exit 1
else echo "RESULT: no tables returned rows to an unauthenticated caller."; fi

# Note: "empty" is ambiguous from outside — RLS filtering and a genuinely empty
# table look identical, because RLS filters counts too. Only "denied" is proof.

#!/usr/bin/env bash

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI is not installed."
  echo "Install it first: brew install supabase/tap/supabase"
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-${1:-}}"
if [[ -z "${PROJECT_REF}" ]]; then
  read -r -p "Supabase project ref (e.g. abcdefghijklmno): " PROJECT_REF
fi

if [[ -z "${PROJECT_REF}" ]]; then
  echo "Error: project ref is required."
  exit 1
fi

echo ""
echo "Linking local repo to project: ${PROJECT_REF}"
supabase link --project-ref "${PROJECT_REF}"

read_secret() {
  local var_name="$1"
  local prompt="$2"
  local is_required="${3:-yes}"
  local value=""

  while true; do
    read -r -s -p "${prompt}: " value
    echo ""

    if [[ "${is_required}" == "no" ]]; then
      break
    fi

    if [[ -n "${value}" ]]; then
      break
    fi

    echo "${var_name} is required."
  done

  printf -v "${var_name}" '%s' "${value}"
}

echo ""
echo "Enter API credentials (inputs are hidden):"
read_secret GOOGLE_ADS_CLIENT_ID "GOOGLE_ADS_CLIENT_ID"
read_secret GOOGLE_ADS_CLIENT_SECRET "GOOGLE_ADS_CLIENT_SECRET"
read_secret GOOGLE_ADS_DEVELOPER_TOKEN "GOOGLE_ADS_DEVELOPER_TOKEN"
read_secret GOOGLE_ADS_LOGIN_CUSTOMER_ID "GOOGLE_ADS_LOGIN_CUSTOMER_ID"
read_secret META_APP_ID "META_APP_ID"
read_secret META_APP_SECRET "META_APP_SECRET"
read_secret TIKTOK_APP_ID "TIKTOK_APP_ID"
read_secret TIKTOK_APP_SECRET "TIKTOK_APP_SECRET"
read_secret ADS_SYNC_CRON_SECRET "ADS_SYNC_CRON_SECRET (generate a long random value)"

echo ""
echo "Setting Supabase Edge Function secrets..."
supabase secrets set \
  GOOGLE_ADS_CLIENT_ID="${GOOGLE_ADS_CLIENT_ID}" \
  GOOGLE_ADS_CLIENT_SECRET="${GOOGLE_ADS_CLIENT_SECRET}" \
  GOOGLE_ADS_DEVELOPER_TOKEN="${GOOGLE_ADS_DEVELOPER_TOKEN}" \
  GOOGLE_ADS_LOGIN_CUSTOMER_ID="${GOOGLE_ADS_LOGIN_CUSTOMER_ID}" \
  META_APP_ID="${META_APP_ID}" \
  META_APP_SECRET="${META_APP_SECRET}" \
  TIKTOK_APP_ID="${TIKTOK_APP_ID}" \
  TIKTOK_APP_SECRET="${TIKTOK_APP_SECRET}" \
  ADS_SYNC_CRON_SECRET="${ADS_SYNC_CRON_SECRET}"

echo ""
echo "Done. Current secret names:"
supabase secrets list


#!/usr/bin/env bash
# =============================================================
# Juice Creators — Supabase + Vercel Setup Script
# Run this locally where you have network access to both APIs.
# =============================================================
set -euo pipefail

SUPABASE_PROJECT_ID="uwegcqabvlcswviexuax"
SUPABASE_URL="https://${SUPABASE_PROJECT_ID}.supabase.co"
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN env var}"
VERCEL_TOKEN="${VERCEL_TOKEN:?Set VERCEL_TOKEN env var}"
VERCEL_PROJECT="nayba"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Step 1: Get Supabase API keys ==="
API_KEYS=$(curl -s "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/api-keys" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")

ANON_KEY=$(echo "$API_KEYS" | python3 -c "import sys,json; keys=json.load(sys.stdin); print([k['api_key'] for k in keys if k['name']=='anon'][0])")
SERVICE_ROLE_KEY=$(echo "$API_KEYS" | python3 -c "import sys,json; keys=json.load(sys.stdin); print([k['api_key'] for k in keys if k['name']=='service_role'][0])")

echo "  Anon key: ${ANON_KEY:0:20}..."
echo "  Service role key: ${SERVICE_ROLE_KEY:0:20}..."

echo ""
echo "=== Step 2: Get database connection URL ==="
DB_INFO=$(curl -s "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")
DB_HOST=$(echo "$DB_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['database']['host'])")
DB_URL="postgresql://postgres.${SUPABASE_PROJECT_ID}:${SUPABASE_DB_PASSWORD:-YOUR_DB_PASSWORD}@${DB_HOST}:5432/postgres"

echo "  DB Host: ${DB_HOST}"
echo "  DB URL template: ${DB_URL}"

echo ""
echo "=== Step 3: Run migrations ==="
MIGRATION_DIR="${REPO_DIR}/supabase/migrations"
for migration in $(ls "${MIGRATION_DIR}"/*.sql | sort); do
  echo "  Running: $(basename "$migration")"
  # Execute via Supabase SQL API
  SQL_CONTENT=$(cat "$migration")
  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{}" 2>&1 || true)

  # Alternative: use psql if available
  if command -v psql &>/dev/null && [ -n "${SUPABASE_DB_PASSWORD:-}" ]; then
    PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql -h "${DB_HOST}" -U postgres -d postgres -f "$migration"
  else
    echo "    (Use Supabase SQL Editor or set SUPABASE_DB_PASSWORD for psql)"
  fi
done

echo ""
echo "=== Step 4: Verify tables and policies ==="
VERIFY_SQL="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
echo "  Run this in SQL Editor to verify:"
echo "  ${VERIFY_SQL}"
echo ""
echo "  Expected tables: businesses, claims, creators, disputes, notifications, offers"

echo ""
echo "=== Step 5: Deploy Edge Functions ==="
echo "  Run these commands with supabase CLI:"
echo "  npx supabase login"
echo "  npx supabase link --project-ref ${SUPABASE_PROJECT_ID}"
echo "  npx supabase functions deploy check-overdue-reels --project-ref ${SUPABASE_PROJECT_ID}"
echo "  npx supabase functions deploy seed-test-users --project-ref ${SUPABASE_PROJECT_ID}"
echo "  npx supabase functions deploy send-email --project-ref ${SUPABASE_PROJECT_ID}"

echo ""
echo "=== Step 6: Set Vercel environment variables ==="
set_vercel_env() {
  local key="$1" value="$2" target="${3:-production preview development}"
  # Try to remove existing first
  curl -s -X DELETE "https://api.vercel.com/v9/projects/${VERCEL_PROJECT}/env?key=${key}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" > /dev/null 2>&1 || true

  curl -s -X POST "https://api.vercel.com/v10/projects/${VERCEL_PROJECT}/env" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"${key}\",\"value\":\"${value}\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\",\"development\"]}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  {key}: OK' if 'created' in str(d) or 'value' in str(d) else f'  {key}: {d}')"
}

set_vercel_env "VITE_SUPABASE_URL" "${SUPABASE_URL}"
set_vercel_env "VITE_SUPABASE_ANON_KEY" "${ANON_KEY}"
set_vercel_env "SUPABASE_SERVICE_ROLE_KEY" "${SERVICE_ROLE_KEY}"
set_vercel_env "SUPABASE_DB_URL" "${DB_URL}"

echo ""
echo "=== Step 7: Trigger Vercel redeploy ==="
# Get latest deployment
LATEST=$(curl -s "https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT}&limit=1" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['deployments'][0]['uid'])" 2>/dev/null || echo "")

if [ -n "$LATEST" ]; then
  curl -s -X POST "https://api.vercel.com/v13/deployments" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${VERCEL_PROJECT}\",\"deploymentId\":\"${LATEST}\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Redeploy triggered: {d.get(\"url\", \"check Vercel dashboard\")}')" 2>/dev/null || echo "  Check Vercel dashboard for deploy status"
fi

echo ""
echo "=== Done! ==="
echo "Live URL: Check your Vercel dashboard for https://${VERCEL_PROJECT}.vercel.app"

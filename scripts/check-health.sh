#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4000}"
BASE="http://localhost:${PORT}"

echo "==> Checking process (port: $PORT)"
if lsof -iTCP:"$PORT" -sTCP:LISTEN -P -n >/dev/null 2>&1; then
  echo "✅ Port $PORT is listening"
else
  echo "❌ Port $PORT not listening"; exit 1
fi

echo "==> Hitting health endpoints"
curl -fsS "$BASE/api/health"      | jq . || { echo "health fail"; exit 1; }
curl -fsS "$BASE/api/health/db"   | jq . || { echo "db health fail"; exit 1; }
curl -fsS "$BASE/api/settings"    | jq . || { echo "settings fail"; exit 1; }

echo "==> Prisma version"
npx prisma --version || true

echo "==> Done."

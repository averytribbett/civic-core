#!/bin/sh
set -e
if [ "${SKIP_DB_MIGRATE:-}" = "true" ]; then
  echo "[entrypoint] SKIP_DB_MIGRATE=true — skipping prisma migrate deploy"
else
  echo "[entrypoint] 1/2 prisma migrate deploy"
  npx prisma migrate deploy --config ./prisma.config.js
fi
echo "[entrypoint] 2/2 node dist/src/index.js (PORT=${PORT:-unset})"
exec node dist/src/index.js

#!/usr/bin/env bash
# Local dev infrastructure WITHOUT Docker (fallback for networks where the
# Docker Desktop download is infeasible). Uses native PostgreSQL binaries in
# .local/pgsql and Redis in .local/redis. See README "Native dev infra".
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="$ROOT/.local/pgsql/bin"
PG_DATA="$ROOT/.local/pgdata"
REDIS_DIR="$ROOT/.local/redis"

# Redis
if ! "$REDIS_DIR/redis-cli.exe" ping >/dev/null 2>&1; then
  (cd "$REDIS_DIR" && ./redis-server.exe redis.windows.conf >/dev/null 2>&1 &)
  sleep 1
  echo "redis started"
else
  echo "redis already running"
fi

# PostgreSQL: initialize cluster once
if [ ! -f "$PG_DATA/PG_VERSION" ]; then
  "$PG_BIN/initdb.exe" -D "$PG_DATA" -U delivery -E UTF8 --auth-local=trust --auth-host=trust
fi

# PostgreSQL: start if not running
if ! "$PG_BIN/pg_ctl.exe" -D "$PG_DATA" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl.exe" -D "$PG_DATA" -l "$ROOT/.local/pg.log" -o "-p 5432" -w start
  echo "postgres started"
else
  echo "postgres already running"
fi

# Database is created by `pnpm db:migrate` (Prisma creates it if missing).
# The embedded binaries ship no createdb/psql client tools.
echo "infra up: postgres://localhost:5432/delivery  redis://localhost:6379"
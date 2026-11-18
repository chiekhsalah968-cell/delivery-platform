#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="$ROOT/.local/pgsql/bin"
PG_DATA="$ROOT/.local/pgdata"
REDIS_DIR="$ROOT/.local/redis"

"$PG_BIN/pg_ctl.exe" -D "$PG_DATA" -m fast -w stop 2>/dev/null || true
"$REDIS_DIR/redis-cli.exe" shutdown nosave 2>/dev/null || true
echo "infra stopped"
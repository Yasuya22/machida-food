#!/usr/bin/env bash
# データベースのテストを、使い捨てのローカル PostgreSQL で実行する。
# 使い方: bash scripts/test-db.sh
# 本番の Supabase には一切接続しない。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"

# PostgreSQL は root では起動できないため、一般ユーザーで動かし直す
if [ "$(id -u)" = "0" ]; then
  RUN_AS="${TEST_DB_USER:-claude}"
  exec runuser -u "$RUN_AS" -- bash "$0" "$@"
fi

TMP="$(mktemp -d)"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust --locale=C.UTF-8 -E UTF8 >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -c listen_addresses='' -c timezone=Asia/Tokyo" -l "$TMP/log" -w start >/dev/null

PSQL=(psql -h "$TMP" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

echo "▶ Supabase相当の準備"
"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase_shim.sql"
echo "▶ マイグレーション"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "  - $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "▶ 初期データ"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
"${PSQL[@]}" -f "$ROOT/supabase/tests/fixtures.sql"
echo "▶ アクセステスト"
"${PSQL[@]}" -f "$ROOT/supabase/tests/rls_test.sql" 2>&1 | sed -e 's/^psql:[^:]*:[0-9]*: //' -e 's/^NOTICE:  //'

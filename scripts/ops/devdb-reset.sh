#!/usr/bin/env bash
# Geliştirme DB'sini sıfırla: şema → migrate deploy → katalog → sentetik veri.
# Yalnızca localhost:5433. Canlıya karşı çalışmaz.
set -euo pipefail
PG=/usr/local/opt/postgresql@17/bin
KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$KOK"

DEV_URL="$(grep -m1 '^DATABASE_URL=' .env.dev | cut -d= -f2- | tr -d '"')"
case "$DEV_URL" in
  postgres*://*localhost:5433/*|postgres*://*127.0.0.1:5433/*) ;;
  *) echo "⛔ DURDURULDU — devdb:reset yalnızca localhost:5433 üzerinde çalışır."; exit 1 ;;
esac
echo "HEDEF : localhost:5433 (yerel geliştirme)"

echo "→ public şeması sıfırlanıyor"
"$PG/psql" -q "$DEV_URL" -c 'drop schema public cascade; create schema public;'

echo "→ migrate deploy"
npm run prisma:devdb -- migrate deploy

echo "→ katalog"
bash scripts/ops/katalog-devdb.sh

echo "→ sentetik veri"
TZ=UTC ENV_FILE=.env.dev node scripts/seed-dev.mjs

echo "✓ devdb:reset tamamlandı"

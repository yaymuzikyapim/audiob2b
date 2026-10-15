#!/usr/bin/env bash
# Canlı katalogdan geliştirme DB'sine kopya (yalnızca okuma → localhost:5433).
# Kişisel veri içeren hiçbir tablo kopyalanmaz.
# Kaynak: .env.prod (canlı, yalnızca okuma) · Hedef: .env.dev (localhost:5433)
set -euo pipefail
PG=/usr/local/opt/postgresql@17/bin
KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$KOK"

DEV_URL="$(grep -m1 '^DATABASE_URL=' .env.dev | cut -d= -f2- | tr -d '"')"
case "$DEV_URL" in
  postgres*://*localhost:5433/*|postgres*://*127.0.0.1:5433/*) ;;
  *) echo "⛔ DURDURULDU — .env.dev yerel 5433'ü göstermiyor."; exit 1 ;;
esac

[ -f .env.prod ] || { echo "⛔ DURDURULDU — canlı kaynak .env.prod bulunamadı."; exit 1; }

TABLOLAR=(Category Series Package Book Chapter PackageBook)
ARGS=(); for t in "${TABLOLAR[@]}"; do ARGS+=(-t "public.\"$t\""); done

DUMP="$(mktemp -t audiob2b-katalog).dump"
trap 'rm -f "$DUMP"' EXIT

echo "→ canlıdan katalog dökümü (yalnızca ${#TABLOLAR[@]} tablo, --data-only)"
"$PG/pg_dump" -Fc --data-only --no-owner --no-acl "${ARGS[@]}" \
  -f "$DUMP" "$(grep -m1 '^DIRECT_URL=' .env.prod | cut -d= -f2- | tr -d '"')"

echo "→ dökümdeki tablolar:"
"$PG/pg_restore" --list "$DUMP" | sed -nE 's/.*TABLE DATA public ([^ ]+).*/   \1/p' | sort

YASAK=$("$PG/pg_restore" --list "$DUMP" | grep -cE 'TABLE DATA public (User|Company|PlayHistory|InviteToken|PasswordResetToken|PasswordAuditLog|NotificationLog|DemoRequest|ProposalLink|ProposalLinkVisitor|RateLimit|UserFavorite|PlayerState|Bookmark) ' || true)
if [ "$YASAK" -ne 0 ]; then echo "⛔ DURDURULDU — dökümde kişisel veri tablosu var ($YASAK)."; exit 1; fi

echo "→ dev'deki katalog tabloları boşaltılıyor"
"$PG/psql" -q "$DEV_URL" -c 'truncate "PackageBook","Chapter","Book","Series","Package","Category" cascade'

echo "→ dev'e yükleniyor"
LC_ALL="en_US.UTF-8" "$PG/pg_restore" --data-only --no-owner --no-acl --disable-triggers -d "$DEV_URL" "$DUMP"

echo "→ sayımlar:"
"$PG/psql" "$DEV_URL" -c 'select '"'"'Book'"'"' t, count(*) from "Book" union all select '"'"'Chapter'"'"', count(*) from "Chapter" union all select '"'"'Category'"'"', count(*) from "Category" union all select '"'"'Series'"'"', count(*) from "Series" union all select '"'"'Package'"'"', count(*) from "Package" union all select '"'"'PackageBook'"'"', count(*) from "PackageBook" order by 1'
echo "✓ katalog kopyalandı"

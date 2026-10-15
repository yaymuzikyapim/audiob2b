#!/usr/bin/env bash
# Canlı yedek — docs/runbooks/yedek-ve-geri-yukleme.md adım 1-3'ün script hâli.
# Yalnızca OKUMA yapar (pg_dump). Repo içine asla yazmaz.
# Kullanım: ALLOW_PROD=1 npm run backup:prod
set -euo pipefail
PG=/usr/local/opt/postgresql@17/bin
KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$KOK"

for v in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY DATABASE_URL DIRECT_URL; do
  if [ -n "${!v:-}" ]; then
    echo "⛔ DURDURULDU — kabukta $v tanımlı. Canlı .env kabuğa yüklenmez (CLAUDE.md 1-2)." >&2
    exit 1
  fi
done

if [ "${ALLOW_PROD:-}" != "1" ]; then
  echo "⛔ DURDURULDU — canlıdan yedek alır. Bilinçliyse: ALLOW_PROD=1 npm run backup:prod" >&2
  exit 1
fi

[ -f .env.prod ] || { echo "⛔ DURDURULDU — .env.prod yok." >&2; exit 1; }

REF="$(grep -m1 '^DIRECT_URL=' .env.prod | sed -nE 's#.*//postgres\.([a-z0-9]{16,24})[:@].*#\1#p')"
[ -n "$REF" ] || { echo "⛔ DURDURULDU — .env.prod içinde DIRECT_URL çözülemedi." >&2; exit 1; }
echo "→ HEDEF: CANLI (…${REF: -5}) · kaynak: .env.prod · yalnızca okuma"

if ! fdesetup status 2>/dev/null | grep -q "FileVault is On"; then
  echo "⚠  FileVault KAPALI — yedek şifresiz diske yazılıyor (kişisel veri içerir)."
fi

HEDEF="$HOME/Backups/audiob2b"
mkdir -p "$HEDEF" && chmod 700 "$HEDEF"
TS=$(date +%Y%m%d-%H%M)
DOSYA="$HEDEF/audiob2b-prod-public-$TS.dump"

echo "→ pg_dump başlıyor"
time "$PG/pg_dump" -Fc --schema=public --no-owner --no-acl -f "$DOSYA" \
  "$(grep -m1 '^DIRECT_URL=' .env.prod | cut -d= -f2- | tr -d '"')"
chmod 600 "$DOSYA"

echo "→ boyut: $(stat -f%z "$DOSYA") bayt"
echo "→ sha256: $(shasum -a 256 "$DOSYA" | cut -d' ' -f1)"
echo "→ döküm içeriği:"
"$PG/pg_restore" --list "$DOSYA" | grep -cE '^[0-9]+; .*TABLE DATA' | sed 's/^/   TABLE DATA: /'

# Saklama: 30 günden eski silinir, en az son 2 yedek korunur.
TOPLAM=$(ls -1 "$HEDEF"/audiob2b-prod-public-*.dump 2>/dev/null | wc -l | tr -d ' ')
if [ "$TOPLAM" -gt 2 ]; then
  ls -1t "$HEDEF"/audiob2b-prod-public-*.dump | tail -n +3 | while read -r eski; do
    if [ -n "$(find "$eski" -mtime +30 2>/dev/null)" ]; then
      echo "→ 30 günden eski, siliniyor: $(basename "$eski")"
      rm -f "$eski"
    fi
  done
fi

echo "✓ yedek: $DOSYA"

#!/bin/bash
# Vercel production deploy — güvenlik kapısıyla birlikte temiz git archive kullanır.
#
# Kullanım:
#   DEPLOY_CONFIRM=<sha7> ./deploy.sh [git-ref] [--from <canlı-sha>]
#   ./deploy.sh [git-ref] --dry-run [--from <canlı-sha>]
#
#   git-ref    : Deploy edilecek ref (varsayılan: origin/main)
#   --dry-run  : Özet yazdırır, hiçbir zaman deploy etmez; çıkış kodu 0
#   --from <sha>: Canlı SHA'yı Vercel API'sinden okuyamadığında manuel ver
#                 (meta.gitCommitSha olmayan eski deployment'lar için zorunlu)
#
# Örnek:
#   DEPLOY_CONFIRM=6b79e8f ./deploy.sh origin/main --from 6c88ab3

set -euo pipefail

# ── Argüman ayrıştırma ──────────────────────────────────────────────────────
DRY_RUN=0
FROM_SHA=""
REF=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --from)
      [[ -z "${2:-}" ]] && { echo "Hata: --from için bir SHA gerekli." >&2; exit 1; }
      FROM_SHA="$2"; shift 2 ;;
    --) shift; break ;;
    -*) echo "Bilinmeyen seçenek: $1" >&2; exit 1 ;;
    *)  REF="$1"; shift ;;
  esac
done

REF="${REF:-origin/main}"

# VERCEL_BIN: gerçek deploy için "npx vercel", test için "scripts/test/fake-vercel.sh"
VERCEL_BIN="${VERCEL_BIN:-npx vercel}"

source ~/.nvm/nvm.sh

# ── .vercel/project.json zorunlu ────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_JSON="$SCRIPT_DIR/.vercel/project.json"
[[ ! -f "$PROJECT_JSON" ]] && {
  echo "Hata: $PROJECT_JSON bulunamadı. Önce 'vercel link' çalıştırın." >&2; exit 1
}

PROJECT_NAME=$(python3 -c "import json; print(json.load(open('$PROJECT_JSON'))['projectName'])")
TEAM_ID=$(python3 -c "import json; print(json.load(open('$PROJECT_JSON')).get('orgId',''))")
PROJECT_ID=$(python3 -c "import json; print(json.load(open('$PROJECT_JSON')).get('projectId',''))")
echo "Hedef proje: $PROJECT_NAME"

# ── Uzak değişiklikleri çek ──────────────────────────────────────────────────
git fetch origin

# ── Vercel token helper ──────────────────────────────────────────────────────
AUTH_JSON="$HOME/Library/Application Support/com.vercel.cli/auth.json"
get_vercel_token() {
  python3 -c "import json; d=json.load(open('$AUTH_JSON')); print(d['token'])" 2>/dev/null || echo ""
}

# ── Canlı SHA'yı belirle ────────────────────────────────────────────────────
if [[ -n "$FROM_SHA" ]]; then
  LIVE_SHA=$(git rev-parse "$FROM_SHA" 2>/dev/null || true)
  [[ -z "$LIVE_SHA" ]] && {
    echo "Hata: --from değeri '$FROM_SHA' geçerli bir git SHA değil." >&2; exit 1
  }
  echo "Canlı SHA (--from): ${LIVE_SHA:0:7}"
else
  VERCEL_TOKEN=$(get_vercel_token)
  [[ -z "$VERCEL_TOKEN" ]] && {
    echo "Hata: Vercel token bulunamadı. --from <sha> ile canlı SHA'yı manuel ver." >&2; exit 1
  }

  LATEST_DEP=$(curl -s \
    "https://api.vercel.com/v6/deployments?teamId=${TEAM_ID}&projectId=${PROJECT_ID}&limit=1&target=production" \
    -H "Authorization: Bearer $VERCEL_TOKEN" 2>/dev/null || echo "{}")

  LIVE_SHA=$(echo "$LATEST_DEP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
deps=d.get('deployments',[])
print(deps[0].get('meta',{}).get('gitCommitSha','') if deps else '')
" 2>/dev/null || echo "")

  if [[ -z "$LIVE_SHA" ]]; then
    echo "Hata: Canlı deployment'ın meta.gitCommitSha değeri yok." >&2
    echo "      Eski deployment'lar bu meta'yı taşımaz." >&2
    echo "      --from <sha> ile canlı commit'i manuel belirt." >&2
    echo "      Bugün doğrulanan değer: 6b79e8f (px94xrabg, 2026-10-16)" >&2
    exit 1
  fi
  echo "Canlı SHA (Vercel API): ${LIVE_SHA:0:7}"
fi

LIVE_SHA7="${LIVE_SHA:0:7}"

# ── Hedef SHA ───────────────────────────────────────────────────────────────
TARGET_SHA=$(git rev-parse "$REF" 2>/dev/null || true)
[[ -z "$TARGET_SHA" ]] && {
  echo "Hata: '$REF' çözümlenemedi. 'git fetch origin' yaptın mı?" >&2; exit 1
}
TARGET_SHA7="${TARGET_SHA:0:7}"
echo "Hedef SHA : $TARGET_SHA7  ($REF)"

# ── Hedef origin'de push edilmiş mi? ────────────────────────────────────────
if ! git branch -r --contains "$TARGET_SHA" 2>/dev/null | grep -q .; then
  echo "HATA: $TARGET_SHA7 henüz origin'e push edilmemiş." >&2
  echo "      Önce 'git push origin main' çalıştır." >&2
  exit 1
fi

# ── Geri gidiş / ayrık dal kontrolü ────────────────────────────────────────
if ! git merge-base --is-ancestor "$LIVE_SHA" "$TARGET_SHA" 2>/dev/null; then
  echo "HATA: Hedef ($TARGET_SHA7) canlı ($LIVE_SHA7)'in torunu değil." >&2
  echo "      Geri gidiş veya ayrık dal — deploy durduruldu." >&2
  exit 1
fi

# ── Deploy öncesi özet ──────────────────────────────────────────────────────
COMMIT_COUNT=$(git rev-list --count "${LIVE_SHA}..${TARGET_SHA}" 2>/dev/null || echo "?")
CHANGED=$(git diff --name-only "${LIVE_SHA}..${TARGET_SHA}" 2>/dev/null || echo "")

echo ""
echo "══════════════════════════════════════════════════════"
echo " DEPLOY ÖZETİ"
echo "══════════════════════════════════════════════════════"
printf " Canlı  : %s\n" "$LIVE_SHA7"
printf " Hedef  : %s  (%s commit)\n" "$TARGET_SHA7" "$COMMIT_COUNT"
echo ""
echo "─── Commit listesi ───────────────────────────────────"
git log --oneline "${LIVE_SHA}..${TARGET_SHA}" 2>/dev/null || echo "  (commit yok)"
echo ""
echo "─── Değişen dosyalar ─────────────────────────────────"
SRC_F=$(echo "$CHANGED"   | grep "^src/"      || true)
PRI_F=$(echo "$CHANGED"   | grep "^prisma/"   || true)
PKG_F=$(echo "$CHANGED"   | grep "^package"   || true)
CFG_F=$(echo "$CHANGED"   | grep -E "^vercel\.json|^next\.config" || true)
OTH_F=$(echo "$CHANGED"   | grep -vE "^src/|^prisma/|^package|^vercel\.json|^next\.config" || true)

[[ -n "$SRC_F" ]] && echo "$SRC_F" | sed 's/^/  /'  | head -25
[[ -n "$PRI_F" ]] && echo "$PRI_F" | sed 's/^/  /'
[[ -n "$PKG_F" ]] && echo "$PKG_F" | sed 's/^/  /'
[[ -n "$CFG_F" ]] && echo "$CFG_F" | sed 's/^/  /'
[[ -n "$OTH_F" ]] && echo "$OTH_F" | sed 's/^/  /'
[[ -z "$CHANGED" ]] && echo "  (değişen dosya yok)"
echo ""

# ── Migration kapısı ─────────────────────────────────────────────────────────
# Dry-run: statik uyarı (DB bağlantısı gerekmez).
# Gerçek deploy: prisma migrate status (canlı DB) → bekleyen varsa DUR, yoksa geç.
# Test ortamı için: PRISMA_MIGRATE_STATUS_OVERRIDE env var ile çıktıyı taklit et.
if echo "$CHANGED" | grep -qE "^prisma/schema\.prisma|^prisma/migrations"; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "⚠️  UYARI: prisma/schema.prisma veya prisma/migrations değişti."
    echo "   Gerçek deploy'dan önce 'prisma migrate deploy' uygula (DIRECT_URL, port 5432)."
    echo ""
  else
    if [[ -n "${PRISMA_MIGRATE_STATUS_OVERRIDE:-}" ]]; then
      MIGRATE_OUT="$PRISMA_MIGRATE_STATUS_OVERRIDE"
    else
      MIGRATE_OUT=$(cd "$SCRIPT_DIR" && npx dotenvx run -f .env.prod --quiet -- npx prisma migrate status 2>&1 || true)
    fi
    if echo "$MIGRATE_OUT" | grep -q "Database schema is up to date"; then
      echo "ℹ️  Şema/migrasyon değişti; canlı DB güncel — deploy devam ediyor."
      echo ""
    else
      echo "HATA: Canlı DB'de bekleyen migrasyon var — deploy durduruldu." >&2
      echo "   Önce canlı DB'ye 'prisma migrate deploy' uygula (DIRECT_URL gerekir)." >&2
      exit 1
    fi
  fi
fi
if echo "$CHANGED" | grep -q "^package.json"; then
  if git diff "${LIVE_SHA}..${TARGET_SHA}" -- package.json 2>/dev/null \
     | grep "^+" | grep -qE '"dependencies"|"devDependencies"'; then
    echo "⚠️  UYARI: package.json bağımlılıkları değişti — kontrol et."
    echo ""
  fi
fi
echo "══════════════════════════════════════════════════════"
echo ""

# ── Dry-run çıkışı ──────────────────────────────────────────────────────────
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY-RUN: Deploy yapılmadı."
  exit 0
fi

# ── DEPLOY_CONFIRM kapısı ───────────────────────────────────────────────────
DEPLOY_CONFIRM_VAL="${DEPLOY_CONFIRM:-}"
if [[ "$DEPLOY_CONFIRM_VAL" != "$TARGET_SHA7" ]]; then
  echo "HATA: DEPLOY_CONFIRM değeri hedef SHA7 ile eşleşmiyor." >&2
  echo "      Beklenen : $TARGET_SHA7" >&2
  echo "      Verilen  : ${DEPLOY_CONFIRM_VAL:-<boş>}" >&2
  echo "" >&2
  echo "      Deploy için:" >&2
  if [[ -n "$FROM_SHA" ]]; then
    echo "      DEPLOY_CONFIRM=$TARGET_SHA7 ./deploy.sh $REF --from $FROM_SHA" >&2
  else
    echo "      DEPLOY_CONFIRM=$TARGET_SHA7 ./deploy.sh $REF" >&2
  fi
  exit 1
fi

# ── Gerçek deploy ───────────────────────────────────────────────────────────
echo "Deploy başlıyor: $TARGET_SHA7 → Vercel production"
echo ""

DEPLOY_DIR=$(mktemp -d)
trap 'rm -rf "$DEPLOY_DIR"' EXIT

git archive "$TARGET_SHA" | tar -x -C "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/.vercel"
cp "$PROJECT_JSON" "$DEPLOY_DIR/.vercel/project.json"

cd "$DEPLOY_DIR"
DEPLOY_OUTPUT=$($VERCEL_BIN --prod --meta "gitCommitSha=$TARGET_SHA" 2>&1)
echo "$DEPLOY_OUTPUT"

# ── Deploy sonrası özet ─────────────────────────────────────────────────────
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -o "https://[^ ]*vercel\.app" | tail -1 || echo "")
echo ""
echo "── Deploy sonrası ────────────────────────────────────"
echo " URL  : ${DEPLOY_URL:-<URL alınamadı>}"

VERCEL_TOKEN2=$(get_vercel_token)
if [[ -n "$VERCEL_TOKEN2" ]] && [[ -n "$DEPLOY_URL" ]]; then
  DEPLOY_HOST="${DEPLOY_URL#https://}"
  INSPECT=$(curl -s \
    "https://api.vercel.com/v6/deployments?teamId=${TEAM_ID}&url=${DEPLOY_HOST}&limit=1" \
    -H "Authorization: Bearer $VERCEL_TOKEN2" 2>/dev/null || echo "{}")
  META_SHA=$(echo "$INSPECT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
deps=d.get('deployments',[])
print(deps[0].get('meta',{}).get('gitCommitSha','') if deps else '')
" 2>/dev/null || echo "")
  ALIASES=$(cd "$SCRIPT_DIR" && $VERCEL_BIN alias ls 2>/dev/null \
    | grep "audiob2b\.com\.tr" | awk '{print $1}' | head -3 | tr '\n' ' ' || echo "")
  echo " Alias: ${ALIASES:-<alınamadı>}"
  if [[ "$META_SHA" == "$TARGET_SHA" ]]; then
    echo " meta.gitCommitSha : $META_SHA ✓"
  else
    echo " meta.gitCommitSha : ${META_SHA:-<yok>}  (beklenen: $TARGET_SHA)"
  fi
fi

DEPLOY_DATE=$(date '+%Y-%m-%d %H:%M')
echo ""
echo "── canli-islem-kaydi.md tek satır özeti ──────────────"
echo "| $DEPLOY_DATE | deploy | $TARGET_SHA7 | ${DEPLOY_URL:-?} | $COMMIT_COUNT commit (${LIVE_SHA7}→${TARGET_SHA7}) |"
echo "══════════════════════════════════════════════════════"

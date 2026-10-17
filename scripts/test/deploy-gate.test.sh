#!/bin/bash
# deploy.sh güvenlik kapısı testleri
# Kullanım: VERCEL_BIN=scripts/test/fake-vercel.sh bash scripts/test/deploy-gate.test.sh
# Gerçek ağ çağrısı yapmaz; tüm testler --from <sha> ile LIVE_SHA'yı manuel verir.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
FAKE_VERCEL="$SCRIPT_DIR/scripts/test/fake-vercel.sh"

# ── Güvenlik kilidi: yalnızca fake-vercel ile çalışır ───────────────────────
if [[ "${VERCEL_BIN:-}" != *"fake-vercel"* ]]; then
  echo "HATA: Bu test yalnızca VERCEL_BIN=scripts/test/fake-vercel.sh ile çalışır." >&2
  echo "      Gerçek Vercel deploy'u önlemek için bu kural zorunludur." >&2
  echo "      Çalıştır: VERCEL_BIN=scripts/test/fake-vercel.sh bash scripts/test/deploy-gate.test.sh" >&2
  exit 1
fi

export VERCEL_BIN="$FAKE_VERCEL"

# ── Test yardımcıları ────────────────────────────────────────────────────────
PASS=0; FAIL=0
LOG_FILE=$(mktemp)
TMP_OUT=$(mktemp)
export FAKE_VERCEL_LOG="$LOG_FILE"

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
cleanup() { rm -f "$LOG_FILE" "$TMP_OUT"; }
trap cleanup EXIT

# deploy.sh çalıştır; çıkış kodu OUT_CODE, çıktı TMP_OUT dosyasında
# set +e / set -e: set -euo pipefail'den korunur; subshell kullanmaz
run_deploy() {
  set +e
  bash "$SCRIPT_DIR/deploy.sh" "$@" > "$TMP_OUT" 2>&1
  OUT_CODE=$?
  set -e
}

# Bilinen sabit SHA:
#   LIVE_SHA   = 6b79e8f (px94xrabg — gerçek canlı SHA)
#   TARGET_SHA = origin/main'in güncel kısa SHA'sı (push sonrası otomatik güncellenir)
LIVE_SHA="6b79e8f"
TARGET_SHA=$(git -C "$SCRIPT_DIR" rev-parse --short origin/main)

echo ""
echo "══════════════════════════════════════════════════════"
echo " deploy-gate testleri  (fake Vercel, ağ çağrısı yok)"
echo "══════════════════════════════════════════════════════"

# ── Test A: --dry-run 0 ile çıkar, deploy gerçekleşmez ──────────────────────
echo ""
echo "A) --dry-run çıkış kodu 0, deploy yok"
> "$LOG_FILE"
run_deploy origin/main --dry-run --from "$LIVE_SHA"
OUT=$(cat "$TMP_OUT")
if [[ $OUT_CODE -eq 0 ]] && echo "$OUT" | grep -q "DRY-RUN"; then
  pass "--dry-run çıkış 0, 'DRY-RUN' mesajı var"
else
  fail "--dry-run; çıkış=$OUT_CODE, çıktı='${OUT:0:120}'"
fi
if [[ ! -s "$LOG_FILE" ]]; then
  pass "fake-vercel çağrılmadı (deploy yok)"
else
  fail "fake-vercel çağrıldı! İçerik: $(cat "$LOG_FILE")"
fi

# ── Test B: DEPLOY_CONFIRM olmadan 1 ile çıkar ───────────────────────────────
echo ""
echo "B) DEPLOY_CONFIRM olmadan çıkış 1"
> "$LOG_FILE"
PRISMA_MIGRATE_STATUS_OVERRIDE="Database schema is up to date!" \
  DEPLOY_CONFIRM="" run_deploy origin/main --from "$LIVE_SHA"
OUT=$(cat "$TMP_OUT")
if [[ $OUT_CODE -ne 0 ]] && echo "$OUT" | grep -q "DEPLOY_CONFIRM"; then
  pass "DEPLOY_CONFIRM olmadan çıkış 1, hata mesajı var"
else
  fail "DEPLOY_CONFIRM olmadan; çıkış=$OUT_CODE, çıktı='${OUT:0:200}'"
fi
if [[ ! -s "$LOG_FILE" ]]; then
  pass "fake-vercel çağrılmadı"
else
  fail "fake-vercel çağrıldı! İçerik: $(cat "$LOG_FILE")"
fi

# ── Test C: Yanlış DEPLOY_CONFIRM ile 1 çıkar ────────────────────────────────
echo ""
echo "C) Yanlış DEPLOY_CONFIRM ile çıkış 1"
> "$LOG_FILE"
PRISMA_MIGRATE_STATUS_OVERRIDE="Database schema is up to date!" \
  DEPLOY_CONFIRM="0000000" run_deploy origin/main --from "$LIVE_SHA"
OUT=$(cat "$TMP_OUT")
if [[ $OUT_CODE -ne 0 ]] && echo "$OUT" | grep -q "DEPLOY_CONFIRM"; then
  pass "Yanlış DEPLOY_CONFIRM çıkış 1, hata mesajı var"
else
  fail "Yanlış DEPLOY_CONFIRM; çıkış=$OUT_CODE, çıktı='${OUT:0:200}'"
fi
if [[ ! -s "$LOG_FILE" ]]; then
  pass "fake-vercel çağrılmadı"
else
  fail "fake-vercel çağrıldı! İçerik: $(cat "$LOG_FILE")"
fi

# ── Test D: Push edilmemiş commit ile 1 çıkar ────────────────────────────────
echo ""
echo "D) Push edilmemiş ref ile çıkış 1"
> "$LOG_FILE"
# _test/local-only: hiçbir zaman origin'e push edilmeyecek yerel dal (bu test için saklı)
UNPUSHED_SHA=$(git -C "$SCRIPT_DIR" rev-parse --short _test/local-only 2>/dev/null || echo "notfound")
DEPLOY_CONFIRM="$UNPUSHED_SHA" run_deploy _test/local-only --from "$LIVE_SHA"
OUT=$(cat "$TMP_OUT")
if [[ $OUT_CODE -ne 0 ]] && echo "$OUT" | grep -qi "origin\|push"; then
  pass "Push edilmemiş ref çıkış 1, 'origin/push' mesajı var"
else
  fail "Push edilmemiş ref; çıkış=$OUT_CODE, çıktı='${OUT:0:200}'"
fi
if [[ ! -s "$LOG_FILE" ]]; then
  pass "fake-vercel çağrılmadı"
else
  fail "fake-vercel çağrıldı! İçerik: $(cat "$LOG_FILE")"
fi

# ── Test E: Doğru DEPLOY_CONFIRM + migration uygulandı → fake-vercel çağrılır ─
echo ""
echo "E) Doğru DEPLOY_CONFIRM + migration DB'de uygulandı → fake-vercel --prod"
> "$LOG_FILE"
FULL_TARGET=$(git -C "$SCRIPT_DIR" rev-parse origin/main)
PRISMA_MIGRATE_STATUS_OVERRIDE="Database schema is up to date!" \
  DEPLOY_CONFIRM="$TARGET_SHA" run_deploy origin/main --from "$LIVE_SHA"
OUT=$(cat "$TMP_OUT")
if [[ $OUT_CODE -eq 0 ]]; then
  pass "Çıkış kodu 0"
else
  fail "Çıkış kodu $OUT_CODE (beklenen 0); çıktı='${OUT:0:200}'"
fi

if [[ -s "$LOG_FILE" ]]; then
  CALL=$(cat "$LOG_FILE")
  if echo "$CALL" | grep -q "\-\-prod" && echo "$CALL" | grep -q "gitCommitSha=$FULL_TARGET"; then
    pass "fake-vercel --prod ve gitCommitSha=$FULL_TARGET ile çağrıldı ✓"
  else
    fail "fake-vercel çağrısı hatalı: '$CALL'"
  fi
else
  fail "fake-vercel hiç çağrılmadı"
fi

# ── Test F: Migration beklemede → gerçek deploy'da exit 1 ────────────────────
echo ""
echo "F) Bekleyen migrasyon → gerçek deploy exit 1, fake-vercel çağrılmaz"
> "$LOG_FILE"
PRISMA_MIGRATE_STATUS_OVERRIDE="Following migration have not yet been applied:
20261017000001_adim2_play_history" \
  DEPLOY_CONFIRM="$TARGET_SHA" run_deploy origin/main --from "$LIVE_SHA"
OUT=$(cat "$TMP_OUT")
if [[ $OUT_CODE -ne 0 ]] && echo "$OUT" | grep -qi "bekleyen migrasyon"; then
  pass "Bekleyen migrasyon → deploy exit 1, mesaj var"
else
  fail "Bekleyen migrasyon; çıkış=$OUT_CODE, çıktı='${OUT:0:200}'"
fi
if [[ ! -s "$LOG_FILE" ]]; then
  pass "fake-vercel çağrılmadı (migration blokladı) ✓"
else
  fail "fake-vercel çağrıldı! İçerik: $(cat "$LOG_FILE")"
fi

# ── Test G: Dry-run + bekleyen migrasyon → UYARI var, çıkış 0 ────────────────
echo ""
echo "G) Dry-run + bekleyen migrasyon → UYARI satırı, çıkış 0"
> "$LOG_FILE"
PRISMA_MIGRATE_STATUS_OVERRIDE="Following migration have not yet been applied:
20261017000001_adim2_play_history" \
  run_deploy origin/main --dry-run --from "$LIVE_SHA"
OUT=$(cat "$TMP_OUT")
if [[ $OUT_CODE -eq 0 ]] && echo "$OUT" | grep -q "DRY-RUN"; then
  pass "Dry-run çıkış 0, 'DRY-RUN' satırı var"
else
  fail "Dry-run; çıkış=$OUT_CODE, çıktı='${OUT:0:120}'"
fi
if echo "$OUT" | grep -q "UYARI"; then
  pass "Dry-run'da UYARI satırı gösterildi ✓"
else
  fail "UYARI satırı bulunamadı; çıktı='${OUT:0:200}'"
fi
if [[ ! -s "$LOG_FILE" ]]; then
  pass "fake-vercel çağrılmadı (dry-run)"
else
  fail "fake-vercel çağrıldı! İçerik: $(cat "$LOG_FILE")"
fi

# ── Sonuç ────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo " Sonuç: $PASS geçti, $FAIL başarısız"
echo "══════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] || exit 1

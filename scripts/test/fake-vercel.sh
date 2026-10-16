#!/bin/bash
# Sahte Vercel CLI — yalnızca deploy-gate.test.sh için.
# Gerçek ağ çağrısı yapmaz; VERCEL_BIN=scripts/test/fake-vercel.sh ile kullanılır.

ARGS="$*"
LOG_FILE="${FAKE_VERCEL_LOG:-/tmp/fake-vercel-calls.txt}"

# Çağrıyı kaydet (test doğrulaması için)
echo "$ARGS" >> "$LOG_FILE"

case "$ARGS" in
  *"--prod"*)
    # Gerçek Vercel çıktısını taklit et ama vercel.app URL'si içermez (post-deploy curl'ü tetiklemez)
    echo "FAKE VERCEL: deploy simulated" >&2
    echo "  - Uploading build outputs..."
    echo "  - Deployment complete."
    echo "  Inspect: https://vercel.com/fake/fake-deployment"
    ;;
  "alias ls"|"alias list")
    echo "audiob2b.com.tr  →  audiob2b-px94xrabg-yay20.vercel.app"
    ;;
  *)
    echo "FAKE VERCEL: $ARGS" >&2
    ;;
esac

exit 0

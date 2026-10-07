#!/bin/bash
# Vercel production deploy — temiz git archive kullanır.
# Kullanım: ./deploy.sh [git-ref]   (varsayılan: origin/main)
set -e

REF="${1:-origin/main}"

source ~/.nvm/nvm.sh

# .vercel/project.json zorunlu; yoksa dur
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_JSON="$SCRIPT_DIR/.vercel/project.json"
if [ ! -f "$PROJECT_JSON" ]; then
  echo "Hata: $PROJECT_JSON bulunamadı. Önce 'vercel link' çalıştırın." >&2
  exit 1
fi

PROJECT_NAME=$(python3 -c "import json,sys; print(json.load(open('$PROJECT_JSON'))['projectName'])")
echo "Hedef proje: $PROJECT_NAME"

# Uzak değişiklikleri çek
git fetch origin

# Deploy edilecek commit'i göster
COMMIT=$(git rev-parse "$REF")
echo "Deploy edilecek commit: $COMMIT ($REF)"

# Temiz arşiv — sadece commit edilmiş dosyalar, working tree'ye dokunmaz
DEPLOY_DIR=$(mktemp -d)
trap 'rm -rf "$DEPLOY_DIR"' EXIT

git archive "$COMMIT" | tar -x -C "$DEPLOY_DIR"

# .vercel/project.json kopyala (bağlantı bilgisi arşive girmez)
mkdir -p "$DEPLOY_DIR/.vercel"
cp "$PROJECT_JSON" "$DEPLOY_DIR/.vercel/project.json"

cd "$DEPLOY_DIR"
npx vercel --prod

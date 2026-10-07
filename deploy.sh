#!/bin/bash
# Vercel production deploy — temiz git archive kullanır.
# Kullanım: ./deploy.sh [git-ref]   (varsayılan: origin/main)
set -e

REF="${1:-origin/main}"

source ~/.nvm/nvm.sh

# Uzak değişiklikleri çek
git fetch origin

# Deploy edilecek commit'i göster
COMMIT=$(git rev-parse "$REF")
echo "Deploy edilecek commit: $COMMIT ($REF)"

# Temiz arşiv — sadece commit edilmiş dosyalar, working tree'ye dokunmaz
DEPLOY_DIR=$(mktemp -d)
trap 'rm -rf "$DEPLOY_DIR"' EXIT

git archive "$COMMIT" | tar -x -C "$DEPLOY_DIR"

cd "$DEPLOY_DIR"
npx vercel --prod

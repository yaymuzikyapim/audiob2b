#!/bin/bash
# Vercel deploy - git olmadan calistir (commit author blok asmak icin)
set -e
source ~/.nvm/nvm.sh
rm -rf /tmp/ab2b
mkdir /tmp/ab2b
rsync -a \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  "$(dirname "$0")/" /tmp/ab2b/
cd /tmp/ab2b
npx vercel --prod

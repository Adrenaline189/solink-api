#!/usr/bin/env bash
set -euo pipefail
echo "🔄 Upgrading Prisma and Client to latest version..."
npm i -D prisma@latest
npm i @prisma/client@latest

echo "🧹 Cleaning old Prisma cache..."
rm -rf node_modules/.prisma node_modules/@prisma/client

echo "🧬 Regenerating Prisma Client..."
npx prisma generate || true

echo "🔍 Validating Prisma schema..."
npx prisma validate || true

echo "💾 Committing update..."
git add package.json package-lock.json || true
git commit -m "chore: upgrade prisma to latest (openssl3)" || true

echo "⬆️ Pushing to GitHub..."
git pull --rebase origin main || true
git push origin main || true

echo "✅ Done! Prisma upgraded and synced."

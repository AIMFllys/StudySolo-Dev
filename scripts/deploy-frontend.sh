#!/bin/bash
# StudySolo Frontend Deployment Script
# Pulls latest code, builds Next.js, and restarts PM2 instance on port 2037

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$APP_DIR/frontend"
PM2_APP_NAME="studysolo-frontend"

echo "==> [Frontend] Pulling latest code..."
cd "$APP_DIR"
git pull origin main

echo "==> [Frontend] Installing dependencies..."
cd "$FRONTEND_DIR"
pnpm install --frozen-lockfile

echo "==> [Frontend] Building Next.js..."
pnpm build

echo "==> [Frontend] Restarting PM2 (port 2037)..."
if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
else
  pm2 start pnpm \
    --name "$PM2_APP_NAME" \
    --cwd "$FRONTEND_DIR" \
    -- start -- --port 2037
fi

pm2 save
echo "==> [Frontend] Deployment complete."

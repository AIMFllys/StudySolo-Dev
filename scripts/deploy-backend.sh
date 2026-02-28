#!/bin/bash
# StudySolo Backend Deployment Script
# Pulls latest code, installs Python deps, and restarts Gunicorn (2 workers, port 2038)
# Includes 2GB Swap setup for low-memory ECS instances

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
VENV_DIR="$BACKEND_DIR/.venv"
SWAP_FILE="/swapfile"

# ── Swap configuration (2GB) ─────────────────────────────────────────────────
setup_swap() {
  if [ ! -f "$SWAP_FILE" ]; then
    echo "==> [Swap] Creating 2GB swap file..."
    sudo fallocate -l 2G "$SWAP_FILE"
    sudo chmod 600 "$SWAP_FILE"
    sudo mkswap "$SWAP_FILE"
    sudo swapon "$SWAP_FILE"
    echo "$SWAP_FILE none swap sw 0 0" | sudo tee -a /etc/fstab
    echo "==> [Swap] 2GB swap enabled."
  else
    echo "==> [Swap] Swap file already exists, skipping."
  fi
}

setup_swap

# ── Code update ───────────────────────────────────────────────────────────────
echo "==> [Backend] Pulling latest code..."
cd "$APP_DIR"
git pull origin main

# ── Python virtual environment ────────────────────────────────────────────────
echo "==> [Backend] Setting up Python virtual environment..."
cd "$BACKEND_DIR"

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

echo "==> [Backend] Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# ── Gunicorn restart (2 workers, port 2038) ───────────────────────────────────
echo "==> [Backend] Restarting Gunicorn..."
GUNICORN_PID_FILE="/tmp/studysolo-backend.pid"

if [ -f "$GUNICORN_PID_FILE" ]; then
  OLD_PID=$(cat "$GUNICORN_PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "==> [Backend] Sending graceful reload to PID $OLD_PID..."
    kill -HUP "$OLD_PID"
  else
    rm -f "$GUNICORN_PID_FILE"
  fi
fi

if [ ! -f "$GUNICORN_PID_FILE" ]; then
  gunicorn app.main:app \
    --config gunicorn.conf.py \
    --daemon \
    --pid "$GUNICORN_PID_FILE"
fi

echo "==> [Backend] Deployment complete. Gunicorn running on port 2038."

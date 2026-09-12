#!/usr/bin/env bash
# ============================================================================
# LegalGuard — one-command setup for a new evaluator.
# Cross-platform (Unix/macOS). On Windows run `setup.ps1` instead, or use
# Docker Desktop with:   docker compose up -d
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

BACKEND="legal_metrology_backend/legal_metrology"
PYTHON="${PYTHON:-python3}"
cd "$BACKEND"

echo "==> [1/5] Creating .env from template (if missing)"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env — EDIT it with your real GOOGLE_API_KEY before running."
fi

echo "==> [2/5] Python virtualenv + deps"
if [ ! -d venv ]; then
  "$PYTHON" -m venv venv
fi
./venv/bin/python -m pip install --upgrade pip >/dev/null
./venv/bin/python -m pip install -r requirements.txt

cd ../..

echo "==> [3/5] Starting MySQL (Docker) on port 3307"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker compose up -d
  echo "    Waiting for MySQL to be healthy..."
  for i in $(seq 1 30); do
    if docker inspect --format='{{.State.Health.Status}}' legalguard-mysql 2>/dev/null | grep -q healthy; then
      break
    fi
    sleep 2
  done
else
  echo "    [WARN] Docker not available. Ensure MySQL is running on :3307 with"
  echo "           the creds in legal_metrology_backend/legal_metrology/.env"
  echo "           (DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=legalguard DB_NAME=amazon_scraper_db),"
  echo "           then run the schema:"
  echo "           mysql -h127.0.0.1 -P3307 -ulegalguard -p amazon_scraper_db < legal_metrology_backend/legal_metrology/database_schema.sql"
fi

echo "==> [4/5] Frontend deps"
if [ -d frontend ] && [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install)
fi

echo "==> [5/5] Verify /api/health"
echo "    Start the backend, then check:  curl http://localhost:5000/api/health"
echo "    Expect 'database': 'connected' and 'status': 'ok'."
echo ""
echo "Setup complete. Run the backend:  cd $BACKEND && ./venv/bin/python server.py"

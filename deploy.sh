#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  LexTitle AI - Production Deployment & Launch Script"
echo "========================================================"

# 1. Check for .env file
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.production.example..."
    cp .env.production.example .env
    # Generate a random 64-char JWT secret
    RANDOM_JWT=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
    sed -i.bak "s/replace_this_with_a_random_64_character_hex_string_in_production/${RANDOM_JWT}/g" .env
    rm -f .env.bak
    echo "[!] Generated secure random JWT_SECRET in .env."
    echo "[!] Please verify your GEMINI_API_KEY in .env before going live."
fi

# 2. Build Frontend
echo "--> Building production React frontend..."
cd frontend
npm ci --silent
npm run build
cd ..

# 3. Choose Deployment Mode: Docker or Native
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "--> Docker detected. Building and starting production containers..."
    docker compose down --remove-orphans || true
    docker compose up --build -d
    echo ""
    echo "========================================================"
    echo "  LexTitle AI is now LIVE in Docker container!"
    echo "  Access the application at: http://localhost:8000"
    echo "========================================================"
else
    echo "--> Starting with native Python Uvicorn workers..."
    backend/venv/bin/python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --workers 2
fi

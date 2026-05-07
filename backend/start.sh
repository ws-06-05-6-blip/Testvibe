#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Install deps if needed
python3 -m pip install -q fastapi uvicorn aiohttp

echo ""
echo "SecOps CMDB — Vulnerability Scanner API"
echo "Listening on http://localhost:8000"
echo ""

python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

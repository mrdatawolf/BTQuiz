#!/usr/bin/env bash
# Checks prerequisites, installs dependencies if needed, and starts the
# BTQuiz kiosk server. IP and PORT come from .env (see .env.example) —
# the server itself prints every URL it's reachable at once it's listening.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed or not on PATH." >&2
  echo "Install it from https://nodejs.org/ and try again." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example (defaults: IP=0.0.0.0, PORT=4444)"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a
PORT="${PORT:-4444}"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

for f in questions.json config.json; do
  if ! node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" 2>/dev/null; then
    echo "Error: $f has invalid JSON — fix it before starting." >&2
    exit 1
  fi
done

mkdir -p data
touch data/responses.jsonl

if command -v lsof >/dev/null 2>&1 && lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Warning: something is already listening on port $PORT — the server below may fail to start." >&2
fi

echo ""
exec node --env-file-if-exists=.env server.js

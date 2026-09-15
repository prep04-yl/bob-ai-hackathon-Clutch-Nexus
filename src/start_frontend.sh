#!/usr/bin/env bash
# Start the Next.js frontend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules" ]; then
  echo "Installing npm packages..."
  npm install
fi

echo ""
echo "Starting Next.js frontend on http://localhost:3000"
echo ""
npm run dev

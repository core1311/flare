#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8081}"
DIR="$(cd "$(dirname "$0")" && pwd)"

# Build WASM if needed
if [ ! -d "$DIR/pkg" ]; then
  echo "Building WASM (first run)..."
  cd "$DIR" && wasm-pack build --target web --out-name flare
fi

echo ""
echo "  Flare Demo"
echo "  ────────────────────"
echo "  Baseline (clean):  http://localhost:$PORT/"
echo "  All failures:      http://localhost:$PORT/?fail=all"
echo "  Pick flags:        http://localhost:$PORT/?fail=keyboard,contrast"
echo ""
echo "  Flags: keyboard, aria, contrast, csp, heading, table, lang, live-region, focus, skip-link"
echo ""

cd "$DIR" && python3 -m http.server "$PORT"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${1:-public}"
node "$ROOT/scripts/build.mjs" "$PROFILE"

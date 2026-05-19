#!/usr/bin/env bash
set -euo pipefail

if ! command -v speedtest >/dev/null 2>&1; then
  echo "speedtest is not installed. Run 'Install speedtest' first." >&2
  exit 1
fi

speedtest --accept-license

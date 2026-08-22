#!/usr/bin/env bash
# Thin wrapper so both `./setup.sh` and `./scripts/setup.sh` work.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/setup.sh" "$@"

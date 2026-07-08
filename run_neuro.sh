#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PATH="$ROOT/.tools/node/bin:$PATH"

set -a
source "$ROOT/.env"
set +a

exec pi -e extensions/neuro.ts "$@"

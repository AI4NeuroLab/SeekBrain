#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PATH="$ROOT/.tools/node/bin:$PATH"

set -a
source "$ROOT/.env"
set +a

# pi reads its provider/model config (models.json, auth.json) from here. Subagents
# resolve models via PI_CODING_AGENT_DIR too, so it MUST point at the same dir the
# main pi session uses (default ~/.pi/agent, where setup_api.sh writes). Without
# this, subagents load an empty registry and fall back to an unavailable model.
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

exec pi -e extensions/neuro.ts -e extensions/theme-cycler.ts "$@"

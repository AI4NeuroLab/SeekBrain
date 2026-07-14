#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Error: .env not found. Copy .env.example to .env, then run ./scripts/setup_api.sh." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"

if [[ ! -f "$PI_CODING_AGENT_DIR/models.json" || ! -f "$PI_CODING_AGENT_DIR/auth.json" ]]; then
  echo "Error: Pi API config missing under $PI_CODING_AGENT_DIR." >&2
  echo "Run ./scripts/setup_api.sh first." >&2
  exit 1
fi

PROJECT_NODE_BIN="$ROOT/.tools/node/bin"
if [[ ! -x "$PROJECT_NODE_BIN/node" ]]; then
  for candidate in "$ROOT"/.tools/node-v*/bin; do
    if [[ -x "$candidate/node" ]]; then
      PROJECT_NODE_BIN="$candidate"
      break
    fi
  done
fi
if [[ -x "$PROJECT_NODE_BIN/node" ]]; then
  export PATH="$PROJECT_NODE_BIN:$PATH"
fi
if [[ -x "$PROJECT_NODE_BIN/pi" ]]; then
  PI_CMD="$PROJECT_NODE_BIN/pi"
elif command -v pi >/dev/null 2>&1; then
  PI_CMD="$(command -v pi)"
else
  echo "Error: pi command not found. Run ./pi_install.sh or install @earendil-works/pi-coding-agent globally." >&2
  exit 1
fi

exec "$PI_CMD" -e extensions/neuro.ts -e extensions/usage-footer.ts -e extensions/theme-cycler.ts "$@"

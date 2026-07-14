#!/usr/bin/env bash
# ============================================================================
# scripts/setup_api.sh
#
# Create Pi API configuration from this project's .env.
# Supports both official APIs and third-party relay/base URLs.
# Writes to ${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}, matching Pi's runtime config.
#
# Usage:
#   ./scripts/setup_api.sh
#   ./scripts/setup_api.sh --force
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"
ENV_FILE="${ROOT_DIR}/.env"
FORCE=false

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Create Pi provider/auth config from .env.

Options:
  -f, --force   Create agent config files even when no API key is configured.
  -h, --help    Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--force)
      FORCE=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ "${FORCE}" == true ]]; then
    echo "Warning: .env not found; --force enabled, writing placeholder config." >&2
  else
    echo "No .env found. Copy .env.example to .env and fill at least one API key." >&2
    exit 1
  fi
fi


PI_CMD="$(command -v pi || true)"
if [[ -z "${PI_CMD}" ]]; then
  echo "Error: pi command not found. Install @earendil-works/pi-coding-agent first or run ./pi_install.sh." >&2
  exit 1
fi

AGENT_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"
export NEURO_PI_CMD="${PI_CMD}"
export NEURO_AGENT_DIR="${AGENT_DIR}"
export NEURO_PROJECT_ROOT="${ROOT_DIR}"
export NEURO_LOGIN_ENV_FILE="${ENV_FILE}"
export NEURO_SETUP_FORCE="$([[ "${FORCE}" == true ]] && echo 1 || echo 0)"

python3 - <<'PY'
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse


def parse_env(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        values[key] = value
    return values


def write_json(path: Path, data: dict, mode: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if mode is not None:
        path.chmod(mode)


def is_official_url(kind: str, base_url: str) -> bool:
    if not base_url:
        return True
    host = (urlparse(base_url).hostname or "").lower()
    if kind == "anthropic":
        return host in {"api.anthropic.com"}
    if kind == "openai":
        return host in {"api.openai.com"}
    return False


def model_entry(
    model_id: str,
    name: str,
    *,
    vision: bool,
    context: int,
    max_tokens: int,
    input_cost: float = 0,
    output_cost: float = 0,
    cache_read: float = 0,
    cache_write: float = 0,
    extra_compat: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    compat = {
        "supportsDeveloperRole": False,
        "supportsReasoningEffort": False,
    }
    if extra_compat:
        compat.update(extra_compat)
    return {
        "id": model_id,
        "name": name,
        "reasoning": True,
        "input": ["text", "image"] if vision else ["text"],
        "contextWindow": context,
        "maxTokens": max_tokens,
        "cost": {
            "input": input_cost,
            "output": output_cost,
            "cacheRead": cache_read,
            "cacheWrite": cache_write,
        },
        "compat": compat,
    }


def openai_compatible_models() -> List[Dict[str, Any]]:
    return [
        model_entry(
            "deepseek-v4-pro",
            "DeepSeek V4 Pro via OpenAI-compatible endpoint",
            vision=False,
            context=1_000_000,
            max_tokens=65_536,
            input_cost=0.438372,
            output_cost=0.876744,
            cache_read=0.003653,
        ),
        model_entry(
            "gemini-3.1-pro-preview",
            "Gemini 3.1 Pro Preview via OpenAI-compatible endpoint",
            vision=True,
            context=1_000_000,
            max_tokens=8192,
            input_cost=2.0,
            output_cost=12.0,
        ),
        model_entry(
            "glm-5.2",
            "GLM 5.2 via OpenAI-compatible endpoint",
            vision=False,
            context=1_000_000,
            max_tokens=32_768,
            input_cost=1.169,
            output_cost=4.0915,
            cache_read=0.292248,
        ),
        model_entry(
            "claude-opus-4-7",
            "Claude Opus 4.7 via OpenAI-compatible endpoint",
            vision=True,
            context=200_000,
            max_tokens=32_000,
            input_cost=15.0,
            output_cost=75.0,
            cache_read=1.5,
            cache_write=18.75,
        ),
    ]


def anthropic_compatible_models() -> List[Dict[str, Any]]:
    return [
        model_entry(
            "claude-opus-4-7",
            "Claude Opus 4.7 via Anthropic-compatible endpoint",
            vision=True,
            context=200_000,
            max_tokens=32_000,
            input_cost=15.0,
            output_cost=75.0,
            cache_read=1.5,
            cache_write=18.75,
            extra_compat={"forceAdaptiveThinking": True},
        ),
    ]


root = Path(os.environ["NEURO_PROJECT_ROOT"])
env_path = Path(os.environ["NEURO_LOGIN_ENV_FILE"])
pi_cmd = os.environ.get("NEURO_PI_CMD", "pi")
agent_dir = Path(os.environ["NEURO_AGENT_DIR"]).expanduser()
force = os.environ.get("NEURO_SETUP_FORCE") == "1"
env = parse_env(env_path)

anthropic_key = env.get("ANTHROPIC_API_KEY", "").strip()
anthropic_url = env.get("ANTHROPIC_BASE_URL", "").strip()
openai_key = env.get("OPENAI_API_KEY", "").strip()
openai_url = env.get("OPENAI_BASE_URL", "").strip()

if not any([anthropic_key, openai_key]) and not force:
    print(f"No API keys found in {env_path}. Fill ANTHROPIC_API_KEY or OPENAI_API_KEY.")
    raise SystemExit(1)

agent_dir.mkdir(parents=True, exist_ok=True)
providers: Dict[str, Dict[str, Any]] = {}
auth: Dict[str, Dict[str, str]] = {}
updated: List[str] = []

# Official Anthropic remains provider=anthropic. Non-official Anthropic URL gets
# a neutral project provider so Pi will not treat it as the official endpoint.
if anthropic_key or force:
    if is_official_url("anthropic", anthropic_url):
        providers["anthropic"] = ({"baseUrl": anthropic_url} if anthropic_url else {})
        if anthropic_key:
            auth["anthropic"] = {"type": "api_key", "key": anthropic_key}
        updated.append("anthropic official")
    else:
        providers["anthropic-proxy"] = {
            "name": "Anthropic-compatible relay",
            "baseUrl": anthropic_url,
            "api": "anthropic-messages",
            "compat": {
                "forceAdaptiveThinking": True,
                "supportsEagerToolInputStreaming": False,
            },
            "models": anthropic_compatible_models(),
        }
        # Backward-compatible alias for current internal config names.
        providers["neuro-anthropic"] = providers["anthropic-proxy"]
        if anthropic_key:
            auth["anthropic-proxy"] = {"type": "api_key", "key": anthropic_key}
            auth["neuro-anthropic"] = {"type": "api_key", "key": anthropic_key}
        updated.append("anthropic-proxy relay")

# Official OpenAI remains provider=openai. Any custom OPENAI_BASE_URL becomes
# llm-proxy and receives the relay model list.
if openai_key or force:
    if is_official_url("openai", openai_url):
        providers["openai"] = ({"baseUrl": openai_url} if openai_url else {})
        if openai_key:
            auth["openai"] = {"type": "api_key", "key": openai_key}
        updated.append("openai official")
    else:
        relay_url = openai_url or "http://your-openai-compatible-relay/v1"
        providers["llm-proxy"] = {
            "name": "OpenAI-compatible relay",
            "baseUrl": relay_url,
            "api": "openai-completions",
            "authHeader": True,
            "compat": {
                "supportsDeveloperRole": False,
                "supportsReasoningEffort": False,
            },
            "models": openai_compatible_models(),
        }
        # Backward-compatible alias for current internal config names.
        providers["neuro-proxy"] = providers["llm-proxy"]
        if openai_key:
            auth["llm-proxy"] = {"type": "api_key", "key": openai_key}
            auth["neuro-proxy"] = {"type": "api_key", "key": openai_key}
        updated.append("llm-proxy relay")

# Choose default provider from the available set. Relay is preferred when a
# custom OpenAI-compatible URL is configured because current config.yaml uses it.
default_provider = "llm-proxy" if "llm-proxy" in providers else (
    "anthropic-proxy" if "anthropic-proxy" in providers else (
        "anthropic" if "anthropic" in providers else "openai"
    )
)
default_model = "claude-opus-4-7" if default_provider in {
    "llm-proxy", "anthropic", "anthropic-proxy"
} else (
    "gpt-5"
)

write_json(agent_dir / "models.json", {"providers": providers})
write_json(agent_dir / "auth.json", auth, 0o600)
write_json(
    agent_dir / "settings.json",
    {
        "defaultProvider": default_provider,
        "defaultModel": default_model,
        "defaultThinkingLevel": "high",
    },
)

print("Created Pi API config:")
print(f"  pi: {pi_cmd}")
print(f"  agent_dir: {agent_dir}")
print(f"  providers: {', '.join(providers.keys()) or '<none>'}")
print(f"  default: {default_provider} / {default_model}:high")
print(f"  auth entries: {', '.join(auth.keys()) or '<none>'}")
print(f"  read env: {env_path}")
print("Done")
PY

if [[ "${NEURO_SKIP_UI_PATCH:-0}" != "1" && -x "${ROOT_DIR}/scripts/deploy_neuro_ui.sh" ]]; then
  "${ROOT_DIR}/scripts/deploy_neuro_ui.sh"
fi

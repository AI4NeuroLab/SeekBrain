#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"
ENV_FILE="${ROOT_DIR}/.env"
FORCE=false
TEMP_ENV=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Deploy Pi extensions and agent auth/models from internagent/pi + config.yaml.

Options:
  -f, --force   Deploy extensions even when .env is missing or has no API keys.
                Skips auth/models injection when keys are unavailable.
  -h, --help    Show this help.
EOF
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

cleanup() {
  if [[ -n "${TEMP_ENV}" && -f "${TEMP_ENV}" ]]; then
    rm -f "${TEMP_ENV}"
  fi
}
trap cleanup EXIT

# Check for a usable Node.js >= 22.19.0 and Pi CLI.
PROJECT_NODE_BIN="${ROOT_DIR}/.tools/node/bin"
NODE_MIN_VERSION="22.19.0"
NODE_CMD=""
PI_CMD=""
if [[ -x "${PROJECT_NODE_BIN}/node" && -x "${PROJECT_NODE_BIN}/pi" ]]; then
  NODE_CMD="${PROJECT_NODE_BIN}/node"
  PI_CMD="${PROJECT_NODE_BIN}/pi"
elif command -v node >/dev/null 2>&1 && command -v pi >/dev/null 2>&1; then
  NODE_CMD="$(command -v node)"
  PI_CMD="$(command -v pi)"
fi

if [[ -z "${NODE_CMD}" || -z "${PI_CMD}" ]]; then
  echo "Error: Node.js >= 22.19.0 and PI >= 0.80.2 are required but not found." >&2
  echo "  Option 1: Run ./pi_install.sh to install them inside this project." >&2
  echo "  Option 2: Install Node.js >= 22.19.0 and @earendil-works/pi-coding-agent globally, and make Node.js >= 22.19.0 the default 'node'." >&2
  exit 1
fi

version_ge() {
  local a="$1" b="$2"
  if [[ "$a" == "$b" ]]; then
    return 0
  fi
  local sorted
  sorted=$(printf '%s\n%s\n' "$a" "$b" | sort -t. -k1,1n -k2,2n -k3,3n | head -1)
  [[ "$sorted" == "$b" ]]
}

NODE_VERSION="$(${NODE_CMD} --version | sed 's/^v//')"
if ! version_ge "${NODE_VERSION}" "${NODE_MIN_VERSION}"; then
  echo "Error: Node.js >= 22.19.0 is required, but found $(${NODE_CMD} --version) at ${NODE_CMD}." >&2
  echo "  Option 1: Run ./pi_install.sh to install a local Node.js 24+ and pi in this project." >&2
  echo "  Option 2: Install Node.js >= 22.19.0 and @earendil-works/pi-coding-agent globally, and make Node.js >= 22.19.0 the default 'node'." >&2
  exit 1
fi

export PATH="$(dirname "${NODE_CMD}"):$(dirname "${PI_CMD}"):${PATH}"

if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ "${FORCE}" == true ]]; then
    TEMP_ENV="$(mktemp "${TMPDIR:-/tmp}/neuro-pi-deploy-env.XXXXXX")"
    : > "${TEMP_ENV}"
    ENV_FILE="${TEMP_ENV}"
    echo "Warning: .env not found; --force enabled, deploying extensions only." >&2
  else
    echo "No .env found. Copy ${ROOT_DIR}/.env.example to ${ROOT_DIR}/.env and fill it." >&2
    echo "Or rerun with --force to deploy extensions without credentials." >&2
    exit 1
  fi
fi

export NEURO_LOGIN_ENV_FILE="${ENV_FILE}"
export NEURO_PROJECT_ROOT="${ROOT_DIR}"
export NEURO_DEPLOY_FORCE="$([[ "${FORCE}" == true ]] && echo 1 || echo 0)"

python3 - <<'PY'
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict


def parse_env(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
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


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        backup = path.with_suffix(path.suffix + ".bak")
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"Warning: invalid JSON in {path}; backed up to {backup} and recreating. Error: {exc}")
        return {}


def write_json(path: Path, data: dict, mode: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if mode is not None:
        path.chmod(mode)


DEFAULT_BASE_URLS = {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com/v1",
}

def provider_base_override(kind: str, base_url: str) -> dict:
    """Route a built-in provider through a proxy without shadowing official models.

    Pi keeps built-in model ids/pricing and only overrides the endpoint. Writing a
    full models[] entry for ids like claude-opus-4-7 replaces the built-in model and
    drops official cost rates when cost is left at zero.
    """
    if kind == "anthropic":
        return {"baseUrl": base_url}
    if kind == "openai":
        return {"baseUrl": base_url}
    raise ValueError(kind)


def provider_config(kind: str, base_url: str, models: list[dict]) -> dict:
    if kind == "anthropic":
        return {
            "baseUrl": base_url,
            "api": "anthropic-messages",
            "models": models,
        }
    if kind == "openai":
        return {
            "baseUrl": base_url,
            "api": "openai-completions",
            "models": models,
        }
    raise ValueError(kind)


def normalize_model(entry: Dict[str, Any]) -> dict:
    model = {
        "id": entry["id"],
        "name": entry.get("name") or entry["id"],
        "reasoning": bool(entry.get("reasoning", True)),
        "input": ["text", "image"] if entry.get("vision", True) else ["text"],
        "contextWindow": entry.get("context_window", 200000),
        "maxTokens": entry.get("max_tokens", 32000),
        "cost": {
            "input": entry.get("cost_input", 0),
            "output": entry.get("cost_output", 0),
            "cacheRead": entry.get("cost_cache_read", 0),
            "cacheWrite": entry.get("cost_cache_write", 0),
        },
    }
    if entry.get("provider") == "anthropic" and model["reasoning"]:
        model["compat"] = {"forceAdaptiveThinking": True}
    if entry.get("provider") == "openai":
        model["compat"] = {
            "supportsDeveloperRole": False,
            "supportsReasoningEffort": False,
        }
    return model


def load_merged_config_cli(project_root: Path, config_path: Path) -> Dict[str, Any]:
    script = project_root / "internagent" / "workflow" / "agent_config.py"
    if not script.exists():
        print(f"Config helper not found: {script}")
        raise SystemExit(1)
    proc = subprocess.run(
        [sys.executable, str(script), "merged", str(config_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        if proc.stderr.strip():
            print(proc.stderr.strip(), file=sys.stderr)
        raise SystemExit(proc.returncode)
    return json.loads(proc.stdout)


def model_overrides_from_config(config: Dict[str, Any]) -> Dict[str, list[dict]]:
    overrides: Dict[str, list[dict]] = {}
    for entry in config.get("models", []):
        provider = entry.get("provider")
        if provider not in ("anthropic", "openai"):
            print(f"Warning: skipping model entry with unknown provider '{provider}'")
            continue
        entry["provider"] = provider
        overrides.setdefault(provider, []).append(normalize_model(entry))
    return overrides


env_path = Path(os.environ["NEURO_LOGIN_ENV_FILE"])
project_root = Path(os.environ.get("NEURO_PROJECT_ROOT", env_path.parent))
env = parse_env(env_path) if env_path.exists() else {}
pi_source_dir = project_root / "internagent" / "pi"
if not pi_source_dir.exists():
    print(f"Pi source directory not found: {pi_source_dir}")
    raise SystemExit(1)

agent_dir = Path(os.environ.get("PI_CODING_AGENT_DIR", project_root / ".pi" / "agent")).expanduser()
deploy_dir = agent_dir.parent

print(f"Deploying Pi runtime from {pi_source_dir} to {deploy_dir}")
if deploy_dir.exists():
    shutil.rmtree(deploy_dir)
deploy_dir.mkdir(parents=True, exist_ok=True)

shutil.copytree(pi_source_dir / "extensions", deploy_dir / "extensions", dirs_exist_ok=True)
agent_dir.mkdir(parents=True, exist_ok=True)

vendor_bin_dir = project_root / "vendor" / "bin"
agent_bin_dir = agent_dir / "bin"
if vendor_bin_dir.exists():
    agent_bin_dir.mkdir(parents=True, exist_ok=True)
    copied_bins: list[str] = []
    for source in sorted(vendor_bin_dir.iterdir()):
        if not source.is_file():
            continue
        target = agent_bin_dir / source.name
        shutil.copy2(source, target)
        target.chmod(target.stat().st_mode | 0o755)
        copied_bins.append(source.name)
    if copied_bins:
        print(f"Copied vendor/bin -> {agent_bin_dir}: {', '.join(copied_bins)}")
else:
    print(f"Warning: vendor/bin not found; fd/rg helper binaries were not deployed.")

baked_config: Dict[str, Any] = {}
config_path = project_root / "config.yaml"

if config_path.exists():
    baked_config = load_merged_config_cli(project_root, config_path)
    for ext_name in ("neuroscientist-level1", "neuroscientist-level2"):
        ext_dir = deploy_dir / "extensions" / ext_name
        write_json(ext_dir / "config.json", baked_config)
        print(f"Baked config.yaml -> {ext_dir / 'config.json'}")

    agents = baked_config.get("agents", {})
    if agents:
        # Bare `pi` (no workflow flags) uses level1; level1/level2 scripts pass --provider/--model.
        main_cfg = agents.get("level1", {}) or {}
        if any(main_cfg.get(key) for key in ("provider", "model", "thinking")):
            settings = load_json(pi_source_dir / "agent" / "settings.json")
            if main_cfg.get("provider"):
                settings["defaultProvider"] = main_cfg["provider"]
            if main_cfg.get("model"):
                settings["defaultModel"] = main_cfg["model"]
            if main_cfg.get("thinking"):
                settings["defaultThinkingLevel"] = main_cfg["thinking"]
            write_json(agent_dir / "settings.json", settings)
            print(f"Baked [agents.level1] -> {agent_dir / 'settings.json'}")
        else:
            shutil.copy2(pi_source_dir / "agent" / "settings.json", agent_dir / "settings.json")
    else:
        shutil.copy2(pi_source_dir / "agent" / "settings.json", agent_dir / "settings.json")
else:
    shutil.copy2(pi_source_dir / "agent" / "settings.json", agent_dir / "settings.json")

models_path = agent_dir / "models.json"
auth_path = agent_dir / "auth.json"

models = load_json(models_path)
models.setdefault("providers", {})
auth = load_json(auth_path)

updated = []

anthropic_url = env.get("ANTHROPIC_BASE_URL", DEFAULT_BASE_URLS["anthropic"]).strip()
anthropic_key = env.get("ANTHROPIC_API_KEY", "").strip()
openai_url = env.get("OPENAI_BASE_URL", DEFAULT_BASE_URLS["openai"]).strip()
openai_key = env.get("OPENAI_API_KEY", "").strip()

model_overrides = model_overrides_from_config(baked_config)

if anthropic_key:
    anthropic_models = model_overrides.get("anthropic")
    if anthropic_models:
        models["providers"]["anthropic"] = provider_config(
            "anthropic",
            anthropic_url or DEFAULT_BASE_URLS["anthropic"],
            anthropic_models,
        )
    else:
        models["providers"]["anthropic"] = provider_base_override(
            "anthropic",
            anthropic_url or DEFAULT_BASE_URLS["anthropic"],
        )
    auth["anthropic"] = {"type": "api_key", "key": anthropic_key}
    updated.append("models.providers.anthropic")
    updated.append("auth.anthropic")

if openai_key:
    openai_models = model_overrides.get("openai")
    if openai_models:
        models["providers"]["openai"] = provider_config(
            "openai",
            openai_url or DEFAULT_BASE_URLS["openai"],
            openai_models,
        )
    else:
        models["providers"]["openai"] = provider_base_override(
            "openai",
            openai_url or DEFAULT_BASE_URLS["openai"],
        )
    auth["openai"] = {"type": "api_key", "key": openai_key}
    updated.append("models.providers.openai")
    updated.append("auth.openai")

force = os.environ.get("NEURO_DEPLOY_FORCE") == "1"

if not updated:
    if force:
        print(
            f"No API keys found in {env_path}; force deploy kept extensions/settings only."
        )
    else:
        print(f"No API keys found in {env_path}. Nothing deployed.")
        raise SystemExit(1)
else:
    write_json(models_path, models)
    write_json(auth_path, auth, 0o600)
    print(f"Updated: {', '.join(updated)}")
    print(f"models.json: {models_path}")
    print(f"auth.json: {auth_path}")

print(f"Read env: {env_path}")
print("")
print("Done")
PY

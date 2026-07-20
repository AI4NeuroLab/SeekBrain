#!/usr/bin/env bash
# ============================================================================
# internagent/workflow/level2.sh
#
# Interactive: run with no CLI args to start Pi at /level2.
# CLI: pass --question (yaml path or text), --dataset (optional), and
# optionally --work_dir/--path to run one level-2 task non-interactively.
#
# Usage:
#   ./pi_run_level2.sh
#   ./pi_run_level2.sh --question question/level-2/Findling_Q1.yaml --work_dir results/level-2/...
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi
# Respect an inherited PI_CODING_AGENT_DIR (set by run_neuro.sh or a spawning
# process, pointing at where setup_api.sh registered the providers). Only default
# to project-local .pi/agent when unset — unconditionally forcing it here loads a
# models.json without neuro-proxy and subagents fail with 'Unknown provider'.
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-${ROOT_DIR}/.pi/agent}"
MAIN_AGENT="level2"
AGENT_CONFIG_PY="${ROOT_DIR}/internagent/workflow/agent_config.py"
LEVEL2_EXTENSION_DIR="${ROOT_DIR}/extensions/neuro/level2"
if [[ ! -f "${LEVEL2_EXTENSION_DIR}/index.ts" ]]; then
  LEVEL2_EXTENSION_DIR="${ROOT_DIR}/.pi/extensions/neuroscientist-level2"
fi
if [[ ! -f "${LEVEL2_EXTENSION_DIR}/index.ts" ]]; then
  LEVEL2_EXTENSION_DIR="${ROOT_DIR}/internagent/pi/extensions/neuroscientist-level2"
fi
PROMPT_DIR="${LEVEL2_EXTENSION_DIR}/prompts"

PROJECT_NODE_BIN="${ROOT_DIR}/.tools/node/bin"
if [[ ! -x "${PROJECT_NODE_BIN}/node" ]]; then
  for candidate in "${ROOT_DIR}"/.tools/node-v*/bin; do
    if [[ -x "${candidate}/node" ]]; then
      PROJECT_NODE_BIN="${candidate}"
      break
    fi
  done
fi
if [[ -x "${PROJECT_NODE_BIN}/node" ]]; then
  export PATH="${PROJECT_NODE_BIN}:${PATH}"
fi
if [[ -x "${PROJECT_NODE_BIN}/pi" ]]; then
  PI_CMD="${PROJECT_NODE_BIN}/pi"
elif command -v pi >/dev/null 2>&1; then
  PI_CMD="$(command -v pi)"
else
  echo "Error: 'pi' command not found. Run ./pi_install.sh first." >&2
  exit 1
fi
PI_RESOURCE_ARGS=(
  --approve
  --no-extensions
  --extension "${LEVEL2_EXTENSION_DIR}/index.ts"
  --extension "${ROOT_DIR}/extensions/usage-footer.ts"
  --no-prompt-templates
  --prompt-template "${PROMPT_DIR}/entry.md"
  --tools "read,bash,edit,write,neuro_l2_ping,neuro_l2_start_run,neuro_l2_subquestion,neuro_l2_subquestion_review,neuro_l2_method_development,neuro_l2_method_review,neuro_l2_run_level1,neuro_l2_subagent_conclusion,neuro_l2_subagent_conclusion_review,neuro_l2_question_conclusion,neuro_l2_paper_report,neuro_l2_export_report"
)

QUESTION=""
DATASET=""
WORK_DIR=""
EXTRA_PATH=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Interactive:
  $(basename "$0")

CLI mode:
  --question TEXT       Either a path to a level-2 YAML file (scientific_goal/question/background/meta_json_path)
                        or the raw research question text.
  --dataset TEXT        Optional dataset metadata: JSON content or path to a .json file.
  --work_dir PATH       Optional output directory for this run.
  --path TEXT           Optional extra path/access notes.
  -h, --help            Show this help.
EOF
}

require_value() {
  local option="$1"
  if [[ $# -lt 2 || -z "${2:-}" || "${2:-}" == --* ]]; then
    echo "Error: ${option} requires a value." >&2
    usage >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --question)
      require_value "$@"
      QUESTION="$2"
      shift 2
      ;;
    --dataset)
      require_value "$@"
      DATASET="$2"
      shift 2
      ;;
    --work_dir)
      require_value "$@"
      WORK_DIR="$2"
      shift 2
      ;;
    --path)
      require_value "$@"
      EXTRA_PATH="$2"
      shift 2
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

PROMPT="${QUESTION}"

if [[ -n "${DATASET}" ]]; then
  if [[ -f "${DATASET}" ]]; then
    DATASET="$(cat "${DATASET}")"
  fi
  PROMPT="${PROMPT}

## Dataset / Metadata
${DATASET}"
fi

if [[ -n "${WORK_DIR}" ]]; then
  PROMPT="${PROMPT}

## Output work directory
Use work_dir: ${WORK_DIR}"
fi

if [[ -n "${EXTRA_PATH}" ]]; then
  PROMPT="${PROMPT}

## Extra path / access notes
${EXTRA_PATH}"
fi

LOG_PATH="${WORK_DIR:-${ROOT_DIR}}/pi_session.jsonl"
if [[ -n "${WORK_DIR}" ]]; then
  mkdir -p "${WORK_DIR}"
fi
ENTRY_MESSAGE="/entry ${PROMPT}"

summarize_usage() {
  if [[ -z "${WORK_DIR}" ]]; then
    echo "[pi_run_level2] Usage summary skipped: --work_dir was not provided." >&2
    return 0
  fi
  "${ROOT_DIR}/internagent/workflow/summarize_usage.py" "${WORK_DIR}" || true
}

load_main_pi_args() {
  PI_MAIN_ARGS=()
  if [[ ! -f "${AGENT_CONFIG_PY}" ]]; then
    return 0
  fi
  mapfile -t PI_MAIN_ARGS < <(
    python3 "${AGENT_CONFIG_PY}" "${MAIN_AGENT}" pi_args "${ROOT_DIR}/config.yaml"
  )
}

read_main_timeout() {
  local fallback="$1"
  python3 "${AGENT_CONFIG_PY}" "${MAIN_AGENT}" timeout_seconds "${fallback}" "${ROOT_DIR}/config.yaml"
}

read_workflow_flag() {
  local field="$1"
  python3 "${AGENT_CONFIG_PY}" workflow "${field}" "${ROOT_DIR}/config.yaml"
}

write_workflow_timing() {
  if [[ -z "${WORK_DIR}" ]]; then
    return 0
  fi
  local started_epoch="$1"
  local ended_epoch="$2"
  local timeout_seconds="$3"
  local final_status="$4"
  python3 - "$WORK_DIR" "$started_epoch" "$ended_epoch" "$timeout_seconds" "$final_status" <<'PY'
import datetime
import json
import pathlib
import sys

work_dir = pathlib.Path(sys.argv[1])
started = int(sys.argv[2])
ended = int(sys.argv[3])
timeout_seconds = int(sys.argv[4]) if sys.argv[4].isdigit() else 0
final_status = int(sys.argv[5])
duration = max(0, ended - started)
payload = {
    "started_at": datetime.datetime.fromtimestamp(started, datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "ended_at": datetime.datetime.fromtimestamp(ended, datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "duration_seconds": duration,
    "timeout_seconds": timeout_seconds,
    "final_status": final_status,
    "timed_out_guess": bool(timeout_seconds and duration >= timeout_seconds and final_status != 0),
}
work_dir.mkdir(parents=True, exist_ok=True)
(work_dir / "workflow_timing.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
print(
    f"[pi_run_level2] timing: started_at={payload['started_at']} "
    f"ended_at={payload['ended_at']} duration={duration}s "
    f"timeout={timeout_seconds}s final_status={final_status} "
    f"path={work_dir / 'workflow_timing.json'}"
)
PY
}

load_main_pi_args

if [[ -z "${QUESTION}" ]]; then
  exec "${PI_CMD}" "${PI_RESOURCE_ARGS[@]}" "${PI_MAIN_ARGS[@]}"
fi

echo "[pi_run_level2] Running non-interactive /level2"
DEBUG_DISK_WRITES="$(read_workflow_flag debug_disk_writes)"
PI_LOG_PATH="${LOG_PATH}"
if [[ "${DEBUG_DISK_WRITES}" != true ]]; then
  PI_LOG_PATH="/dev/null"
  echo "[pi_run_level2] Debug disk writes off (workflow.debug_disk_writes=false); session log -> /dev/null."
else
  echo "[pi_run_level2] Session JSONL will be written to: ${LOG_PATH}"
fi

RUN_TIMEOUT_SECONDS="$(read_main_timeout 3600)"
RUN_STARTED_EPOCH="$(date +%s)"
echo "[pi_run_level2] Started at: $(date -Iseconds)"
set +e
"${PI_CMD}" "${PI_RESOURCE_ARGS[@]}" "${PI_MAIN_ARGS[@]}" --mode json "${ENTRY_MESSAGE}" > "${PI_LOG_PATH}"
status=$?
set -e
RUN_ENDED_EPOCH="$(date +%s)"
if [[ "${DEBUG_DISK_WRITES}" == true ]]; then
  write_workflow_timing "${RUN_STARTED_EPOCH}" "${RUN_ENDED_EPOCH}" "${RUN_TIMEOUT_SECONDS}" "${status}"
  summarize_usage
fi
exit "${status}"

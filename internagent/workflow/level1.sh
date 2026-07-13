#!/usr/bin/env bash
# ============================================================================
# internagent/workflow/level1.sh
#
# Interactive by default (Pi TUI + explicit /entry prompt template).
# Only --non-interactive selects headless mode (--mode json).
# Always pass --approve so project .pi resources load without a trust prompt.
# Task flags (--query, --dataset, ...) work in both modes.
#
# Usage:
#   ./pi_run_level1.sh
#   ./pi_run_level1.sh --query "..." --dataset "..." --work_dir results/...
#   ./pi_run_level1.sh --non-interactive --query "..." --dataset "..." --work_dir results/...
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
# Respect an inherited PI_CODING_AGENT_DIR (set by run_neuro.sh / the spawning
# level-2 process, pointing at where setup_api.sh registered the providers).
# Only default to project-local .pi/agent when unset — unconditionally forcing
# it here loaded a models.json without neuro-proxy and level-1 spawns failed
# with 'Unknown provider "neuro-proxy"'.
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-${ROOT_DIR}/.pi/agent}"
MAIN_AGENT="level1"
AGENT_CONFIG_PY="${ROOT_DIR}/internagent/workflow/agent_config.py"
LEVEL1_EXTENSION_DIR="${ROOT_DIR}/extensions/neuro/level1"
if [[ ! -f "${LEVEL1_EXTENSION_DIR}/index.ts" ]]; then
  LEVEL1_EXTENSION_DIR="${ROOT_DIR}/.pi/extensions/neuroscientist-level1"
fi
if [[ ! -f "${LEVEL1_EXTENSION_DIR}/index.ts" ]]; then
  LEVEL1_EXTENSION_DIR="${ROOT_DIR}/internagent/pi/extensions/neuroscientist-level1"
fi
PROMPT_DIR="${LEVEL1_EXTENSION_DIR}/prompts"
if [[ ! -f "${PROMPT_DIR}/continue.md" ]]; then
  PROMPT_DIR="${ROOT_DIR}/internagent/pi/extensions/neuroscientist-level1/prompts"
fi

# Prefer project-internal Node/Pi, fall back to global, fail if neither exists.
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
  --extension "${LEVEL1_EXTENSION_DIR}/index.ts"
  --no-prompt-templates
  --prompt-template "${PROMPT_DIR}/entry.md"
  --tools "read,bash,edit,write,neuro_ping,neuro_capabilities,neuro_start_run,neuro_resume_run,neuro_approve_stage,neuro_record_feedback,resolve_targeted_skill,neuro_deep_research,neuro_plan,neuro_code,neuro_validate,neuro_refine_image,neuro_analyze_image,neuro_conclude"
)
PI_CONCLUDE_ONLY_ARGS=(
  --approve
  --no-extensions
  --extension "${LEVEL1_EXTENSION_DIR}/index.ts"
  --no-prompt-templates
  --prompt-template "${PROMPT_DIR}/entry.md"
  --tools "read,bash,neuro_resume_run,neuro_conclude"
)

NON_INTERACTIVE=false
QUERY=""
DATASET=""
WORK_DIR=""
EXTRA_PATH=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Interactive (default; Pi TUI + /entry prompt template):
  $(basename "$0")
  $(basename "$0") --query TEXT --dataset TEXT [--work_dir PATH] [--path TEXT]

Non-interactive (headless; --mode json):
  $(basename "$0") --non-interactive \\
    --query TEXT --dataset TEXT [--work_dir PATH] [--path TEXT]

Options:
  --non-interactive     Headless run; without this flag, Pi stays interactive
  --query TEXT          Research/visualization question
  --dataset TEXT        Metadata JSON content or path to a .json file
  --work_dir PATH       Output directory for this run
  --path TEXT           Extra path/access notes
  -h, --help            Show this help
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
    --non-interactive)
      NON_INTERACTIVE=true
      shift
      ;;
    --query)
      require_value "$@"
      QUERY="$2"
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

resolve_dataset() {
  if [[ -n "${DATASET}" && -f "${DATASET}" ]]; then
    DATASET="$(cat "${DATASET}")"
  fi
}

build_task_prompt() {
  local prompt="${QUERY}"
  if [[ -n "${DATASET}" ]]; then
    prompt="${prompt}

## Dataset / Metadata
${DATASET}"
  fi
  if [[ -n "${WORK_DIR}" ]]; then
    prompt="${prompt}

## Output work directory
Use work_dir: ${WORK_DIR}"
  fi
  if [[ -n "${EXTRA_PATH}" ]]; then
    prompt="${prompt}

## Extra path / access notes
${EXTRA_PATH}"
  fi
  printf '%s' "${prompt}"
}

has_task_args() {
  [[ -n "${QUERY}" || -n "${DATASET}" || -n "${WORK_DIR}" || -n "${EXTRA_PATH}" ]]
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

build_entry_message() {
  resolve_dataset
  printf '/entry %s' "$(build_task_prompt)"
}

build_noninteractive_entry_message() {
  resolve_dataset
  local prompt
  prompt="$(build_task_prompt)"
  prompt="${prompt}

## Non-interactive execution policy
This run is non-interactive. Continue through the workflow until neuro_conclude succeeds and writes the final conclusion artifact. Only stop after conclusion. Do not ask the user follow-up questions. If required information is insufficient or a workflow stage is blocked, do not wait for user input. Use the available metadata and paths as far as possible, then finish the workflow by writing a final conclusion that clearly states the blocking condition, missing information, and confidence/limitations."
  printf '/entry %s' "${prompt}"
}

summarize_usage() {
  if [[ -z "${WORK_DIR}" ]]; then
    echo "[pi_run_level1] Usage summary skipped: --work_dir was not provided." >&2
    return 0
  fi
  "${ROOT_DIR}/internagent/workflow/summarize_usage.py" "${WORK_DIR}" || true
}

has_conclusion() {
  if [[ -z "${WORK_DIR}" ]]; then
    return 1
  fi
  python3 - "$WORK_DIR" <<'PY'
import json
import pathlib
import sys

work_dir = pathlib.Path(sys.argv[1])
if (work_dir / "conclusions.json").is_file():
    raise SystemExit(0)
try:
    state = json.loads((work_dir / "state.json").read_text())
except Exception:
    raise SystemExit(1)
raise SystemExit(0 if state.get("conclusions") else 1)
PY
}

has_resumable_state() {
  if [[ -z "${WORK_DIR}" ]]; then
    return 1
  fi
  python3 - "$WORK_DIR" <<'PY'
import json
import pathlib
import sys

try:
    state = json.loads((pathlib.Path(sys.argv[1]) / "state.json").read_text())
except Exception:
    raise SystemExit(1)
raise SystemExit(0 if state.get("run_id") else 1)
PY
}

read_conclude_only_timeout() {
  local fallback="$1"
  python3 "${AGENT_CONFIG_PY}" level1_conclude timeout_seconds "${fallback}" "${ROOT_DIR}/config.yaml"
}

read_workflow_flag() {
  local field="$1"
  python3 "${AGENT_CONFIG_PY}" workflow "${field}" "${ROOT_DIR}/config.yaml"
}

render_recovery_prompt() {
  local template_name="$1"
  python3 - "${PROMPT_DIR}" "${template_name}" "${WORK_DIR}" "${QUERY}" "${DATASET}" "${EXTRA_PATH}" <<'PY'
import pathlib
import sys

prompt_dir = pathlib.Path(sys.argv[1])
template_name = sys.argv[2]
work_dir = pathlib.Path(sys.argv[3])
query = sys.argv[4]
dataset = sys.argv[5]
extra_path = sys.argv[6]

template = (prompt_dir / template_name).read_text(encoding="utf-8")
dataset_section = ""
if dataset.strip():
    dataset_section = f"## Dataset / Metadata\n{dataset}\n"
extra_path_section = ""
if extra_path.strip():
    extra_path_section = f"## Extra path / access notes\n{extra_path}\n"

body = (
    template.replace("{{WORK_DIR}}", str(work_dir))
    .replace("{{QUERY}}", query)
    .replace("{{DATASET_SECTION}}", dataset_section)
    .replace("{{EXTRA_PATH_SECTION}}", extra_path_section)
)
print(f"/entry {body}")
PY
}

build_continue_message() {
  resolve_dataset
  render_recovery_prompt "continue.md"
}

build_conclude_only_message() {
  resolve_dataset
  render_recovery_prompt "conclude_only.md"
}

run_pi_json() {
  local message="$1"
  local log_path="$2"
  local timeout_seconds="$3"
  shift 3
  local -a extra_args=("$@")
  local output_path="${log_path}"
  if [[ "${DEBUG_DISK_WRITES}" != true ]]; then
    output_path="/dev/null"
  fi
  if [[ "${timeout_seconds}" =~ ^[0-9]+$ && "${timeout_seconds}" -gt 0 && "$(command -v timeout || true)" ]]; then
    timeout --preserve-status "${timeout_seconds}s" "${PI_CMD}" "${extra_args[@]}" "${PI_MAIN_ARGS[@]}" --mode json "${message}" > "${output_path}"
  else
    "${PI_CMD}" "${extra_args[@]}" "${PI_MAIN_ARGS[@]}" --mode json "${message}" > "${output_path}"
  fi
}

compress_session_log() {
  local log_path="$1"
  if [[ ! -f "${log_path}" ]]; then
    return 0
  fi
  if ! command -v gzip >/dev/null 2>&1; then
    echo "[pi_run_level1] gzip not found; leaving session JSONL uncompressed: ${log_path}" >&2
    return 0
  fi
  if gzip -f "${log_path}"; then
    echo "[pi_run_level1] Compressed session JSONL: ${log_path}.gz"
  else
    echo "[pi_run_level1] Failed to gzip session JSONL; leaving as-is: ${log_path}" >&2
  fi
}

write_workflow_timing() {
  if [[ -z "${WORK_DIR}" ]]; then
    return 0
  fi
  local started_epoch="$1"
  local ended_epoch="$2"
  local timeout_seconds="$3"
  local initial_status="$4"
  local continue_status="$5"
  local conclude_only_status="$6"
  local final_status="$7"
  python3 - "$WORK_DIR" "$started_epoch" "$ended_epoch" "$timeout_seconds" "$initial_status" "$continue_status" "$conclude_only_status" "$final_status" <<'PY'
import datetime
import json
import pathlib
import sys

work_dir = pathlib.Path(sys.argv[1])
started = int(sys.argv[2])
ended = int(sys.argv[3])
timeout_seconds = int(sys.argv[4]) if sys.argv[4].isdigit() else 0
initial_status = int(sys.argv[5])
continue_status = None if sys.argv[6] == "none" else int(sys.argv[6])
conclude_only_status = None if sys.argv[7] == "none" else int(sys.argv[7])
final_status = int(sys.argv[8])
duration = max(0, ended - started)
payload = {
    "started_at": datetime.datetime.fromtimestamp(started, datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "ended_at": datetime.datetime.fromtimestamp(ended, datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "duration_seconds": duration,
    "timeout_seconds": timeout_seconds,
    "initial_status": initial_status,
    "continue_status": continue_status,
    "conclude_only_status": conclude_only_status,
    "final_status": final_status,
    "timed_out_guess": bool(timeout_seconds and duration >= timeout_seconds and initial_status != 0),
}
work_dir.mkdir(parents=True, exist_ok=True)
(work_dir / "workflow_timing.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
print(
    f"[pi_run_level1] timing: started_at={payload['started_at']} "
    f"ended_at={payload['ended_at']} duration={duration}s "
    f"timeout={timeout_seconds}s final_status={final_status} "
    f"path={work_dir / 'workflow_timing.json'}"
)
PY
}

load_main_pi_args

if [[ "${NON_INTERACTIVE}" != true ]]; then
  if [[ -n "${WORK_DIR}" ]]; then
    mkdir -p "${WORK_DIR}"
  fi
  if has_task_args; then
    ENTRY_MESSAGE="$(build_entry_message)"
    exec "${PI_CMD}" "${PI_RESOURCE_ARGS[@]}" "${PI_MAIN_ARGS[@]}" "${ENTRY_MESSAGE}"
  fi
  exec "${PI_CMD}" "${PI_RESOURCE_ARGS[@]}" "${PI_MAIN_ARGS[@]}"
fi

if [[ -z "${QUERY}" ]]; then
  echo "Error: --query is required with --non-interactive." >&2
  usage >&2
  exit 1
fi
if [[ -z "${DATASET}" ]]; then
  echo "Error: --dataset is required with --non-interactive." >&2
  usage >&2
  exit 1
fi
export NEURO_LEVEL1_NON_INTERACTIVE=1

LOG_PATH="${WORK_DIR:-${ROOT_DIR}}/pi_session.jsonl"
CONTINUE_LOG_PATH=""
CONCLUDE_ONLY_LOG_PATH=""
if [[ -n "${WORK_DIR}" ]]; then
  mkdir -p "${WORK_DIR}"
fi
ENTRY_MESSAGE="$(build_noninteractive_entry_message)"

echo "[pi_run_level1] Running non-interactive /level1"
echo "[pi_run_level1] Session JSONL: ${LOG_PATH}"

RUN_TIMEOUT_SECONDS="$(read_main_timeout 5400)"
CONCLUDE_ONLY_TIMEOUT_SECONDS="$(read_conclude_only_timeout 600)"
DEBUG_DISK_WRITES="$(read_workflow_flag debug_disk_writes)"
RUN_STARTED_EPOCH="$(date +%s)"
echo "[pi_run_level1] Started at: $(date -Iseconds)"
if [[ "${DEBUG_DISK_WRITES}" != true ]]; then
  echo "[pi_run_level1] Debug disk writes off (workflow.debug_disk_writes=false); session log -> /dev/null."
fi
continue_status="none"
conclude_only_status="none"
set +e
run_pi_json "${ENTRY_MESSAGE}" "${LOG_PATH}" "${RUN_TIMEOUT_SECONDS}" "${PI_RESOURCE_ARGS[@]}"
status=$?
initial_status="${status}"
set -e

if [[ -n "${WORK_DIR}" ]] && ! has_conclusion && [[ "${initial_status}" -eq 0 ]]; then
  if has_resumable_state; then
    CONTINUE_LOG_PATH="${WORK_DIR}/pi_session.continue.jsonl"
    CONTINUE_MESSAGE="$(build_continue_message)"
    echo "[pi_run_level1] Exit 0 without conclusion; running continue (once)."
    echo "[pi_run_level1] Continue session JSONL: ${CONTINUE_LOG_PATH}"
    set +e
    run_pi_json "${CONTINUE_MESSAGE}" "${CONTINUE_LOG_PATH}" "${RUN_TIMEOUT_SECONDS}" "${PI_RESOURCE_ARGS[@]}"
    continue_status=$?
    set -e
    if has_conclusion; then
      status=0
    elif [[ "${continue_status}" -ne 0 ]]; then
      status="${continue_status}"
    else
      status=0
    fi
  else
    echo "[pi_run_level1] Continue skipped: state.json missing or has no run_id." >&2
    status=2
  fi
fi

if [[ -n "${WORK_DIR}" ]] && ! has_conclusion; then
  if has_resumable_state; then
    CONCLUDE_ONLY_LOG_PATH="${WORK_DIR}/pi_session.conclude_only.jsonl"
    CONCLUDE_ONLY_MESSAGE="$(build_conclude_only_message)"
    echo "[pi_run_level1] Still no conclusion; running conclude_only (once)."
    echo "[pi_run_level1] Conclude-only session JSONL: ${CONCLUDE_ONLY_LOG_PATH}"
    set +e
    run_pi_json "${CONCLUDE_ONLY_MESSAGE}" "${CONCLUDE_ONLY_LOG_PATH}" "${CONCLUDE_ONLY_TIMEOUT_SECONDS}" "${PI_CONCLUDE_ONLY_ARGS[@]}"
    conclude_only_status=$?
    set -e
    if [[ "${conclude_only_status}" -ne 0 ]]; then
      status="${conclude_only_status}"
    elif ! has_conclusion; then
      echo "[pi_run_level1] Conclude-only finished but conclusions.json/state.conclusions is still missing." >&2
      status=2
    else
      status=0
    fi
  else
    echo "[pi_run_level1] Conclude-only skipped: state.json missing or has no run_id." >&2
    if [[ "${initial_status}" -ne 0 ]]; then
      status="${initial_status}"
    else
      status=2
    fi
  fi
fi

RUN_ENDED_EPOCH="$(date +%s)"
if [[ "${DEBUG_DISK_WRITES}" == true ]]; then
  compress_session_log "${LOG_PATH}"
  if [[ -n "${CONTINUE_LOG_PATH}" ]]; then
    compress_session_log "${CONTINUE_LOG_PATH}"
  fi
  if [[ -n "${CONCLUDE_ONLY_LOG_PATH}" ]]; then
    compress_session_log "${CONCLUDE_ONLY_LOG_PATH}"
  fi
  write_workflow_timing "${RUN_STARTED_EPOCH}" "${RUN_ENDED_EPOCH}" "${RUN_TIMEOUT_SECONDS}" "${initial_status}" "${continue_status}" "${conclude_only_status}" "${status}"
  summarize_usage
fi
exit "${status}"

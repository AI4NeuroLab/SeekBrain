#!/usr/bin/env bash
# ============================================================================
# internagent/workflow/many_level1.sh
#
# Batch launcher for the level-1 workflow. The task table is read from a JSONL
# file whose path is the first positional argument.
#
# Usage:
#   ./pi_run_many_level1.sh cases/ALL.jsonl
#   ./pi_run_many_level1.sh cases/A8.jsonl --parallel 2
#   ./pi_run_many_level1.sh cases/A8.jsonl --results_path results/test_0702
#   ./pi_run_many_level1.sh cases/A8.jsonl --dry-run
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"
PI_RUN_LEVEL1="${ROOT_DIR}/internagent/workflow/level1.sh"
PI_MAPPING="${ROOT_DIR}/internagent/workflow/pi_mapping.tsv"

QUESTIONS_FILE=""
RESULTS_PATH="results"
RESULTS_DIR=""
PARALLEL=1
GAP=60
DRY_RUN=false
TASK_STARTED=false

usage() {
  cat <<EOF
Usage: $(basename "$0") <questions.jsonl> [options]

Required positional argument:
  questions.jsonl   JSONL file; each line is one level-1 task.

Execution control:
  --results_path PATH  Batch result root (default: results).
                       Relative paths are resolved from the project root.
  --parallel N      Run up to N level-1 tasks concurrently (default: 1).
  --gap SECONDS     Sleep SECONDS between launching tasks (default: 60).
  --dry-run         Print what would be executed without running anything.
  -h, --help        Show this help.
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
    -h|--help)
      usage
      exit 0
      ;;
    --results_path|--results-path)
      require_value "$@"
      RESULTS_PATH="$2"
      shift 2
      ;;
    --parallel)
      require_value "$@"
      PARALLEL="$2"
      shift 2
      ;;
    --gap)
      require_value "$@"
      GAP="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -z "${QUESTIONS_FILE}" ]]; then
        QUESTIONS_FILE="$1"
      else
        echo "Unexpected positional argument: $1" >&2
        usage >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if ! [[ "${PARALLEL}" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: --parallel must be a positive integer (got: ${PARALLEL})." >&2
  exit 1
fi

if [[ -z "${QUESTIONS_FILE}" ]]; then
  echo "Error: <questions.jsonl> is required." >&2
  usage >&2
  exit 1
fi

if [[ ! -f "${QUESTIONS_FILE}" ]]; then
  echo "Error: questions file not found: ${QUESTIONS_FILE}" >&2
  exit 1
fi
QUESTIONS_FILE="$(cd "$(dirname "${QUESTIONS_FILE}")" && pwd)/$(basename "${QUESTIONS_FILE}")"
QUESTIONS_DIR="$(dirname "${QUESTIONS_FILE}")"

if [[ "${RESULTS_PATH}" = /* ]]; then
  RESULTS_DIR="${RESULTS_PATH}"
else
  RESULTS_DIR="${ROOT_DIR}/${RESULTS_PATH}"
fi

if [[ ! -x "${PI_RUN_LEVEL1}" ]]; then
  echo "Error: ${PI_RUN_LEVEL1} not found or not executable." >&2
  exit 1
fi

if [[ ! -f "${PI_MAPPING}" ]]; then
  echo "Error: mapping file not found: ${PI_MAPPING}" >&2
  exit 1
fi

# Load pi_mapping into associative arrays.
declare -A MAPPING_LABEL=()
declare -A MAPPING_META=()
while IFS=$'\t' read -r exp_data label meta_items; do
  [[ -z "${exp_data}" || "${exp_data}" == \#* ]] && continue
  MAPPING_LABEL["${exp_data}"]="${label}"
  MAPPING_META["${exp_data}"]="${meta_items}"
done < "${PI_MAPPING}"

resolve_dataset() {
  local meta_path="$1"
  if [[ -f "${meta_path}" ]]; then
    cat "${meta_path}"
  else
    echo ""
  fi
}

resolve_question_file() {
  local question_path="$1"
  if [[ "${question_path}" = /* ]]; then
    printf '%s' "${question_path}"
  elif [[ "${question_path}" == question/* ]]; then
    printf '%s/%s' "${ROOT_DIR}" "${question_path}"
  else
    printf '%s/%s' "${QUESTIONS_DIR}" "${question_path}"
  fi
}

run_one() {
  TASK_STARTED=false
  local task_json="$1"
  local question_ref question_path question exp_data tag label meta_path dataset work_dir
  question_ref="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['question'])" "${task_json}")"
  exp_data="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['exp_data'])" "${task_json}")"
  tag="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['tag'])" "${task_json}")"
  question_path="$(resolve_question_file "${question_ref}")"
  if [[ ! -f "${question_path}" ]]; then
    echo "Warning: question file not found: ${question_path}; skipping task tag='${tag}'." >&2
    return 0
  fi
  question="$(cat "${question_path}")"

  label="${MAPPING_LABEL[${exp_data}]:-}"
  if [[ -z "${label}" ]]; then
    echo "Warning: no mapping for exp_data='${exp_data}', skipping task tag='${tag}'." >&2
    return 0
  fi

  meta_path="${MAPPING_META[${exp_data}]:-}"
  dataset="$(resolve_dataset "${meta_path}")"

  local ymd
  ymd="$(date +%Y%m%d)"
  local ts
  ts="$(date +%H%M%S)"
  work_dir="${RESULTS_DIR}/${label}/${ymd}/${tag}-${ts}"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  exp_data : ${exp_data}"
  echo "  label    : ${label}"
  echo "  tag      : ${tag}"
  echo "  work_dir : ${work_dir}"
  echo "  meta     : ${meta_path:-<none>}"
  echo "  question : ${question_ref}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local cmd=("${PI_RUN_LEVEL1}" --non-interactive --query "${question}" --dataset "${dataset}" --work_dir "${work_dir}")

  if [[ "${DRY_RUN}" == true ]]; then
    printf '[dry-run] '
    printf '%q ' "${cmd[@]}"
    printf '\n'
    return 0
  fi

  "${cmd[@]}" &
  TASK_STARTED=true
}

reap_one() {
  if wait -n 2>/dev/null; then
    return 0
  fi
  local rc=$?
  # wait -n unavailable (bash < 4.3): wait for any background job
  wait || rc=$?
  return "${rc}"
}

declare -a TASKS=()
while IFS= read -r line || [[ -n "${line}" ]]; do
  [[ -z "${line}" || "${line}" == \#* ]] && continue
  TASKS+=("${line}")
done < "${QUESTIONS_FILE}"

if [[ ${#TASKS[@]} -eq 0 ]]; then
  echo "No tasks found in ${QUESTIONS_FILE}." >&2
  exit 1
fi

echo "Found ${#TASKS[@]} task(s)."
echo "Parallel: ${PARALLEL} | Gap: ${GAP}s | Results: ${RESULTS_DIR}"

failed=0
running=0
for task_json in "${TASKS[@]}"; do
  while (( running >= PARALLEL )); do
    reap_one || failed=1
    running=$((running - 1))
  done
  run_one "${task_json}"
  if [[ "${TASK_STARTED}" == true ]]; then
    running=$((running + 1))
  fi
  if [[ "${GAP}" -gt 0 ]]; then
    sleep "${GAP}"
  fi
done

while (( running > 0 )); do
  reap_one || failed=1
  running=$((running - 1))
done

if [[ "${failed}" -ne 0 ]]; then
  echo "Batch finished with failures." >&2
  exit 1
fi

echo "All level-1 tasks finished."

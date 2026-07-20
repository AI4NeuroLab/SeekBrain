#!/usr/bin/env bash
set -euo pipefail

# Evaluate every result under /home/zhuyuqing-p/Codex/output with the v3 scorer.
#
# Codex v3 supplies the GT figure and rubric, but does not inject GT JSON. Code
# evaluation is enabled by default and uses analyze.py as submitted evidence.
#
# Usage:
#   bash Codex_v3.sh
#   bash Codex_v3.sh claude-opus-4-6
#   bash Codex_v3.sh --force
#   bash Codex_v3.sh --no-eval-code
#   bash Codex_v3.sh --dry-run

usage() {
    cat >&2 <<'EOF'
Usage: bash Codex_v3.sh [model] [--force] [--eval-code|--no-eval-code] [--dry-run]

With no arguments, evaluate every question under /home/zhuyuqing-p/Codex/output,
including analyze.py as code evidence. Existing scores are reused unless
--force is supplied.
EOF
}

MODEL="claude-opus-4-6"
MODEL_SET=false
EVAL_CODE=true
FORCE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --eval-code)
            EVAL_CODE=true
            ;;
        --no-eval-code)
            EVAL_CODE=false
            ;;
        --force)
            FORCE=true
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        --*)
            echo "ERROR: unknown option: $1" >&2
            usage
            exit 1
            ;;
        *)
            if [[ "${MODEL_SET}" == "true" ]]; then
                echo "ERROR: only one evaluation model may be specified" >&2
                exit 1
            fi
            MODEL="$1"
            MODEL_SET=true
            ;;
    esac
    shift
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVALUATE_DIR="${EVALUATE_DIR:-/mnt/shared-storage-user/zhuyuqing-p/evaluate}"
RESULTS_DIR="${CODEX_RESULTS_DIR:-/home/zhuyuqing-p/Codex/output}"
RUBRIC_DIR="${RUBRIC_DIR:-${EVALUATE_DIR}/evaluate_query/rubric_0714}"
SCORER="${ROOT_DIR}/score_outputs_v3.py"
SCORES_DIR="${CODEX_V3_SCORES_DIR:-${ROOT_DIR}/results/evaluation/scores_codex_v3_conclusions}"
EXPECTED_COUNT="${CODEX_EXPECTED_COUNT:-32}"

if [[ ! -f "${SCORER}" ]]; then
    echo "ERROR: scorer not found: ${SCORER}" >&2
    exit 1
fi
if [[ ! -d "${RESULTS_DIR}" ]]; then
    echo "ERROR: Codex output directory not found: ${RESULTS_DIR}" >&2
    exit 1
fi
if [[ ! -d "${RUBRIC_DIR}" ]]; then
    echo "ERROR: rubric directory not found: ${RUBRIC_DIR}" >&2
    exit 1
fi

mapfile -t RUN_DIRS < <(
    find "${RESULTS_DIR}" -mindepth 2 -maxdepth 2 -type d -print | sort -V
)
RUN_COUNT=${#RUN_DIRS[@]}

if [[ "${RUN_COUNT}" -eq 0 ]]; then
    echo "ERROR: no question directories found under ${RESULTS_DIR}" >&2
    exit 1
fi
if [[ "${RUN_COUNT}" -ne "${EXPECTED_COUNT}" ]]; then
    echo "ERROR: expected ${EXPECTED_COUNT} Codex results, found ${RUN_COUNT}." >&2
    echo "       Set CODEX_EXPECTED_COUNT=${RUN_COUNT} only if this is intentional." >&2
    exit 1
fi

MISSING=0
for run_dir in "${RUN_DIRS[@]}"; do
    relative_run="${run_dir#"${RESULTS_DIR}"/}"
    for required_file in conclusion.md analyze.png; do
        if [[ ! -f "${run_dir}/${required_file}" ]]; then
            echo "ERROR: ${relative_run} is missing ${required_file}" >&2
            MISSING=$((MISSING + 1))
        fi
    done
    if [[ "${EVAL_CODE}" == "true" && ! -f "${run_dir}/analyze.py" ]]; then
        echo "ERROR: ${relative_run} is missing analyze.py required for code evaluation" >&2
        MISSING=$((MISSING + 1))
    fi
done

if [[ "${MISSING}" -gt 0 ]]; then
    echo "ERROR: preflight found ${MISSING} missing required file(s); no API calls were made." >&2
    exit 1
fi

echo "============================================================"
echo "  Codex_v3.sh (GT figure + rubric; no GT JSON)"
echo "  matching runs  : ${RUN_COUNT}"
echo "  model          : ${MODEL}"
echo "  evaluate code  : ${EVAL_CODE}"
echo "  force re-score : ${FORCE}"
echo "  dry run        : ${DRY_RUN}"
echo "  results dir    : ${RESULTS_DIR}"
echo "  rubric dir     : ${RUBRIC_DIR}"
echo "  scores dir     : ${SCORES_DIR}"
echo "============================================================"

if [[ "${DRY_RUN}" == "true" ]]; then
    printf '  %s\n' "${RUN_DIRS[@]#"${RESULTS_DIR}"/}"
    echo "Dry run passed: all ${RUN_COUNT} results contain the required artifacts."
    exit 0
fi

if [[ -z "${OPENAI_API_KEY:-${ANTHROPIC_API_KEY:-}}" ]]; then
    echo "ERROR: set OPENAI_API_KEY or ANTHROPIC_API_KEY before evaluation" >&2
    exit 1
fi

: "${OPENAI_API_BASE:=http://35.220.164.252:3888/v1}"
export OPENAI_API_BASE

SCORER_ARGS=(
    --layout cc
    --output-dir "${RESULTS_DIR}"
    --model "${MODEL}"
    --base-url "${OPENAI_API_BASE}"
    --scores-dir "${SCORES_DIR}"
    --rubric-dir "${RUBRIC_DIR}"
)
if [[ "${EVAL_CODE}" == "true" ]]; then
    SCORER_ARGS+=(--eval-code)
fi
if [[ "${FORCE}" == "true" ]]; then
    SCORER_ARGS+=(--force)
fi

python "${SCORER}" "${SCORER_ARGS[@]}"

# Always rebuild without filters so summary.md contains every score already in
# the Codex score directory, including scores from interrupted invocations.
python "${SCORER}" \
    --summary-only \
    --scores-dir "${SCORES_DIR}"

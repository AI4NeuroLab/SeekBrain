#!/usr/bin/env bash
set -euo pipefail

# Evaluate one or all SeekBrain Level-1 results using conclusions + summary only.
#
# Usage:
#   bash v2.sh Koninck_2025_Science_Advances --eval-code
#   bash v2.sh Koninck_2025_Science_Advances 1E
#   bash v2.sh Koninck_2025_Science_Advances 1E --eval-code
#   bash v2.sh Koninck_2025_Science_Advances 1E gpt-5.4 --eval-code

usage() {
    echo "Usage: bash v2.sh <PaperID> [QuestionID] [model] [--eval-code]" >&2
    echo "       Omit QuestionID to evaluate every available figure for the paper." >&2
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
fi

if [[ $# -lt 1 ]]; then
    usage
    exit 1
fi

PAPER_ID="$1"
shift

QUESTION_ID=""
MODEL="claude-opus-4-6"
MODEL_SET=false
EVAL_CODE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --eval-code)
            EVAL_CODE=true
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        --*)
            echo "ERROR: unknown option: $1" >&2
            exit 1
            ;;
        *)
            if [[ -z "${QUESTION_ID}" ]]; then
                QUESTION_ID="$1"
            elif [[ "${MODEL_SET}" == "false" ]]; then
                MODEL="$1"
                MODEL_SET=true
            else
                echo "ERROR: only one evaluation model may be specified" >&2
                exit 1
            fi
            ;;
    esac
    shift
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVALUATE_DIR="/mnt/shared-storage-user/zhuyuqing-p/evaluate"
RUBRIC_DIR="${RUBRIC_DIR:-${EVALUATE_DIR}/evaluate_query/rubric_0714}"
SCORER="${ROOT_DIR}/score_outputs_v2.py"
SCORES_DIR="${ROOT_DIR}/results/evaluation/scores_v2_conclusions_summary"

if [[ ! -f "${SCORER}" ]]; then
    echo "ERROR: scorer not found: ${SCORER}" >&2
    exit 1
fi

# Paper-only mode: discover available figure result directories and score them
# sequentially by invoking the single-figure path below for each one.
if [[ -z "${QUESTION_ID}" ]]; then
    PAPER_RESULT_DIR="${ROOT_DIR}/results/level1/${PAPER_ID}"
    if [[ ! -d "${PAPER_RESULT_DIR}" ]]; then
        echo "ERROR: paper result directory not found: ${PAPER_RESULT_DIR}" >&2
        exit 1
    fi

    mapfile -t CANDIDATE_IDS < <(
        find "${PAPER_RESULT_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -V
    )
    QUESTION_IDS=()
    for candidate in "${CANDIDATE_IDS[@]}"; do
        if [[ "${candidate}" != Fig_* && "${candidate}" != FIG_* ]]; then
            continue
        fi
        if [[ ! -f "${RUBRIC_DIR}/${PAPER_ID}/${candidate}.json" ]]; then
            echo "WARNING: skipping ${candidate}; rubric not found" >&2
            continue
        fi
        QUESTION_IDS+=("${candidate}")
    done

    if [[ ${#QUESTION_IDS[@]} -eq 0 ]]; then
        echo "ERROR: no evaluable figure directories found under: ${PAPER_RESULT_DIR}" >&2
        exit 1
    fi

    echo "Found ${#QUESTION_IDS[@]} figure(s) for ${PAPER_ID}: ${QUESTION_IDS[*]}"
    for question in "${QUESTION_IDS[@]}"; do
        CHILD_ARGS=("${PAPER_ID}" "${question}" "${MODEL}")
        if [[ "${EVAL_CODE}" == "true" ]]; then
            CHILD_ARGS+=(--eval-code)
        fi
        bash "${ROOT_DIR}/v2.sh" "${CHILD_ARGS[@]}"
    done

    python "${SCORER}" --summary-only --scores-dir "${SCORES_DIR}"
    exit 0
fi

QUESTION_ID="${QUESTION_ID%.md}"
if [[ "${QUESTION_ID}" != Fig_* && "${QUESTION_ID}" != FIG_* ]]; then
    QUESTION_ID="Fig_${QUESTION_ID}"
fi

RESULT_DIR="${ROOT_DIR}/results/level1/${PAPER_ID}/${QUESTION_ID}"
RUBRIC_FILE="${RUBRIC_DIR}/${PAPER_ID}/${QUESTION_ID}.json"

if [[ ! -d "${RESULT_DIR}" ]]; then
    echo "ERROR: result directory not found: ${RESULT_DIR}" >&2
    exit 1
fi
if [[ ! -f "${RUBRIC_FILE}" ]]; then
    echo "ERROR: rubric not found: ${RUBRIC_FILE}" >&2
    exit 1
fi

ROUND_NAME="$(find "${RESULT_DIR}" -mindepth 1 -maxdepth 1 -type d -name 'round*' -printf '%f\n' | sort -V | tail -n 1)"
if [[ -z "${ROUND_NAME}" ]]; then
    echo "ERROR: no round directory found under: ${RESULT_DIR}" >&2
    exit 1
fi
ROUND_DIR="${RESULT_DIR}/${ROUND_NAME}"

for required_file in conclusions.json figure.png; do
    if [[ ! -f "${ROUND_DIR}/${required_file}" ]]; then
        echo "ERROR: required result file not found: ${ROUND_DIR}/${required_file}" >&2
        exit 1
    fi
done

if [[ "${EVAL_CODE}" == "true" && ! -f "${ROUND_DIR}/generated_code.py" ]]; then
    echo "ERROR: code evaluation requested but file not found: ${ROUND_DIR}/generated_code.py" >&2
    exit 1
fi

if [[ -z "${OPENAI_API_KEY:-${ANTHROPIC_API_KEY:-}}" ]]; then
    echo "ERROR: set OPENAI_API_KEY or ANTHROPIC_API_KEY before evaluation" >&2
    exit 1
fi

: "${OPENAI_API_BASE:=http://35.220.164.252:3888/v1}"
export OPENAI_API_BASE

# Use a temporary flat result directory so both modes reuse score_outputs.py
# without changing eval_ours.sh, eval_cc.sh, or their Python scorer.
TMP_ROOT="$(mktemp -d /tmp/seekbrain-eval.XXXXXX)"
trap 'rm -rf "${TMP_ROOT}"' EXIT

STAGED_RESULT="${TMP_ROOT}/${QUESTION_ID}-${ROUND_NAME}"
mkdir -p "${STAGED_RESULT}"
ln -s "${ROUND_DIR}/figure.png" "${STAGED_RESULT}/figure.png"
ln -s "${ROUND_DIR}/conclusions.json" "${STAGED_RESULT}/conclusions.json"

if [[ "${EVAL_CODE}" == "true" ]]; then
    ln -s "${ROUND_DIR}/generated_code.py" "${STAGED_RESULT}/generated_code.py"
fi

echo "============================================================"
echo "  v2.sh (conclusions + summary)"
echo "  paper        : ${PAPER_ID}"
echo "  figure       : ${QUESTION_ID}"
echo "  round        : ${ROUND_NAME}"
echo "  model        : ${MODEL}"
echo "  evaluate code: ${EVAL_CODE}"
echo "  rubric dir   : ${RUBRIC_DIR}"
echo "  result dir   : ${ROUND_DIR}"
echo "  scores dir   : ${SCORES_DIR}"
echo "============================================================"

SCORER_ARGS=(
    --layout ours
    --result-dir "${STAGED_RESULT}"
    --paper "${PAPER_ID}"
    --fig "${QUESTION_ID}"
    --model "${MODEL}"
    --base-url "${OPENAI_API_BASE}"
    --scores-dir "${SCORES_DIR}"
    --rubric-dir "${RUBRIC_DIR}"
)
if [[ "${EVAL_CODE}" == "true" ]]; then
    SCORER_ARGS+=(--eval-code)
fi

python "${SCORER}" "${SCORER_ARGS[@]}"

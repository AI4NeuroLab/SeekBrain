#!/usr/bin/env bash
set -euo pipefail

# Evaluate one SeekBrain Level-1 result.
#
# Usage:
#   bash scripts/eval_benchmark.sh Koninck_2025_Science_Advances 1E
#   bash scripts/eval_benchmark.sh Koninck_2025_Science_Advances 1E --eval-code
#   bash scripts/eval_benchmark.sh Koninck_2025_Science_Advances 1E gpt-5.4 --eval-code

if [[ $# -lt 2 ]]; then
    echo "Usage: bash scripts/eval_benchmark.sh <PaperID> <QuestionID> [model] [--eval-code]" >&2
    exit 1
fi

PAPER_ID="$1"
QUESTION_ID="$2"
shift 2

MODEL="claude-opus-4-6"
MODEL_SET=false
EVAL_CODE=false

for arg in "$@"; do
    case "${arg}" in
        --eval-code)
            EVAL_CODE=true
            ;;
        --help|-h)
            echo "Usage: bash scripts/eval_benchmark.sh <PaperID> <QuestionID> [model] [--eval-code]"
            exit 0
            ;;
        --*)
            echo "ERROR: unknown option: ${arg}" >&2
            exit 1
            ;;
        *)
            if [[ "${MODEL_SET}" == "true" ]]; then
                echo "ERROR: only one evaluation model may be specified" >&2
                exit 1
            fi
            MODEL="${arg}"
            MODEL_SET=true
            ;;
    esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVALUATE_DIR="/mnt/shared-storage-user/zhuyuqing-p/evaluate"
RUBRIC_DIR="${RUBRIC_DIR:-${EVALUATE_DIR}/evaluate_query/rubric_0714}"

QUESTION_ID="${QUESTION_ID%.md}"
if [[ "${QUESTION_ID}" != Fig_* && "${QUESTION_ID}" != FIG_* ]]; then
    QUESTION_ID="Fig_${QUESTION_ID}"
fi

RESULT_DIR="${ROOT_DIR}/results/level1/${PAPER_ID}/${QUESTION_ID}"
RUBRIC_FILE="${RUBRIC_DIR}/${PAPER_ID}/${QUESTION_ID}.json"
SCORER="${EVALUATE_DIR}/score_outputs.py"

if [[ ! -d "${RESULT_DIR}" ]]; then
    echo "ERROR: result directory not found: ${RESULT_DIR}" >&2
    exit 1
fi
if [[ ! -f "${RUBRIC_FILE}" ]]; then
    echo "ERROR: rubric not found: ${RUBRIC_FILE}" >&2
    exit 1
fi
if [[ ! -f "${SCORER}" ]]; then
    echo "ERROR: scorer not found: ${SCORER}" >&2
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

SCORES_DIR="${ROOT_DIR}/results/evaluation/scores"

echo "============================================================"
echo "  eval_benchmark.sh"
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

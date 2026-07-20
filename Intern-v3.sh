#!/usr/bin/env bash
set -euo pipefail

# Evaluate benchmark_0714 InternAgent results with the v3 scorer.
#
# Like v3.sh, this supplies the GT figure and rubric, but does not inject the
# query_gt_data (GT JSON) file. InternAgent conclusions.json files do not need
# a summary field: score_outputs_v3.py will use the conclusions field alone.
#
# Usage:
#   bash Intern-v3.sh all --eval-code
#   bash Intern-v3.sh Adam_2023_Cell --eval-code
#   bash Intern-v3.sh Adam_2023_Cell 2D --eval-code
#   bash Intern-v3.sh Adam_2023_Cell 2D claude-opus-4-6 --eval-code --force

usage() {
    echo "Usage: bash Intern-v3.sh <PaperID|all> [QuestionID] [model] [--eval-code] [--force]" >&2
    echo "       Use 'all' to evaluate all 32 results." >&2
    echo "       Omit QuestionID to evaluate every available figure for one paper." >&2
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
FORCE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --eval-code)
            EVAL_CODE=true
            ;;
        --force)
            FORCE=true
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
EVALUATE_DIR="${EVALUATE_DIR:-/mnt/shared-storage-user/zhuyuqing-p/evaluate}"
RESULTS_DIR="${INTERN_RESULTS_DIR:-/mnt/shared-storage-user/zhuyuqing-p/benchmark_0714/results/ours}"
RUBRIC_DIR="${RUBRIC_DIR:-${EVALUATE_DIR}/evaluate_query/rubric_0714}"
SCORER="${ROOT_DIR}/score_outputs_v3.py"
SCORES_DIR="${INTERN_V3_SCORES_DIR:-${ROOT_DIR}/results/evaluation/scores_intern_v3_conclusions}"

if [[ ! -f "${SCORER}" ]]; then
    echo "ERROR: scorer not found: ${SCORER}" >&2
    exit 1
fi
if [[ ! -d "${RESULTS_DIR}" ]]; then
    echo "ERROR: InternAgent results directory not found: ${RESULTS_DIR}" >&2
    exit 1
fi
if [[ ! -d "${RUBRIC_DIR}" ]]; then
    echo "ERROR: rubric directory not found: ${RUBRIC_DIR}" >&2
    exit 1
fi

if [[ "${PAPER_ID}" == "all" ]]; then
    PAPER_ID=""
elif [[ ! -d "${RESULTS_DIR}/${PAPER_ID}" ]]; then
    echo "ERROR: paper result directory not found: ${RESULTS_DIR}/${PAPER_ID}" >&2
    exit 1
fi

if [[ -n "${QUESTION_ID}" ]]; then
    QUESTION_ID="${QUESTION_ID%.md}"
    if [[ "${QUESTION_ID}" != Fig_* && "${QUESTION_ID}" != FIG_* ]]; then
        QUESTION_ID="Fig_${QUESTION_ID}"
    fi
    if [[ -z "${PAPER_ID}" ]]; then
        echo "ERROR: QuestionID cannot be used with 'all'; specify a PaperID." >&2
        exit 1
    fi
fi

RUN_COUNT=0
MISSING_CONCLUSIONS=0
while IFS= read -r -d '' run_dir; do
    relative_run="${run_dir#"${RESULTS_DIR}"/}"
    run_paper="${relative_run%%/*}"
    run_name="${run_dir##*/}"
    fig_tag="${run_name%-*}"
    if [[ -n "${QUESTION_ID}" && "${fig_tag}" != "${QUESTION_ID}" ]]; then
        continue
    fi
    RUN_COUNT=$((RUN_COUNT + 1))
    round_dir="$(find "${run_dir}" -mindepth 1 -maxdepth 1 -type d -name 'round_*' -print | sort -V | tail -n 1)"
    if [[ -z "${round_dir}" || ! -f "${round_dir}/figure.png" ]]; then
        echo "ERROR: result figure not found under: ${run_dir}" >&2
        exit 1
    fi
    if [[ ! -f "${RUBRIC_DIR}/${run_paper}/${fig_tag}.json" ]]; then
        echo "ERROR: rubric not found: ${RUBRIC_DIR}/${run_paper}/${fig_tag}.json" >&2
        exit 1
    fi
    if [[ ! -f "${round_dir}/conclusions.json" && ! -f "${round_dir}/conclusion.md" ]]; then
        echo "WARNING: no conclusion file for ${run_dir}; scoring will use figure/code evidence only." >&2
        MISSING_CONCLUSIONS=$((MISSING_CONCLUSIONS + 1))
    fi
    if [[ "${EVAL_CODE}" == "true" && ! -f "${round_dir}/generated_code.py" ]]; then
        echo "ERROR: code evaluation requested but file not found: ${round_dir}/generated_code.py" >&2
        exit 1
    fi
done < <(
    if [[ -n "${PAPER_ID}" ]]; then
        find "${RESULTS_DIR}/${PAPER_ID}" -mindepth 1 -maxdepth 1 -type d -name 'Fig_*-*' -print0
    else
        find "${RESULTS_DIR}" -mindepth 2 -maxdepth 2 -type d -name 'Fig_*-*' -print0
    fi
)

if [[ "${RUN_COUNT}" -eq 0 ]]; then
    echo "ERROR: no matching InternAgent result found." >&2
    exit 1
fi
if [[ -z "${PAPER_ID}" && -z "${QUESTION_ID}" && "${RUN_COUNT}" -ne 32 ]]; then
    echo "ERROR: expected 32 results for all-mode, found ${RUN_COUNT}." >&2
    exit 1
fi

if [[ -z "${OPENAI_API_KEY:-${ANTHROPIC_API_KEY:-}}" ]]; then
    echo "ERROR: set OPENAI_API_KEY or ANTHROPIC_API_KEY before evaluation" >&2
    exit 1
fi

: "${OPENAI_API_BASE:=http://35.220.164.252:3888/v1}"
export OPENAI_API_BASE

echo "============================================================"
echo "  Intern-v3.sh (GT figure + rubric; no GT JSON)"
echo "  paper          : ${PAPER_ID:-all}"
echo "  figure         : ${QUESTION_ID:-all available}"
echo "  matching runs  : ${RUN_COUNT}"
echo "  no conclusions : ${MISSING_CONCLUSIONS}"
echo "  model          : ${MODEL}"
echo "  evaluate code  : ${EVAL_CODE}"
echo "  force re-score : ${FORCE}"
echo "  results dir    : ${RESULTS_DIR}"
echo "  rubric dir     : ${RUBRIC_DIR}"
echo "  scores dir     : ${SCORES_DIR}"
echo "============================================================"

SCORER_ARGS=(
    --layout ns
    --output-dir "${RESULTS_DIR}"
    --model "${MODEL}"
    --base-url "${OPENAI_API_BASE}"
    --scores-dir "${SCORES_DIR}"
    --rubric-dir "${RUBRIC_DIR}"
)
if [[ -n "${PAPER_ID}" ]]; then
    SCORER_ARGS+=(--paper "${PAPER_ID}")
fi
if [[ -n "${QUESTION_ID}" ]]; then
    SCORER_ARGS+=(--fig "${QUESTION_ID}")
fi
if [[ "${EVAL_CODE}" == "true" ]]; then
    SCORER_ARGS+=(--eval-code)
fi
if [[ "${FORCE}" == "true" ]]; then
    SCORER_ARGS+=(--force)
fi

python "${SCORER}" "${SCORER_ARGS[@]}"

# score_outputs_v3.py writes a filtered summary when --paper/--fig is used.
# Rebuild it without filters so summary.md always contains every score already
# present in SCORES_DIR, including results from earlier invocations.
python "${SCORER}" \
    --summary-only \
    --scores-dir "${SCORES_DIR}"

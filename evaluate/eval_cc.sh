#!/usr/bin/env bash
set -euo pipefail

# Score CC-style anonymized outputs.
#
# Layout:
#   <output_dir>/<paper>/<fig>/{conclusion.md,analyze.png,...}
#
# Usage:
#   bash eval_cc.sh [<output_dir>] [<paper>] [<fig>] [<model>] [<rubric_dir>]
#
# Examples:
#   bash eval_cc.sh
#   bash eval_cc.sh /home/zhuyuqing-p/CC/output
#   bash eval_cc.sh /home/zhuyuqing-p/CC/output Adam_2023_Cell
#   bash eval_cc.sh /home/zhuyuqing-p/CC/output Adam_2023_Cell Fig_1H
#   bash eval_cc.sh /home/zhuyuqing-p/CC/output Adam_2023_Cell Fig_1H gpt-5.4

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

OUTPUT_DIR="${1:-/home/zhuyuqing-p/CC/output}"
PAPER="${2:-}"
FIG="${3:-}"
MODEL="${4:-}"
RUBRIC_DIR_OVERRIDE="${5:-${RUBRIC_DIR:-}}"

: "${OPENAI_API_BASE:=http://35.220.164.252:3888/v1}"
: "${OPENAI_API_KEY:=${API_KEY:-sk-bj8WJ0fjUDF1McQlb5KUVSEiqlU3LLhxTM3ojcw0sIjBPPjv}}"
export OPENAI_API_BASE OPENAI_API_KEY
[[ -n "${OPENAI_API_KEY}" ]] && export ANTHROPIC_API_KEY="${OPENAI_API_KEY}"

ARGS=(
    --layout cc
    --output-dir "${OUTPUT_DIR}"
)
[[ -n "${PAPER}" ]] && ARGS+=(--paper "${PAPER}")
[[ -n "${FIG}"   ]] && ARGS+=(--fig "${FIG}")
[[ -n "${MODEL}" ]] && ARGS+=(--model "${MODEL}")
[[ -n "${RUBRIC_DIR_OVERRIDE}" ]] && ARGS+=(--rubric-dir "${RUBRIC_DIR_OVERRIDE}")

echo "============================================================"
echo "  eval_cc.sh"
echo "  script_dir   : ${SCRIPT_DIR}"
echo "  output_dir   : ${OUTPUT_DIR}"
echo "  paper        : ${PAPER:-<all>}"
echo "  fig          : ${FIG:-<all>}"
echo "  model        : ${MODEL:-<default>}"
echo "  rubric_dir   : ${RUBRIC_DIR_OVERRIDE:-<default>}"
echo "============================================================"

python "${SCRIPT_DIR}/score_outputs.py" "${ARGS[@]}"

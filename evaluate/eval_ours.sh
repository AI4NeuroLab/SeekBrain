#!/usr/bin/env bash
# ============================================================================
# eval_ours.sh  —  Evaluate every run inside a date directory.
# bash evaluate/eval_ours.sh results/Ryosuke_2026_Nature/20260518 claude-sonnet-4.5
# Usage:
#   bash eval_ours.sh <input_dir> [<model>] [<fig_tag>] [<rubric_dir>]
#
# <input_dir> is a directory of the form:
#   <results_root>/<paper_name>/<date>/
# whose subdirectories are run dirs of the form  <fig_tag>-<timestamp>/round_N/.
#
# Examples:
#   bash eval_ours.sh ../results/David_2026_Nature_Neuroscience/20260515/
#   bash eval_ours.sh /abs/path/results/David_2026_Nature_Neuroscience/20260515/ gpt-5.4
#   bash eval_ours.sh ../results/David_2026_Nature_Neuroscience/20260515/ claude-opus-4-6 Fig_6C
#
# Scores are written to:
#   evaluate/scores/output_ns/<paper_name>/<date>/<run_dir_name>/score_<model>.json
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Arguments ───────────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
    echo "Usage: bash eval_ours.sh <input_dir> [<model>] [<fig_tag>]" >&2
    exit 1
fi

INPUT_DIR="$1"
MODEL="${2:-claude-opus-4-6}"
FIG_TAG="${3:-}"
RUBRIC_DIR_OVERRIDE="${4:-${RUBRIC_DIR:-}}"

# Resolve to an absolute path so paper/date can be derived reliably.
INPUT_ABS="$(cd "${INPUT_DIR}" && pwd)"
DATE="$(basename "${INPUT_ABS}")"
PAPER="$(basename "$(dirname "${INPUT_ABS}")")"

# ── API keys ────────────────────────────────────────────────────────────────
export OPENAI_API_BASE=http://35.220.164.252:3888/v1
export OPENAI_API_KEY=sk-bj8WJ0fjUDF1McQlb5KUVSEiqlU3LLhxTM3ojcw0sIjBPPjv
export ANTHROPIC_API_KEY="${OPENAI_API_KEY}"

# ── Scores dir mirrors <paper>/<date> under evaluate/scores/output_ns ───────
SCORES_DIR="${SCRIPT_DIR}/scores/output_ns_0530.1/${PAPER}/${DATE}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  layout     : ns (date-dir mode)"
echo "  input_dir  : ${INPUT_ABS}"
echo "  paper      : ${PAPER}"
echo "  date       : ${DATE}"
echo "  fig        : ${FIG_TAG:-<all>}"
echo "  model      : ${MODEL}"
echo "  rubric_dir : ${RUBRIC_DIR_OVERRIDE:-<default>}"
echo "  scores_dir : ${SCORES_DIR}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ARGS=(
    --layout     ns
    --input-dir  "${INPUT_ABS}"
    --paper      "${PAPER}"
    --scores-dir "${SCORES_DIR}"
    --model      "${MODEL}"
)
[[ -n "${FIG_TAG}" ]] && ARGS+=(--fig "${FIG_TAG}")
[[ -n "${RUBRIC_DIR_OVERRIDE}" ]] && ARGS+=(--rubric-dir "${RUBRIC_DIR_OVERRIDE}")

python "${SCRIPT_DIR}/score_outputs.py" "${ARGS[@]}"

echo ""
echo "Scores → ${SCORES_DIR}/"

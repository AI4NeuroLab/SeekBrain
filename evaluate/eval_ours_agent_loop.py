#!/usr/bin/env bash
# ============================================================================
# eval_ours_agent_loop.py  —  Batch-evaluate every question under results/<folder>/.
#
# Usage:
#   evaluate/eval_ours_agent_loop.py results/<folder>
#
# Input layout (fixed depth, non-recursive):
#   results/<folder>/<paper>/<date>/<run_dir>/{figure.png, conclusions.json, ...}
#
# Scores are written to:
#   evaluate/score/<folder>/<paper>/<date>/<run_dir>/score_<model>.json
#   evaluate/score/<folder>/summary.md
#   evaluate/score/<folder>/summary.csv
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── API ─────────────────────────────────────────────────────────────────────
OPENAI_API_BASE="http://35.220.164.252:3888/v1"
OPENAI_API_KEY="sk-hYS1gksus75QkB0kzPJzX8bOpn83FgagDyWgz5lREQkvQzHc"
EVAL_MODEL="claude-opus-4-8"

export OPENAI_API_BASE OPENAI_API_KEY EVAL_MODEL
export ANTHROPIC_API_KEY="${OPENAI_API_KEY}"

if [[ $# -ne 1 ]]; then
    echo "Usage: evaluate/eval_ours_agent_loop.py results/<folder>" >&2
    exit 1
fi

INPUT_DIR="$1"
INPUT_ABS="$(cd "${INPUT_DIR}" && pwd)"
FOLDER="$(basename "${INPUT_ABS}")"
SCORES_DIR="${SCRIPT_DIR}/score/${FOLDER}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  input_dir  : ${INPUT_ABS}"
echo "  folder     : ${FOLDER}"
echo "  model      : ${EVAL_MODEL}"
echo "  base_url   : ${OPENAI_API_BASE}"
echo "  scores_dir : ${SCORES_DIR}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

python -u "${SCRIPT_DIR}/scripts_batch_score.py" \
    "${INPUT_ABS}" \
    --scores-dir "${SCORES_DIR}" \
    --model "${EVAL_MODEL}" \
    --base-url "${OPENAI_API_BASE}" \
    --api-key "${OPENAI_API_KEY}"

echo ""
echo "Scores -> ${SCORES_DIR}/"

#!/usr/bin/env bash
set -euo pipefail

# Run every question for one paper.
# Usage: bash ./scripts/run_all.sh Adam_2023_Cell

PAPER_ID="${1:-}"

if [[ -z "${PAPER_ID}" ]]; then
    echo "Usage: bash ./scripts/run_all.sh <PaperID>"
    echo "Example: bash ./scripts/run_all.sh Adam_2023_Cell"
    exit 1
fi

BENCHMARK_ROOT="/mnt/shared-storage-user/zhuyuqing-p/benchmark_0714/benchmark"
QUESTIONS_DIR="${BENCHMARK_ROOT}/questions/${PAPER_ID}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -d "${QUESTIONS_DIR}" ]]; then
    echo "ERROR: questions directory not found: ${QUESTIONS_DIR}"
    exit 1
fi

mapfile -t QUESTION_FILES < <(
    find "${QUESTIONS_DIR}" -maxdepth 1 -type f -name 'Fig_*.md' | sort
)

if [[ ${#QUESTION_FILES[@]} -eq 0 ]]; then
    echo "ERROR: no question files found in ${QUESTIONS_DIR}"
    exit 1
fi

for QUESTION_FILE in "${QUESTION_FILES[@]}"; do
    QUESTION_ID="$(basename "${QUESTION_FILE}" .md)"
    bash "${SCRIPT_DIR}/run_benchmark.sh" "${PAPER_ID}" "${QUESTION_ID}"
done

#!/usr/bin/env bash
set -euo pipefail

# Usage: bash ./scripts/run_benchmark.sh Adam_2023_Cell 1H

PAPER_ID="${1:-}"
QUESTION_ID="${2:-}"

if [[ -z "${PAPER_ID}" || -z "${QUESTION_ID}" ]]; then
    echo "Usage: bash ./scripts/run_benchmark.sh <PaperID> <QuestionID>"
    echo "Example: bash ./scripts/run_benchmark.sh Adam_2023_Cell 1H"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BENCHMARK_ROOT="/mnt/shared-storage-user/zhuyuqing-p/benchmark_0714/benchmark"
PI_CMD="${ROOT_DIR}/.tools/node/bin/pi"

if [[ ! -x "${PI_CMD}" ]]; then
    echo "ERROR: project Pi not found: ${PI_CMD}"
    echo "Run ./pi_install.sh first."
    exit 1
fi

export PATH="${ROOT_DIR}/.tools/node/bin:${PATH}"

QUESTION_ID="${QUESTION_ID%.md}"
if [[ "${QUESTION_ID}" != Fig_* ]]; then
    QUESTION_ID="Fig_${QUESTION_ID}"
fi

QUESTION_FILE="${BENCHMARK_ROOT}/questions/${PAPER_ID}/${QUESTION_ID}.md"
METADATA_FILE="${BENCHMARK_ROOT}/meta/${PAPER_ID}.json"
WORK_DIR="${ROOT_DIR}/results/level1/${PAPER_ID}/${QUESTION_ID}"

if [[ ! -f "${QUESTION_FILE}" ]]; then
    echo "ERROR: question file not found: ${QUESTION_FILE}"
    exit 1
fi

if [[ ! -f "${METADATA_FILE}" ]]; then
    echo "ERROR: metadata file not found: ${METADATA_FILE}"
    exit 1
fi

mkdir -p "${WORK_DIR}"
cd "${ROOT_DIR}"

echo "=== ${PAPER_ID} / ${QUESTION_ID} ==="
echo "  question : ${QUESTION_FILE}"
echo "  metadata : ${METADATA_FILE}"
echo "  work_dir : ${WORK_DIR}"

NEURO_LEVEL1_NON_INTERACTIVE=1 "${PI_CMD}" \
    -e extensions/neuro.ts \
    -p "
请完成下面的科学数据分析任务。

## 任务

- question 文件: ${QUESTION_FILE}
- metadata 文件: ${METADATA_FILE}
- work_dir: ${WORK_DIR}

使用 NeuroScientist Level 1 完整执行 Plan、Code、Validate、可选 Refine、Analyze 和 Conclude。
所有结果保存在 work_dir，不要询问用户确认，直接开始执行。
"
